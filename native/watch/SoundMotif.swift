// Per-soundscape line motifs for the watch remote (1.4.2), ported from
// lib/soundMotifs.tsx. Same language as the phone: a single Bone stroke, no fill
// except the small accent dots, drawn on the shared 100x100 grid and scaled to the
// view. Geometry mirrors the web one-to-one (the identity Chris wants on the wrist).
//
// Motion (1.4.1 polish): the view drives a time `t` (the phone-synced breath clock,
// see RemoteView) into the drawing, so the motifs are no longer frozen. The two
// motions that read clearly on a small, low-contrast line are ported here:
//   • wave DRIFT  — every wave() glides one period sideways and loops seamlessly
//                   (ocean, wind, brook, and the frequency family), the web m-drift.
//   • accent PULSE — campfire embers and the ambient (pad) rings breathe in opacity
//                   (web m-pulse).
// The remaining per-element web motions (spin, sway, chime, bob, ripple, pluck,
// fall, flash, swirl, shimmer) are still drawn statically; they are a finer blind
// port best tuned with eyes on a real watch.

import SwiftUI

// Seconds for a wave to drift one full period, and the pulse periods.
private let kDriftSecs: Double = 7

private func pulse(_ t: Double, _ period: Double, _ delay: Double, _ lo: Double, _ hi: Double) -> Double {
    let p = sin((t - delay) / period * 2 * .pi) * 0.5 + 0.5 // 0..1
    return lo + (hi - lo) * p
}

// MARK: - Drawing helpers (operate in the 100x100 grid on a scaled context)

private func mstroke(_ c: inout GraphicsContext, _ p: Path, _ w: CGFloat, _ op: Double) {
    c.stroke(p, with: .color(Theme.bone.opacity(op)),
             style: StrokeStyle(lineWidth: w, lineCap: .round, lineJoin: .round))
}
private func mfill(_ c: inout GraphicsContext, _ p: Path, _ op: Double = 1) {
    c.fill(p, with: .color(Theme.bone.opacity(op)))
}
private func mline(_ c: inout GraphicsContext, _ x1: CGFloat, _ y1: CGFloat, _ x2: CGFloat, _ y2: CGFloat, _ w: CGFloat = 1.2, _ op: Double = 1) {
    var p = Path(); p.move(to: CGPoint(x: x1, y: y1)); p.addLine(to: CGPoint(x: x2, y: y2))
    mstroke(&c, p, w, op)
}
private func msCircle(_ c: inout GraphicsContext, _ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat, _ w: CGFloat = 1.2, _ op: Double = 1) {
    mstroke(&c, Path(ellipseIn: CGRect(x: cx - r, y: cy - r, width: 2 * r, height: 2 * r)), w, op)
}
private func mfCircle(_ c: inout GraphicsContext, _ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat, _ op: Double = 1) {
    mfill(&c, Path(ellipseIn: CGRect(x: cx - r, y: cy - r, width: 2 * r, height: 2 * r)), op)
}
private func msRoundRect(_ c: inout GraphicsContext, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ rx: CGFloat, _ lw: CGFloat = 1.2) {
    mstroke(&c, Path(roundedRect: CGRect(x: x, y: y, width: w, height: h), cornerRadius: rx), lw, 1)
}
private func axis(_ c: inout GraphicsContext) { mline(&c, 10, 50, 90, 50, 1.0, 0.32) }

// A sine-ish wave path (mirrors wave() in soundMotifs.tsx): one Q then reflected
// T (smooth) quads, drawn wider than the grid so the ends never show in the ring.
// `drift` shifts the whole wave left (0 .. one period) for the seamless glide.
private func wavePath(_ y: CGFloat, _ amp: CGFloat, _ step: CGFloat, _ drift: CGFloat) -> Path {
    var p = Path()
    var x = -2 * step - drift
    p.move(to: CGPoint(x: x, y: y))
    let c1 = CGPoint(x: x + step * 0.5, y: y - amp)
    let e1 = CGPoint(x: x + step, y: y)
    p.addQuadCurve(to: e1, control: c1)
    var pc = c1, pp = e1
    x += step
    while x < 140 {
        x += step
        let e = CGPoint(x: x, y: y)
        let ctrl = CGPoint(x: 2 * pp.x - pc.x, y: 2 * pp.y - pc.y) // reflect prev control
        p.addQuadCurve(to: e, control: ctrl)
        pc = ctrl; pp = e
    }
    return p
}
private func wave(_ c: inout GraphicsContext, _ t: Double, _ y: CGFloat, _ amp: CGFloat, _ step: CGFloat, _ op: Double = 1) {
    let period = 2 * step
    var drift = CGFloat((t / kDriftSecs).truncatingRemainder(dividingBy: 1)) * period
    if drift < 0 { drift += period }
    mstroke(&c, wavePath(y, amp, step, drift), 1.2, op)
}

