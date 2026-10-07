// relaxed — Apple TV app.
// Brand tokens + the breath cadence, mirrored from the web (and the watch) so the
// big screen can never drift from the phone. Ink ground, Bone ink, lowercase chrome
// (docs/design-system.md). Self-contained on purpose: the tvOS target compiles from
// native/tvos/ alone, so this mirrors native/watch/Theme.swift rather than sharing it.

import SwiftUI

enum Theme {
    // #121110 Ink (ground) and #efebe3 Bone (ink). Keep in step with app/relaxed.css.
    static let ink = Color(red: 0x12 / 255, green: 0x11 / 255, blue: 0x10 / 255)
    static let bone = Color(red: 0xEF / 255, green: 0xEB / 255, blue: 0xE3 / 255)
    static let boneDim = bone.opacity(0.55)
    static let hair = bone.opacity(0.22)
    // A warm cast for the orb's outer halo.
    static let warm = Color(red: 0xEF / 255, green: 0xE7 / 255, blue: 0xD6 / 255)
}

// The breathing cycle, mirrored from lib/breath.ts: 6s inhale, 2.5s hold at the
// top, 6s exhale (a 14.5s cycle). Same easing, so the TV orb lands with the phone's
// orb + cue. Pure math.
enum Breath {
    static let inhale: Double = 6
    static let hold: Double = 2.5
    static let exhale: Double = 6
    static let cycle = inhale + hold + exhale

    enum Phase: Equatable { case inhale, hold, exhale }

    static func easeInOut(_ x: Double) -> Double {
        x < 0.5 ? 2 * x * x : 1 - pow(-2 * x + 2, 2) / 2
    }

    // pb: 0 fully exhaled ... 1 fully inhaled / held at the top; phase drives the
    // cue word. One source of truth (matches breathAt in breath.ts).
    static func at(_ t: Double) -> (pb: Double, phase: Phase) {
        var c = t.truncatingRemainder(dividingBy: cycle)
        if c < 0 { c += cycle }
        if c < inhale { return (easeInOut(c / inhale), .inhale) }
        if c < inhale + hold { return (1, .hold) }
        return (easeInOut(1 - (c - inhale - hold) / exhale), .exhale)
    }
}
