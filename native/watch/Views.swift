// The three screens: pick a length, breathe, a quiet close. Kept deliberately
// spare — the wrist version is more minimal than the phone.

import SwiftUI

// MARK: - Setup: choose a length, then begin.

struct SetupView: View {
    @EnvironmentObject var engine: SessionEngine

    var body: some View {
        VStack(spacing: 8) {
            Text("relaxed")
                .font(.system(size: 17, weight: .regular, design: .rounded))
                .foregroundStyle(Theme.bone)

            // Digital Crown picks the length.
            Picker(selection: $engine.minutes) {
                ForEach(engine.choices, id: \.self) { m in
                    Text("\(m) min").tag(m)
                }
            } label: {
                EmptyView()
            }
            .labelsHidden()
            .frame(height: 64)

            Button {
                engine.begin()
            } label: {
                Text("begin")
                    .font(.system(size: 16, weight: .medium))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.bone)
            .foregroundStyle(Theme.ink)
        }
        .padding(.horizontal, 6)
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
