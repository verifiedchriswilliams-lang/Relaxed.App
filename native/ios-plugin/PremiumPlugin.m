#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Registers the Swift plugin with Capacitor's bridge under the name "Premium",
// so the web reaches it as Capacitor.Plugins.Premium. Each method returns a
// Promise (the CAPPluginCall resolves with { entitled: Bool }).
CAP_PLUGIN(PremiumPlugin, "Premium",
  CAP_PLUGIN_METHOD(getEntitlement, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(purchase, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(restore, CAPPluginReturnPromise);
)
