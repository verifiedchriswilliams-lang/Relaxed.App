#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Declares the SpeechInput plugin + its methods to Capacitor's bridge. The Swift class
// (SpeechInputPlugin) is registered in MainViewController.capacitorDidLoad().
CAP_PLUGIN(SpeechInputPlugin, "SpeechInput",
           CAP_PLUGIN_METHOD(listen, CAPPluginReturnPromise);
)
