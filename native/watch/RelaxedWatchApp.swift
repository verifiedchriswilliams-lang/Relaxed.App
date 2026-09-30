// relaxed watchOS app entry. One engine for the whole app; a tiny router swaps
// between the three screens. Dark, always (relaxed is dark-only).

import SwiftUI

@main
struct RelaxedWatchApp: App {
    @StateObject private var engine = SessionEngine()
    @StateObject private var phone = PhoneLink()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(engine)
                .environmentObject(phone)
                .preferredColorScheme(.dark)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var engine: SessionEngine
    @EnvironmentObject var phone: PhoneLink

    var body: some View {
        ZStack {
            Theme.ink.ignoresSafeArea()
            // When a session is playing on the phone, the watch becomes its remote
            // and mirror (1.4.1). Otherwise it's the standalone breathing pacer.
            if phone.active {
                RemoteView()
            } else {
                switch engine.screen {
                case .setup:
                    SetupView()
                case .playing, .paused:
                    SessionView()
                case .done:
                    DoneView()
                }
            }
        }
        .onAppear { engine.onAppear() }
    }
}
