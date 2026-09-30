#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registers the Swift plugin with Capacitor under the name "WatchBridge", so the
// web reaches it as Capacitor.Plugins.WatchBridge. updateState() returns a Promise;
// the "command" event is delivered to JS via addListener("command", ...).
CAP_PLUGIN(WatchBridgePlugin, "WatchBridge",
  CAP_PLUGIN_METHOD(updateState, CAPPluginReturnPromise);
)
