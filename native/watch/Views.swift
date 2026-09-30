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

    // A gentle swell: the light does more of the breathing than the size does,
    // which keeps a bright bed under the numeral at every point in the breath.
    private var scale: Double { 0.72 + 0.28 * pb }
    private var glow: Double { 0.82 + 0.18 * pb }

    var body: some View {
        ZStack {
            // Warm outer halo.
            Circle()
                .fill(RadialGradient(
                    colors: [Theme.warm.opacity(0.14 * glow), .clear],
                    center: .center, startRadius: 4, endRadius: 64))
                .scaleEffect(1.18 * scale)
                .blur(radius: 10)

            // The main bloom: edgeless light emerging from the Ink.
            Circle()
                .fill(RadialGradient(
                    stops: [
                        .init(color: Theme.bone.opacity(0.92 * glow), location: 0.0),
                        .init(color: Theme.bone.opacity(0.55 * glow), location: 0.24),
                        .init(color: Theme.bone.opacity(0.20 * glow), location: 0.48),
                        .init(color: Theme.bone.opacity(0.05 * glow), location: 0.70),
                        .init(color: .clear, location: 0.84),
                    ],
                    center: .center, startRadius: 0, endRadius: 54))
                .scaleEffect(scale)

            // Inner bright breath, sitting a touch high.
            Circle()
                .fill(RadialGradient(
                    colors: [Color.white.opacity(0.5), .clear],
                    center: .center, startRadius: 2, endRadius: 34))
                .frame(width: 78, height: 78)
                .offset(y: -4)
                .scaleEffect(scale)
                .blur(radius: 6)

            // A steady bed of light so the numeral stays legible through the whole
            // breath. This layer does not scale.
            Circle()
                .fill(RadialGradient(
                    colors: [Theme.bone.opacity(0.82), .clear],
                    center: .center, startRadius: 2, endRadius: 44))
                .frame(width: 76, height: 76)
                .blur(radius: 6)

            // The clock: fixed size, legible, quiet.
            Text(label)
                .font(.system(size: 20, weight: .regular, design: .rounded))
                .monospacedDigit()
                .tracking(0.4)
                .foregroundStyle(Theme.lumenInk)
        }
        .frame(width: 108, height: 108)
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
