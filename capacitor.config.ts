import type { CapacitorConfig } from "@capacitor/cli";

// relaxed — iOS shell (Capacitor).
//
// A thin native wrapper that loads the live, hosted relaxed.app in a WKWebView.
// The app's script-writing (Claude) and voice (ElevenLabs) run as server APIs on
// Vercel, so the shell points at the hosted site and everything works, always up
// to date. Native config below adds the app-store polish: dark launch splash,
// light status-bar text on the Ink ground, and safe-area insets so content never
// sits under the notch or home indicator. Background audio (sessions keep playing
// when the screen locks) is enabled via Info.plist — see docs/ios-build.md.
const config: CapacitorConfig = {
  appId: "app.relaxed",
  appName: "relaxed",
  // Required by Capacitor even for a remote app; also the offline fallback bundle.
  webDir: "native/www",
  server: {
    url: "https://relaxed.app",
    cleartext: false,
  },
  backgroundColor: "#121110",
  // SINGLE OWNER OF THE SAFE-AREA INSET, and it is the NATIVE shell here.
  // `contentInset: "always"` makes the WKWebView inset the web content by the safe
  // area (status bar / Dynamic Island / home indicator), and the Ink background
  // fills those regions. Because the native side owns it, the PAGE must NOT also
  // add its own `env(safe-area-inset-*)` inset in the app, or the two stack and the
  // player header is pushed down. The page handles that: inside the iOS shell it
  // zeroes its --sat/--sab tokens (app/globals.css `html[data-native-ios]`, set
  // before paint by app/layout.tsx). On the hosted site in mobile Safari there is
  // no native inset, so the page owns it via env().
  //   Keep this in sync with that override AND with the SHIPPED binaries: the App
  //   Store build is compiled with this value, so flipping it silently double-insets
  //   (or overlaps) every already-installed build until it updates. Do not change
  //   it without shipping a matching binary at the same time.
  ios: {
    contentInset: "always",
    backgroundColor: "#121110",
  },
  plugins: {
    SplashScreen: {
      // Calm launch: hold the Ink splash a touch longer so the hosted page has
      // time to paint, then cross-fade it out rather than cutting hard. The
      // splash background is the same Ink as the app (#121110), so even if the
      // fade and first paint aren't perfectly synced there's no flash — the
      // ground never changes, only content settles in over it.
      launchShowDuration: 1500,
      launchAutoHide: true,
      launchFadeOutDuration: 700,
      backgroundColor: "#121110",
      showSpinner: false,
    },
    StatusBar: {
      // Light text/icons for the dark (Ink) ground. (Info.plist also sets this so
      // it applies without a JS call on the remote page — see the runbook.)
      style: "DARK",
    },
  },
};

export default config;
