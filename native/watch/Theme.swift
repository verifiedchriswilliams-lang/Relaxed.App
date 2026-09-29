// relaxed — Apple Watch companion.
// Brand tokens + the breath cadence, mirrored from the web so the wrist and the
// phone can never drift. Ink ground, Bone ink, lowercase chrome (docs/design-system.md).

import SwiftUI

enum Theme {
    // #121110 Ink (ground) and #efebe3 Bone (ink). Keep in step with app/relaxed.css.
    static let ink = Color(red: 0x12 / 255, green: 0x11 / 255, blue: 0x10 / 255)
    static let bone = Color(red: 0xEF / 255, green: 0xEB / 255, blue: 0xE3 / 255)
    static let boneDim = bone.opacity(0.55)
    static let hair = bone.opacity(0.22)
}

// The breathing cycle, mirrored from lib/breath.ts: 6s inhale, 2.5s hold at the
// top, 6s exhale (a 14.5s cycle). Same easing, so the wrist orb + haptics land
// with the phone's orb + cue. Pure math.
enum Breath {
    static let inhale: Double = 6
    static let hold: Double = 2.5
    static let exhale: Double = 6
    static let cycle = inhale + hold + exhale

    enum Phase { case inhale, hold, exhale }

    static func easeInOut(_ x: Double) -> Double {
        x < 0.5 ? 2 * x * x : 1 - pow(-2 * x + 2, 2) / 2
    }

    // pb: 0 fully exhaled ... 1 fully inhaled / held at the top; phase drives the
    // cue word and the haptic. One source of truth (matches breathAt in breath.ts).
    static func at(_ t: Double) -> (pb: Double, phase: Phase) {
        var c = t.truncatingRemainder(dividingBy: cycle)
        if c < 0 { c += cycle }
        if c < inhale { return (easeInOut(c / inhale), .inhale) }
        if c < inhale + hold { return (1, .hold) }
        return (easeInOut(1 - (c - inhale - hold) / exhale), .exhale)
    }
}
