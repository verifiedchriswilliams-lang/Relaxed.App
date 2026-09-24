import UIKit
import Capacitor

// Registers the app-local PremiumPlugin with Capacitor's bridge.
//
// Why this exists: Capacitor 6+ does NOT auto-discover plugins by scanning the
// Objective-C runtime (older Capacitor did). At launch the bridge registers only
// its built-ins plus the npm Capacitor plugins listed in capacitor.config.json's
// `packageClassList` (filled by `cap sync`). PremiumPlugin lives in the App
// target — it is not an npm package — so it never lands in that list and is
// never registered. The `CAP_PLUGIN` macro in PremiumPlugin.m only makes the
// class CONFORM to the bridge protocol; it does not register it.
//
// `capacitorDidLoad()` is the documented hook for registering an embedded
// plugin. For it to run, Main.storyboard's bridge view controller must use this
// class: select the view controller in Main.storyboard, open the Identity
// inspector, and set Custom Class to `MainViewController`.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PremiumPlugin())
    }
}
