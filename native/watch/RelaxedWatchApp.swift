// relaxed watchOS app entry. One engine for the whole app; a tiny router swaps
// between the three screens. Dark, always (relaxed is dark-only).

import SwiftUI

@main
struct RelaxedWatchApp: App {
    @StateObject private var engine = SessionEngine()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(engine)
                .preferredColorScheme(.dark)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var engine: SessionEngine

    var body: some View {
        ZStack {
            Theme.ink.ignoresSafeArea()
            switch engine.screen {
            case .setup:
                SetupView()
            case .playing, .paused:
                SessionView()
            case .done:
                DoneView()
            }
        }
        .onAppear { engine.onAppear() }
    }
}
