// relaxed on Apple TV: app entry + a tiny router between the home (pick a soundscape
// and a length) and the ambient session. One engine for the whole app. Dark, always
// (relaxed is dark-only).

import SwiftUI

@main
struct RelaxedTVApp: App {
    @StateObject private var engine = SessionEngine()

    var body: some Scene {
        WindowGroup {
            ZStack {
                Theme.ink.ignoresSafeArea()
                switch engine.screen {
                case .home:
                    HomeView()
                case .session:
                    SessionView()
                }
            }
            .environmentObject(engine)
            .preferredColorScheme(.dark)
        }
    }
}
