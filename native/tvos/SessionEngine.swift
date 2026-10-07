// The session state machine for the Apple TV app: pick a soundscape + length on the
// home screen, then begin an ambient session that loops the bed and runs the on-screen
// breathing clock, counting down to a quiet end (or running open-ended on infinite).
//
// No HealthKit here (tvOS has none) and no voice (tvOS v2). The breathing orb + the
// bed are the whole V1 experience.

import SwiftUI
import Combine

@MainActor
final class SessionEngine: ObservableObject {
    enum Screen { case home, session }

    @Published var screen: Screen = .home
    @Published var selected: Bed = Catalog.freeBeds.first ?? Catalog.beds[0]
    @Published var minutes: Int = 20          // -1 == infinite (loops until ended)
    @Published var remaining: Int = 0         // whole seconds left (0 when infinite)
    @Published var paused = false

    // Offered lengths on the home screen. -1 is the open-ended "infinite" option.
    let lengths: [Int] = [10, 20, 30, 60, -1]

    let player = BedPlayer()

    // The breath clock anchor: the session's on-screen orb reads its phase from the time
    // since this date (frozen visually while paused via the TimelineView).
    private(set) var breathStart = Date()

    private var timer: Timer?
    private var endsAt: Date?

    var isInfinite: Bool { minutes <= 0 }

    func begin() {
        player.configureSession()
        player.play(bed: selected)
        paused = false
        breathStart = Date()
        if isInfinite {
            remaining = 0
            endsAt = nil
        } else {
            remaining = minutes * 60
            endsAt = Date().addingTimeInterval(TimeInterval(remaining))
        }
        screen = .session
        startTimer()
    }

    func togglePause() {
        paused.toggle()
        if paused {
            player.pause()
            stopTimer()
        } else {
            player.resume()
            if !isInfinite {
                endsAt = Date().addingTimeInterval(TimeInterval(remaining))
            }
            startTimer()
        }
    }

    func end() {
        stopTimer()
        player.stop()
        paused = false
        screen = .home
    }

    // MARK: - Countdown

    private func startTimer() {
        stopTimer()
        guard !isInfinite else { return }
        let t = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func tick() {
        guard let endsAt else { return }
        let left = Int(max(0, endsAt.timeIntervalSinceNow.rounded(.up)))
        remaining = left
        if left <= 0 { end() }
    }
}
