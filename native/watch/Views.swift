// The three screens: pick a length, breathe, a quiet close. Kept deliberately
// spare — the wrist version is more minimal than the phone.

import SwiftUI

// MARK: - The stem "r" mark.

// One open stroke on the 100x100 grid, matching lib/mark.tsx, the app icon, and the
// watch-face widget. Drawn in a Canvas so the stroke scales cleanly at any size.
struct StemMark: View {
    var body: some View {
        Canvas { c, size in
            let s = min(size.width, size.height) / 100.0
            c.scaleBy(x: s, y: s)
            var p = Path()
            p.move(to: CGPoint(x: 40, y: 74))
            p.addLine(to: CGPoint(x: 40, y: 40))
            p.addCurve(
                to: CGPoint(x: 60, y: 26),
                control1: CGPoint(x: 40, y: 30),
                control2: CGPoint(x: 49, y: 26)
            )
            c.stroke(p, with: .color(Theme.bone), style: StrokeStyle(lineWidth: 13, lineCap: .butt))
        }
    }
}

// MARK: - Setup: launch a session on the phone, or just breathe on the wrist.

// Two clearly separated choices. The primary one is the four-intention picker that
// *starts a session on the phone* (where the voice + soundscape live); it uses the
// phone's own length, so no timer here. Below a divider, the secondary "just breathe"
// is the silent on-wrist haptic pacer, and the length picker belongs to *it* — the
// only thing the watch runs on its own.
struct SetupView: View {
    @EnvironmentObject var engine: SessionEngine
    @EnvironmentObject var phone: PhoneLink

    // The four intentions the wrist can launch on the phone (1.4.2). Labels match
    // the phone's home tiles; ids match lib/contexts.ts (the "meditate" tile is the
    // "meditation" context).
    private let intentions: [(label: String, id: String)] = [
        ("meditate", "meditation"),
        ("sleep", "sleep"),
        ("flow", "flow"),
        ("relax", "relax"),
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                // Header: the stem mark + wordmark.
                StemMark()
                    .frame(width: 24, height: 24)
                    .padding(.top, 2)
                Text("relaxed")
                    .font(.system(size: 16, weight: .regular, design: .rounded))
                    .foregroundStyle(Theme.bone)

                // Primary: start a session on the phone, from the wrist.
                Text("start on your iPhone")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.boneDim)
                    .padding(.top, 2)
                VStack(spacing: 6) {
                    ForEach(0..<2, id: \.self) { row in
                        HStack(spacing: 6) {
                            ForEach(0..<2, id: \.self) { col in
                                let item = intentions[row * 2 + col]
                                Button {
                                    phone.start(intention: item.id)
                                } label: {
                                    Text(item.label)
                                        .font(.system(size: 14, weight: .medium))
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(Theme.bone)
                                .foregroundStyle(Theme.ink)
                            }
                        }
                    }
                }

                // Secondary: the silent haptic pacer that runs on the wrist itself,
                // with its own length. Grouped together, below a divider, so the timer
                // clearly supports *this* and nothing above it.
                Divider()
                    .background(Theme.hair)
                    .padding(.vertical, 6)
                Text("just breathe on your watch")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.boneDim)
                Picker(selection: $engine.minutes) {
                    ForEach(engine.choices, id: \.self) { m in
                        Text("\(m) min").tag(m)
                    }
                } label: {
                    EmptyView()
                }
                .labelsHidden()
                .frame(height: 50)
                Button {
                    engine.begin()
                } label: {
                    Text("just breathe")
                        .font(.system(size: 14, weight: .medium))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(Theme.hair)
                .foregroundStyle(Theme.bone)
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
        }
    }
}

// MARK: - The breathing orb (concept 6 · Luminous).

// No edge, no chrome: light rising out of the Ink. A warm outer halo and the
// main bloom swell and brighten on the inhale; a steady inner bed of light keeps
// the numeral legible even at the bottom of the exhale, when the bloom is at its
// smallest. The countdown is a fixed size on top and never scales, so it stays
// crisp while only the light moves. `pb` is 0 fully exhaled .. 1 fully inhaled.
struct Orb: View {
    var pb: Double
    var label: String

    // A generous swell so the breath is unmistakable, and the light brightens as
    // it fills. The fixed bed below keeps the numeral legible at the trough.
    private var scale: Double { 0.52 + 0.66 * pb }   // ~0.52 .. 1.18
    private var glow: Double { 0.72 + 0.28 * pb }

