import Foundation
import Capacitor
import WatchConnectivity

// Phone-side WatchConnectivity bridge for the Apple Watch remote (1.4.1).
//
// The web layer (lib/watchRemote.ts) reaches this as Capacitor.Plugins.WatchBridge:
//   updateState({active, playing, title, soundscape, remaining, total})
//       -> pushed to the watch as the latest state
// and the plugin emits a "command" event ({ action: "play" | "pause" | "stop" })
// whenever the watch sends one, which the web routes to the same play/pause/stop
// the lock screen uses. Everything is best-effort: if there's no paired watch or
// the session isn't active, updateState simply no-ops after caching the latest.
@objc(WatchBridgePlugin)
public class WatchBridgePlugin: CAPPlugin, WCSessionDelegate {

    private var session: WCSession?
    // Cache the latest snapshot so a watch that launches or reconnects can be
    // synced immediately (on activation / reachability change).
    private var latest: [String: Any] = ["active": false]

    override public func load() {
        guard WCSession.isSupported() else { return }
        let s = WCSession.default
        s.delegate = self
        s.activate()
        session = s
    }

    @objc func updateState(_ call: CAPPluginCall) {
        var state: [String: Any] = [:]
        state["active"] = call.getBool("active") ?? false
        state["playing"] = call.getBool("playing") ?? false
        state["title"] = call.getString("title") ?? ""
        state["soundscape"] = call.getString("soundscape") ?? ""
        state["remaining"] = call.getInt("remaining") ?? 0
        state["total"] = call.getInt("total") ?? 0
        latest = state
        send(state)
        call.resolve()
    }

    // applicationContext always overwrites with the newest snapshot and is
    // delivered when the watch next wakes; sendMessage gives an instant update when
    // the watch is reachable (foreground). Use both, both best-effort.
    private func send(_ state: [String: Any]) {
        guard let s = session, s.activationState == .activated else { return }
        try? s.updateApplicationContext(state)
        if s.isReachable {
            s.sendMessage(state, replyHandler: nil, errorHandler: { _ in })
        }
    }

    // MARK: - WCSessionDelegate (commands from the watch)

    public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        emitCommand(message)
    }

    public func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        emitCommand(applicationContext)
    }

    private func emitCommand(_ payload: [String: Any]) {
        guard let action = payload["action"] as? String else { return }
        DispatchQueue.main.async {
            self.notifyListeners("command", data: ["action": action])
        }
    }

    // Resync the watch whenever it (re)connects or finishes activating.
    public func sessionReachabilityDidChange(_ session: WCSession) {
        if session.isReachable { send(latest) }
    }

    public func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        if state == .activated { send(latest) }
    }

    // iOS-only stubs; re-activate for a newly paired watch.
    public func sessionDidBecomeInactive(_ session: WCSession) {}
    public func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }
}
