// Keeps the session running while the wrist is down, via a mindfulness extended
// runtime session. Requires the "Mindfulness" background mode on the watch target
// (Signing & Capabilities → Background Modes, or WKBackgroundModes = ["mindfulness"]
// in Info.plist — see README). If the mode isn't granted, start() simply fails and
// the app still runs normally while it's on screen; the session is a graceful
// enhancement, not a hard dependency.

import WatchKit

final class ExtendedRuntime: NSObject, WKExtendedRuntimeSessionDelegate {
    private var session: WKExtendedRuntimeSession?

    func start() {
        // Don't stack sessions.
        if let s = session, s.state == .running || s.state == .scheduled { return }
        let s = WKExtendedRuntimeSession()
        s.delegate = self
        session = s
        s.start()
    }

    func stop() {
        session?.invalidate()
        session = nil
    }

    // Delegate hooks (required conformance). Nothing to do for a self-contained
    // breathing session; we drive our own timer.
    func extendedRuntimeSessionDidStart(_ session: WKExtendedRuntimeSession) {}
    func extendedRuntimeSessionWillExpire(_ session: WKExtendedRuntimeSession) {}
    func extendedRuntimeSession(
        _ session: WKExtendedRuntimeSession,
        didInvalidateWith reason: WKExtendedRuntimeSessionInvalidationReason,
        error: Error?
    ) {
        self.session = nil
    }
}