    var body: some View {
        ZStack {
            // Wide ambient scatter. Each glow gets its own oversized frame so the
            // gradient has room to fall off and bleeds past the orb into the dark,
            // instead of being clipped to a hard disc.
            Circle()
                .fill(RadialGradient(
                    colors: [Theme.bone.opacity(0.08 * glow), .clear],
                    center: .center, startRadius: 14, endRadius: 88))
                .frame(width: 176, height: 176)
                .blur(radius: 18)
                .scaleEffect(scale)

            // Warm halo.
            Circle()
                .fill(RadialGradient(
                    colors: [Theme.warm.opacity(0.20 * glow), .clear],
                    center: .center, startRadius: 8, endRadius: 75))
                .frame(width: 150, height: 150)
                .blur(radius: 12)
                .scaleEffect(scale)

            // The main bloom: edgeless light rising out of the Ink, soft to the edge.
            Circle()
                .fill(RadialGradient(
                    stops: [
                        .init(color: Theme.bone.opacity(0.92 * glow), location: 0.0),
                        .init(color: Theme.bone.opacity(0.55 * glow), location: 0.26),
                        .init(color: Theme.bone.opacity(0.22 * glow), location: 0.50),
                        .init(color: Theme.bone.opacity(0.07 * glow), location: 0.72),
                        .init(color: .clear, location: 0.90),
                    ],
                    center: .center, startRadius: 0, endRadius: 74))
                .frame(width: 150, height: 150)
                .blur(radius: 2)
                .scaleEffect(scale)

            // Inner bright breath, a touch high.
            Circle()
                .fill(RadialGradient(
                    colors: [Color.white.opacity(0.35), .clear],
                    center: .center, startRadius: 2, endRadius: 30))
                .frame(width: 68, height: 68)
                .offset(y: -3)
                .blur(radius: 6)
                .scaleEffect(scale)

            // A steady, soft bed so the numeral stays legible at the exhale trough.
            // This layer does not scale.
            Circle()
                .fill(RadialGradient(
                    colors: [Theme.bone.opacity(0.5), .clear],
                    center: .center, startRadius: 2, endRadius: 34))
                .frame(width: 62, height: 62)
                .blur(radius: 8)

            // The clock: fixed size, legible, quiet.
            Text(label)
                .font(.system(size: 20, weight: .regular, design: .rounded))
                .monospacedDigit()
                .tracking(0.4)
                .foregroundStyle(Theme.lumenInk)
        }
        .frame(width: 120, height: 120)
    }
}

// MARK: - Session: the breathing orb, the cue, the clock, and the controls.

struct SessionView: View {
    @EnvironmentObject var engine: SessionEngine

    private var cue: String {
        switch engine.phase {
        case .inhale: return "breathe in"
        case .hold: return "hold"
        case .exhale: return "breathe out"
        }
    }

    var body: some View {
        VStack(spacing: 6) {
            Text(engine.screen == .paused ? "paused" : cue)
                .font(.system(size: 15))
                .foregroundStyle(Theme.boneDim)

            Orb(pb: engine.pb, label: timeString(engine.remaining))

            HStack(spacing: 8) {
                Button("end") { engine.end(completed: false) }
                    .tint(Theme.hair)
                    .foregroundStyle(Theme.bone)
                Button(engine.screen == .paused ? "resume" : "pause") {
                    engine.togglePause()
                }
                .tint(Theme.hair)
                .foregroundStyle(Theme.bone)
            }
            .font(.system(size: 14))
        }
        .padding(.horizontal, 6)
    }

    private func timeString(_ s: Int) -> String {
        String(format: "%d:%02d", s / 60, s % 60)
    }
}

// MARK: - Remote: mirror + control a session playing on the phone (1.4.1).

// Shown when a phone session is active. Mirrors the phone's player: the soundscape
// line art sits inside a ring that breathes on the shared cadence while playing,
// with the countdown below and play/pause/stop that drive the phone. The line art
// is the star here (1.4.2) — the thing that feels made for the wrist.
struct RemoteView: View {
    @EnvironmentObject var link: PhoneLink

    // The phone-synced breath time: advance the phone's last breathPos by the real
    // seconds since its snapshot while playing, so the wrist stays in phase with the
    // phone instead of free-running its own clock. Frozen at breathPos when paused.
    private func breathT(_ date: Date) -> Double {
        guard link.playing else { return link.breathPos }
        let since = max(0, (date.timeIntervalSince1970 * 1000 - link.breathTs) / 1000)
        return link.breathPos + since
    }

    var body: some View {
        VStack(spacing: 5) {
            Text(link.soundscape.isEmpty ? "relaxed" : link.soundscape)
                .font(.system(size: 14))
                .foregroundStyle(Theme.boneDim)
                .lineLimit(1)
                .padding(.horizontal, 4)

            // Motif + ring breathe in phase with the phone (via the breath anchor
            // sent over the link), and the motif's drift/pulse run on the same clock.
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !link.playing)) { ctx in
                let t = breathT(ctx.date)
                let pb = Breath.at(t).pb
                ZStack {
                    SoundMotif(id: link.motif, t: t)
                        .frame(width: 82, height: 82)
                    Circle()
                        .stroke(Theme.bone.opacity(0.5), lineWidth: 1.5)
                        .frame(width: 96, height: 96)
                        .scaleEffect(0.74 + 0.26 * pb)
                }
            }
            .frame(width: 100, height: 100)

            Text(timeString(link.remaining))
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Theme.bone)

            HStack(spacing: 8) {
                Button("stop") { link.send("stop") }
                    .tint(Theme.hair)
                    .foregroundStyle(Theme.bone)
                Button(link.playing ? "pause" : "play") {
                    link.send(link.playing ? "pause" : "play")
                }
                .tint(Theme.hair)
                .foregroundStyle(Theme.bone)
            }
            .font(.system(size: 13))
        }
        .padding(.horizontal, 6)
    }

    private func timeString(_ s: Int) -> String {
        String(format: "%d:%02d", s / 60, s % 60)
    }
}

// MARK: - Done: a quiet well done.

struct DoneView: View {
    @EnvironmentObject var engine: SessionEngine

    var body: some View {
        VStack(spacing: 8) {
            Text("well done")
                .font(.system(size: 18, weight: .regular, design: .rounded))
                .foregroundStyle(Theme.bone)
            if engine.loggedHealth {
                Text("added to Health")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.boneDim)
            }
            Button("done") { engine.reset() }
                .buttonStyle(.borderedProminent)
                .tint(Theme.bone)
                .foregroundStyle(Theme.ink)
                .padding(.top, 2)
        }
        .padding(.horizontal, 6)
    }
}
