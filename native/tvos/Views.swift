// The two screens for the Apple TV app: a focus-driven home (pick a soundscape + a
// length, begin) and a full-screen ambient session (a big breathing orb with the
// soundscape line art, the bed looping underneath). Lean-back and spare: the Siri
// Remote's play/pause toggles, Menu ends the session.

import SwiftUI

// MARK: - Home

struct HomeView: View {
    @EnvironmentObject var engine: SessionEngine

    private let columns = Array(repeating: GridItem(.fixed(240), spacing: 28), count: 5)

    var body: some View {
        VStack(spacing: 44) {
            Text("relaxed")
                .font(.system(size: 68, weight: .regular, design: .rounded))
                .foregroundStyle(Theme.bone)
                .padding(.top, 24)

            ScrollView {
                VStack(alignment: .leading, spacing: 34) {
                    ForEach(Catalog.families) { family in
                        let items = Catalog.freeBeds(in: family.id)
                        if !items.isEmpty {
                            Text(family.label)
                                .font(.system(size: 26, weight: .medium))
                                .foregroundStyle(Theme.boneDim)
                            LazyVGrid(columns: columns, alignment: .leading, spacing: 28) {
                                ForEach(items) { bed in
                                    BedCard(bed: bed, selected: engine.selected.id == bed.id) {
                                        engine.selected = bed
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 90)
                .padding(.bottom, 20)
            }

            HStack(spacing: 20) {
                ForEach(engine.lengths, id: \.self) { m in
                    Button(m <= 0 ? "open" : "\(m) min") { engine.minutes = m }
                        .buttonStyle(.borderedProminent)
                        .tint(engine.minutes == m ? Theme.bone : Theme.hair)
                        .foregroundStyle(engine.minutes == m ? Theme.ink : Theme.bone)
                }
            }

            Button("begin") { engine.begin() }
                .buttonStyle(.borderedProminent)
                .tint(Theme.bone)
                .foregroundStyle(Theme.ink)
                .font(.system(size: 28, weight: .semibold))
                .padding(.bottom, 30)
        }
    }
}

// A pickable soundscape tile: the line-art motif + the name, with a ring when it's the
// chosen bed. `.card` gives the standard tvOS focus lift.
struct BedCard: View {
    let bed: Bed
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 12) {
                SoundMotif(id: bed.id)
                    .frame(width: 96, height: 96)
                Text(bed.label)
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(Theme.bone)
                    .lineLimit(1)
            }
            .frame(width: 220, height: 180)
            .background(Theme.bone.opacity(0.06))
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(selected ? Theme.bone : Color.clear, lineWidth: 4)
            )
            .clipShape(RoundedRectangle(cornerRadius: 20))
        }
        .buttonStyle(.card)
    }
}

// MARK: - Session

struct SessionView: View {
    @EnvironmentObject var engine: SessionEngine

    var body: some View {
        ZStack {
            Theme.ink.ignoresSafeArea()

            TimelineView(.animation(paused: engine.paused)) { context in
                let t = context.date.timeIntervalSince(engine.breathStart)
                let b = Breath.at(t)
                VStack(spacing: 46) {
                    Text(engine.paused ? "paused" : cue(b.phase))
                        .font(.system(size: 30, weight: .regular, design: .rounded))
                        .foregroundStyle(Theme.boneDim)
                        .animation(.easeInOut(duration: 0.4), value: b.phase)

                    BigOrb(pb: b.pb, motif: engine.selected.id, t: t)

                    VStack(spacing: 10) {
                        Text(engine.selected.label)
                            .font(.system(size: 28))
                            .foregroundStyle(Theme.boneDim)
                        if !engine.isInfinite {
                            Text(timeString(engine.remaining))
                                .font(.system(size: 44, weight: .medium, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(Theme.bone)
                        }
                        if engine.player.failed {
                            Text("sound unavailable")
                                .font(.system(size: 18))
                                .foregroundStyle(Theme.boneDim)
                        }
                    }
                }
            }
        }
        .onPlayPauseCommand { engine.togglePause() }
        .onExitCommand { engine.end() }
    }

    private func cue(_ phase: Breath.Phase) -> String {
        switch phase {
        case .inhale: return "breathe in"
        case .hold: return "hold"
        case .exhale: return "breathe out"
        }
    }

    private func timeString(_ s: Int) -> String {
        String(format: "%d:%02d", s / 60, s % 60)
    }
}

// The big-screen breathing visual: a soft glow + a ring that breathes on the shared
// cadence, with the soundscape line art held steady inside it. `pb` is 0 (fully
// exhaled) .. 1 (fully inhaled / held).
struct BigOrb: View {
    var pb: Double
    var motif: String
    var t: Double

    private var scale: Double { 0.74 + 0.26 * pb }
    private var glow: Double { 0.72 + 0.28 * pb }

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(
                    colors: [Theme.warm.opacity(0.12 * glow), .clear],
                    center: .center, startRadius: 40, endRadius: 360))
                .frame(width: 740, height: 740)
                .blur(radius: 46)
                .scaleEffect(scale)

            Circle()
                .fill(RadialGradient(
                    colors: [Theme.bone.opacity(0.10 * glow), .clear],
                    center: .center, startRadius: 20, endRadius: 280))
                .frame(width: 560, height: 560)
                .blur(radius: 26)
                .scaleEffect(scale)

            Circle()
                .stroke(Theme.bone.opacity(0.5), lineWidth: 3)
                .frame(width: 440, height: 440)
                .scaleEffect(scale)

            SoundMotif(id: motif, t: t)
                .frame(width: 340, height: 340)
                .opacity(0.92)
        }
        .frame(width: 780, height: 780)
    }
}
