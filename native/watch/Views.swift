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
            .tint(Theme.bone)
            .foregroundStyle(Theme.ink)
        }
        .padding(.horizontal, 6)
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

            ZStack {
                Circle()
                    .stroke(Theme.hair, lineWidth: 1)
                Circle()
                    .fill(Theme.bone.opacity(0.9))
                    // 0 exhaled -> 1 inhaled maps to a gentle 0.42..1.0 scale.
                    .scaleEffect(0.42 + 0.58 * engine.pb)
                Text(timeString(engine.remaining))
                    .font(.system(size: 15, weight: .medium, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
            }
            .frame(width: 96, height: 96)

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
                .tint(Theme.bone)
                .foregroundStyle(Theme.ink)
                .padding(.top, 2)
        }
        .padding(.horizontal, 6)
    }
}
