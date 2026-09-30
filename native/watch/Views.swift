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

// MARK: - The breathing orb.

// A soft, dimensional Bone sphere on the Ink ground: an offset radial gradient
// gives it volume (a bright highlight up-left through Bone to a shadowed edge),
// a small specular dot glosses it, and a halo swells and brightens on the inhale.
// The countdown sits at the centre at a fixed size (it stays crisp and readable
// while the sphere breathes around it). `pb` is 0 exhaled .. 1 fully inhaled.
struct Orb: View {
    var pb: Double
    var label: String

    // The sphere breathes between ~0.58 and full; the halo brightens as it fills.
    private var scale: Double { 0.58 + 0.42 * pb }
    private var glow: Double { 0.12 + 0.30 * pb }

    var body: some View {
        ZStack {
            // Halo: a soft aura that grows and glows brighter on the inhale.
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Theme.bone.opacity(glow), .clear],
                        center: .center,
                        startRadius: 6,
                        endRadius: 58
                    )
                )
                .scaleEffect(1.12 * scale)
                .blur(radius: 6)

            // The lit sphere: highlight offset up-left so it reads as a round ball.
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.white.opacity(0.95), Theme.bone, Theme.sphereEdge],
                        center: UnitPoint(x: 0.36, y: 0.32),
                        startRadius: 2,
                        endRadius: 54
                    )
                )
                // Deepen the lower-right terminator so the volume rounds off.
                .overlay(
                    Circle().fill(
                        RadialGradient(
                            colors: [.clear, Theme.ink.opacity(0.26)],
                            center: UnitPoint(x: 0.68, y: 0.72),
                            startRadius: 16,
                            endRadius: 56
                        )
                    )
                )
                // A glossy specular dot near the top-left.
                .overlay(
                    Ellipse()
                        .fill(Color.white.opacity(0.8))
                        .frame(width: 13, height: 9)
                        .blur(radius: 4)
                        .offset(x: -15, y: -17)
                )
                .scaleEffect(scale)

            // The clock: dark on the light sphere, fixed size so it never jitters.
            Text(label)
                .font(.system(size: 19, weight: .medium, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(Theme.ink)
        }
        .frame(width: 104, height: 104)
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
