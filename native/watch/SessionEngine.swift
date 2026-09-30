// The whole session state machine for the watch: pick a length, run the breath
// clock, fire the wrist haptics at each turn, keep alive with an extended runtime
// session, and log Mindful Minutes to Health at the end.
//
// Plain ObservableObject driven by a main-runloop timer (so @Published updates and
// WKInterfaceDevice haptics all happen on the main thread). No audio pipeline —
// this is a silent, haptic-first pacer (voice/soundscape on the wrist is v2).

import SwiftUI
import WatchKit
import Combine // @Published / ObservableObject live here (needed explicitly on watchOS)

final class SessionEngine: ObservableObject {
    enum Screen { case setup, playing, paused, done }

    @Published var screen: Screen = .setup
    @Published var minutes: Int = 5
    @Published var pb: Double = 0                // breath amount 0..1 (drives the orb)
    @Published var phase: Breath.Phase = .exhale // drives the cue word
    @Published var remaining: Int = 0            // whole seconds left
    @Published private(set) var loggedHealth = false

    let choices = [1, 3, 5, 10]

    private let health = HealthStore()
    private let runtime = ExtendedRuntime()
    private var timer: Timer?
    private var startDate = Date()
    private var elapsed: Double = 0
    private var lastTick: Date?
    private var lastPhase: Breath.Phase = .exhale

    private var total: Double { Double(minutes) * 60 }

    // Ask for Health permission once, up front.
    func onAppear() { health.requestAuthorization() }

    func begin() {
        elapsed = 0
        remaining = Int(total)
        startDate = Date()
        lastTick = Date()
        lastPhase = .exhale
        pb = 0
        phase = .exhale
        loggedHealth = false
        screen = .playing
        WKInterfaceDevice.current().play(.start)
        runtime.start()
        startTimer()
    }

    func togglePause() {
        switch screen {
        case .playing:
            screen = .paused
            stopTimer()
        case .paused:
            screen = .playing
            lastTick = Date()     // don't count paused time against the clock
            startTimer()
        default:
            break
        }
    }

    // completed == true means the timer ran out (a full sit); false is an early End.
    func end(completed: Bool) {
        stopTimer()
        runtime.stop()
        // Only log a genuine sit (skip an immediate accidental End).
        if health.isAvailable, elapsed > 20 {
            health.saveMindfulMinutes(start: startDate, end: Date())
            loggedHealth = true
        }
        WKInterfaceDevice.current().play(completed ? .success : .stop)
        screen = completed ? .done : .setup
    }

    func reset() { screen = .setup }

    // MARK: - Clock

    private func startTimer() {
        stopTimer()
        // ~30 Hz for a smooth orb; a sit is only a few minutes and runs on-screen
        // or under the mindfulness runtime session.
        let t = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) { [weak self] _ in
            self?.tick()
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        let now = Date()
        if let last = lastTick { elapsed += now.timeIntervalSince(last) }
        lastTick = now

        let b = Breath.at(elapsed)
        pb = b.pb
        phase = b.phase
        remaining = max(0, Int((total - elapsed).rounded(.up)))

        // A distinct tap on each turn: up to breathe in, down to breathe out, so
        // the pace is felt without looking. Hold gets no haptic (stillness).
        if b.phase != lastPhase {
            if b.phase == .inhale {
                WKInterfaceDevice.current().play(.directionUp)
            } else if b.phase == .exhale {
                WKInterfaceDevice.current().play(.directionDown)
            }
            lastPhase = b.phase
        }

        if elapsed >= total { end(completed: true) }
    }
}
