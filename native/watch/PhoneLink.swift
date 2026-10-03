// Watch-side WatchConnectivity link (1.4.1).
//
// Receives the phone's live playback state and sends play/pause/stop commands
// back to it. When `active` is true (a session is playing on the phone), the app
// shows the remote/mirror screen; otherwise it stays the standalone breathing
// pacer. Pure transport + published state, no UI.
//
// Combine is imported explicitly: on watchOS SwiftUI does not re-export it, and
// ObservableObject / @Published live there.

import Foundation
import WatchConnectivity
import Combine

final class PhoneLink: NSObject, ObservableObject, WCSessionDelegate {
    @Published var active = false        // is a phone session playing right now
    @Published var playing = false       // playing vs paused
    @Published var title = ""            // session label
    @Published var soundscape = ""       // soundscape label (human-readable)
    @Published var motif = ""            // soundscape id → picks the line-art motif
    @Published var remaining = 0         // whole seconds left (from the phone)
    @Published var total = 0             // whole seconds total
    @Published var breathPos = 0.0       // phone's breath cycle position (s) at snapshot
    @Published var breathTs = 0.0        // epoch ms when the snapshot was taken

    override init() {
        super.init()
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
    }

    // Send a command to the phone. Prefer a live message when reachable; fall back
    // to application context (delivered when the phone next wakes) otherwise.
    func send(_ action: String) {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        let msg = ["action": action]
        if s.isReachable {
            s.sendMessage(msg, replyHandler: nil, errorHandler: { _ in
                try? s.updateApplicationContext(msg)
            })
        } else {
            try? s.updateApplicationContext(msg)
        }
    }

    // Apply a state snapshot from the phone on the main thread (drives the UI).
    private func apply(_ d: [String: Any]) {
        // Ignore command echoes (the phone only ever sends state, but be safe).
        guard d["action"] == nil else { return }
        DispatchQueue.main.async {
            self.active = d["active"] as? Bool ?? false
            self.playing = d["playing"] as? Bool ?? false
            self.title = d["title"] as? String ?? ""
            self.soundscape = d["soundscape"] as? String ?? ""
            self.motif = d["motif"] as? String ?? ""
            self.remaining = d["remaining"] as? Int ?? 0
            self.total = d["total"] as? Int ?? 0
            self.breathPos = d["breathPos"] as? Double ?? 0
            self.breathTs = d["breathTs"] as? Double ?? 0
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        apply(message)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }

    // On watchOS this is the only required delegate stub (the inactive/deactivate
    // callbacks are iOS-only).
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}
}
