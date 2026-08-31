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
  ios: {
    // Inset the web content within the safe areas so the Ink status-bar and
    // home-indicator regions are painted by the native background, not overlapped.
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
