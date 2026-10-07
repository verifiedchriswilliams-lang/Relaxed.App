// relaxed — watch face complication (a watchOS Widget Extension target, watchOS 9+).
//
// A one-tap launcher on the watch face: the "r" stem mark that opens the relaxed
// watch app for a quick breather. It is a launcher, not live data, so the timeline
// is a single static entry with `.never` reload (no churn, no battery cost).
//
// Deliberately SELF-CONTAINED (its own Ink/Bone colors and its own copy of the stem
// mark) so the Widget Extension target needs only this one file — it does not share
// Theme.swift or the watch app's sources.
//
// Xcode: this belongs to a *Widget Extension* target, NOT the watch app target.
// See native/watch/README.md ("Watch-face widget") for the target setup.

import WidgetKit
import SwiftUI

// Ink/Bone, mirrored from Theme.swift / app/relaxed.css (kept local on purpose).
private let ink = Color(red: 0x12 / 255, green: 0x11 / 255, blue: 0x10 / 255)
private let bone = Color(red: 0xEF / 255, green: 0xEB / 255, blue: 0xE3 / 255)

// The stem "r": one open stroke on the 100x100 grid, matching lib/mark.tsx and the
// app icon (path M40 74 V40 C40 30 49 26 60 26). Drawn in a Canvas so the stroke
// width scales with the mark, exactly like SoundMotif.swift.
private struct StemMark: View {
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
            c.stroke(p, with: .color(bone), style: StrokeStyle(lineWidth: 13, lineCap: .butt))
        }
    }
}

struct RelaxedEntry: TimelineEntry { let date: Date }

struct RelaxedProvider: TimelineProvider {
    func placeholder(in context: Context) -> RelaxedEntry { RelaxedEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (RelaxedEntry) -> Void) {
        completion(RelaxedEntry(date: Date()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<RelaxedEntry>) -> Void) {
        // A launcher, not live data: one entry, never reload.
        completion(Timeline(entries: [RelaxedEntry(date: Date())], policy: .never))
    }
}

struct RelaxedWatchWidgetView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                StemMark().padding(7)
            }
        case .accessoryCorner:
            StemMark()
                .padding(3)
                .widgetLabel("relaxed")
        case .accessoryInline:
            // Inline is text-only; the system tints and positions it.
            Text("relaxed · breathe")
        case .accessoryRectangular:
            HStack(spacing: 8) {
                StemMark().frame(width: 22, height: 22)
                VStack(alignment: .leading, spacing: 1) {
                    Text("relaxed").font(.headline)
                    Text("take a breath").font(.caption2).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
        default:
            StemMark()
        }
    }
}

@main
struct RelaxedWatchWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "RelaxedWatchWidget", provider: RelaxedProvider()) { _ in
            RelaxedWatchWidgetView()
                // watchOS/iOS 17+ wants every widget to declare its background. The
                // watch face (and the circular family's own AccessoryWidgetBackground)
                // provide the real backdrop, so the container background is clear.
                .containerBackground(for: .widget) { Color.clear }
        }
        .configurationDisplayName("relaxed")
        .description("Open relaxed for a quick breather.")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryCorner,
            .accessoryInline,
            .accessoryRectangular,
        ])
    }
}

#Preview(as: .accessoryCircular) {
    RelaxedWatchWidget()
} timeline: {
    RelaxedEntry(date: .now)
}