// Build a Path from move + a list of quad segments (to, control).
private func quads(_ start: CGPoint, _ segs: [(CGPoint, CGPoint)], close: Bool = false) -> Path {
    var p = Path(); p.move(to: start)
    for (to, ctrl) in segs { p.addQuadCurve(to: to, control: ctrl) }
    if close { p.closeSubpath() }
    return p
}

// MARK: - The motifs

private func drawMotif(_ id: String, _ t: Double, _ c: inout GraphicsContext) {
    switch id {
    // ---- Nature ----
    case "rain":
        for pt in [(38.0, 38.0), (50, 34), (62, 38), (44, 42), (56, 42)] {
            mline(&c, pt.0, pt.1, pt.0 - 3, pt.1 + 14)
        }
    case "ocean":
        mstroke(&c, quads(CGPoint(x: 16, y: 57), [
            (CGPoint(x: 40, y: 43), CGPoint(x: 32, y: 57)),
            (CGPoint(x: 60, y: 36), CGPoint(x: 47, y: 31)),
            (CGPoint(x: 66, y: 51), CGPoint(x: 71, y: 40)),
            (CGPoint(x: 53, y: 54), CGPoint(x: 61, y: 58)),
            (CGPoint(x: 52, y: 46), CGPoint(x: 47, y: 51)),
        ]), 1.2, 1)
        mfCircle(&c, 61, 36, 1.5)
        wave(&c, t, 63, 3, 18)
        wave(&c, t, 70, 2.4, 18, 0.8)
    case "wind":
        wave(&c, t, 40, 3, 20)
        var sw = Path(); sw.move(to: CGPoint(x: 24, y: 50)); sw.addLine(to: CGPoint(x: 56, y: 50))
        sw.addCurve(to: CGPoint(x: 57, y: 40), control1: CGPoint(x: 64, y: 50), control2: CGPoint(x: 64, y: 40))
        sw.addCurve(to: CGPoint(x: 58, y: 48), control1: CGPoint(x: 51, y: 40), control2: CGPoint(x: 52, y: 48))
        mstroke(&c, sw, 1.2, 1)
        wave(&c, t, 60, 3, 20)
    case "thunder":
        mstroke(&c, quads(CGPoint(x: 33, y: 52), [
            (CGPoint(x: 27, y: 45), CGPoint(x: 26, y: 52)),
            (CGPoint(x: 34, y: 40), CGPoint(x: 27, y: 39)),
            (CGPoint(x: 44, y: 32), CGPoint(x: 35, y: 31)),
            (CGPoint(x: 56, y: 33), CGPoint(x: 50, y: 27)),
            (CGPoint(x: 66, y: 41), CGPoint(x: 66, y: 31)),
            (CGPoint(x: 71, y: 49), CGPoint(x: 73, y: 42)),
            (CGPoint(x: 64, y: 52), CGPoint(x: 70, y: 52)),
        ], close: true), 1.2, 1)
        var bolt = Path(); bolt.move(to: CGPoint(x: 50, y: 52)); bolt.addLine(to: CGPoint(x: 44, y: 62))
        bolt.addLine(to: CGPoint(x: 50, y: 62)); bolt.addLine(to: CGPoint(x: 44, y: 72))
        mstroke(&c, bolt, 1.6, 1)
    case "windchimes":
        mline(&c, 31, 28, 65, 28)
        let xs: [CGFloat] = [34, 41, 48, 55, 62]
        let y2s: [CGFloat] = [72, 76, 73, 75, 70]
        for i in 0..<xs.count { mline(&c, xs[i], 28, xs[i], y2s[i]) }
    case "birdsong":
        mstroke(&c, quads(CGPoint(x: 30, y: 43), [
            (CGPoint(x: 42, y: 43), CGPoint(x: 36, y: 36)),
            (CGPoint(x: 54, y: 43), CGPoint(x: 48, y: 36)),
        ]), 1.2, 1)
        mstroke(&c, quads(CGPoint(x: 50, y: 33), [
            (CGPoint(x: 58, y: 33), CGPoint(x: 54, y: 28.5)),
            (CGPoint(x: 66, y: 33), CGPoint(x: 62, y: 28.5)),
        ]), 1.2, 1)
        mstroke(&c, quads(CGPoint(x: 37, y: 56), [
            (CGPoint(x: 45, y: 56), CGPoint(x: 41, y: 51.5)),
            (CGPoint(x: 53, y: 56), CGPoint(x: 49, y: 51.5)),
        ]), 1.2, 1)
    case "brook":
        wave(&c, t, 43, 2.4, 16)
        wave(&c, t, 52, 2.4, 15)
        wave(&c, t, 61, 2.4, 16)
        msCircle(&c, 43, 52, 4)
        msCircle(&c, 60, 47, 4)
    case "campfire":
        mline(&c, 35, 69, 62, 61)
        mline(&c, 38, 61, 65, 69)
        mstroke(&c, quads(CGPoint(x: 50, y: 60), [
            (CGPoint(x: 46, y: 40), CGPoint(x: 39, y: 51)),
            (CGPoint(x: 50, y: 38), CGPoint(x: 49, y: 33)),
            (CGPoint(x: 57, y: 39), CGPoint(x: 52, y: 29)),
            (CGPoint(x: 50, y: 60), CGPoint(x: 63, y: 50)),
        ], close: true), 1.2, 1)
        mfCircle(&c, 45, 31, 1.6, pulse(t, 2.2, 0, 0.3, 1))
        mfCircle(&c, 56, 28, 1.4, pulse(t, 2.2, 1.6, 0.3, 1))

    // ---- Music ----
    case "bowls":
        mstroke(&c, quads(CGPoint(x: 27, y: 54), [(CGPoint(x: 73, y: 54), CGPoint(x: 50, y: 40))]), 1.2, 1)
        mstroke(&c, quads(CGPoint(x: 30, y: 51), [(CGPoint(x: 70, y: 51), CGPoint(x: 50, y: 39))]), 1.2, 1)
        mstroke(&c, quads(CGPoint(x: 33, y: 48), [(CGPoint(x: 67, y: 48), CGPoint(x: 50, y: 38))]), 1.2, 1)
        mstroke(&c, quads(CGPoint(x: 33, y: 60), [(CGPoint(x: 67, y: 60), CGPoint(x: 50, y: 78))]), 1.6, 1)
        mline(&c, 33, 60, 67, 60, 1.6)
    case "pad":
        msCircle(&c, 50, 50, 12, 1.2, pulse(t, 4.2, 0, 0.3, 0.85))
        msCircle(&c, 50, 50, 20, 1.2, pulse(t, 4.2, 1.4, 0.3, 0.85))
        msCircle(&c, 50, 50, 28, 1.2, pulse(t, 4.2, 2.8, 0.3, 0.85))
    case "piano":
        let x0: CGFloat = 27, w: CGFloat = 46, keys: CGFloat = 7
        let kw = w / keys, top: CGFloat = 42, h: CGFloat = 22
        msRoundRect(&c, x0, top, w, h, 1.5)
        for i in 1...6 { mline(&c, x0 + CGFloat(i) * kw, top, x0 + CGFloat(i) * kw, top + h) }
        let bw = kw * 0.56, bh = h * 0.6
        for i in [1, 2, 4, 5, 6] as [CGFloat] {
            mfill(&c, Path(roundedRect: CGRect(x: x0 + i * kw - bw / 2, y: top, width: bw, height: bh), cornerRadius: 0.8))
        }
    case "lofi":
        msCircle(&c, 50, 50, 21)
        msCircle(&c, 50, 50, 6.5)
        mfCircle(&c, 50, 50, 1.7)
        mline(&c, 50, 29, 50, 33.5)
    case "harp":
        mline(&c, 35, 26, 35, 72)
        mstroke(&c, quads(CGPoint(x: 35, y: 26), [(CGPoint(x: 62, y: 40), CGPoint(x: 54, y: 24))]), 1.2, 1)
        mline(&c, 35, 72, 62, 40)
        for s in [(42.0, 28.0, 65.0), (48, 31, 58), (54, 35, 50)] {
            mline(&c, s.0, s.1, s.0, s.2)
        }
        var wv = Path(); wv.move(to: CGPoint(x: 66, y: 32)); wv.addQuadCurve(to: CGPoint(x: 66, y: 48), control: CGPoint(x: 76, y: 40))
        mstroke(&c, wv, 1.2, 0.9)
    case "strings":
        for y in [41.0, 48, 55, 62] as [CGFloat] { mline(&c, 30, y, 70, y) }
        mline(&c, 36, 34, 64, 68)
    case "kalimba":
        mline(&c, 30, 62, 70, 62)
        let tops: [CGFloat] = [46, 41, 37, 33, 37, 41, 46]
        for i in 0..<tops.count {
            let x = 34 + CGFloat(i) * 5.3
            mline(&c, x, 62, x, tops[i])
        }
    case "flute":
        mline(&c, 28, 53, 66, 53, 1.6)
        mfCircle(&c, 31, 53, 1.7)
        for x in [39.0, 47, 55, 62] as [CGFloat] { mfCircle(&c, x, 53, 1.4) }
        msCircle(&c, 70, 47, 3.2)
        msCircle(&c, 75, 42, 2.4)

    // ---- Frequencies (oscilloscope family: a faint centre axis) ----
    case "brown":
        axis(&c)
        let hs: [CGFloat] = [6, 10, 7, 12, 8, 11, 7, 13, 8, 10, 7, 9, 6]
        for i in 0..<hs.count {
            let x = 29 + CGFloat(i) * 3.5
            mline(&c, x, 50 - hs[i] / 2, x, 50 + hs[i] / 2)
        }
    case "pad432":
        axis(&c); wave(&c, t, 50, 5, 10)
    case "binaural":
        axis(&c); wave(&c, t, 50, 7, 16); wave(&c, t, 50, 7, 16.9, 0.75)
    case "delta":
        axis(&c); wave(&c, t, 52, 16, 32)
    case "theta":
        axis(&c); wave(&c, t, 50, 9, 17)
    case "whitenoise":
        axis(&c)
        let hs: [CGFloat] = [10, 16, 8, 18, 12, 20, 9, 17, 13, 19, 10, 16, 8, 15, 11, 18, 9]
        for i in 0..<hs.count {
            let x = 27 + CGFloat(i) * 2.8
            mline(&c, x, 50 - hs[i] / 2, x, 50 + hs[i] / 2)
        }
    case "green":
        axis(&c)
        let hs: [CGFloat] = [8, 13, 9, 14, 10, 12, 8, 15, 9, 13, 10, 11, 8, 12, 9]
        for i in 0..<hs.count {
            let x = 28 + CGFloat(i) * 3.1
            mline(&c, x, 50 - hs[i] / 2, x, 50 + hs[i] / 2)
        }
    case "alpha":
        axis(&c); wave(&c, t, 50, 7, 15)

    default:
        wave(&c, t, 50, 8, 20) // calm single wave for any id without a bespoke motif
    }
}

// MARK: - View

// The line-art motif for a soundscape, drawn on the 100x100 grid, Bone on Ink.
// `t` is the phone-synced breath clock (seconds); it drives the wave drift and the
// accent pulse, and is 0 (static) when nothing is driving it.
struct SoundMotif: View {
    var id: String
    var t: Double = 0

    var body: some View {
        Canvas { context, size in
            let s = min(size.width, size.height) / 100.0
            context.scaleBy(x: s, y: s)
            // Keep wave ends / overflow inside the ring.
            context.clip(to: Path(ellipseIn: CGRect(x: 8, y: 8, width: 84, height: 84)))
            drawMotif(id, t, &context)
        }
    }
}
