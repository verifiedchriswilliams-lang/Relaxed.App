# Shipping relaxed to the App Store (iOS)

This is the runbook for turning relaxed.app into a native iOS app and submitting
it. The app is a **thin Capacitor shell** that loads the live, hosted
`https://relaxed.app` in a WKWebView — so the whole product (Claude script
writing, ElevenLabs voice, audio, personalization) runs from the site you already
deploy, and the native app is packaging + polish.

> **Everything below runs on your Mac.** The repo is already scaffolded
> (`capacitor.config.ts`, icon/splash sources in `assets/`, native fallback in
> `native/www/`). You generate the Xcode project locally and submit from there.

## What you need

- A **Mac** with the latest **Xcode** (from the App Store).
- **CocoaPods**: `sudo gem install cocoapods` (or `brew install cocoapods`).
- An active **Apple Developer Program** membership ($99/yr).
- **Node 18+** and this repo cloned locally.

---

## 1. One-time setup

From the repo root on your Mac:

```bash
npm install                       # pulls in the Capacitor packages
npx cap add ios                   # generates the native ios/ Xcode project
npm run ios:assets                # builds the AppIcon + splash from assets/
npm run ios:sync                  # copies config + web fallback into the project
```

- `npx cap add ios` creates `ios/` (an Xcode project). Commit it (the `.gitignore`
  already excludes Pods, build output, and copied web assets).
- `npm run ios:assets` runs `@capacitor/assets` over `assets/icon.png` (1024²) and
  `assets/splash.png` / `assets/splash-dark.png` (2732²) to produce every icon and
  launch-screen size. Re-run it whenever the mark changes.

## 2. Info.plist — three edits

Open `ios/App/App/Info.plist` (in Xcode or a text editor) and add/confirm:

1. **Display name** — so the home-screen label reads `relaxed`:
   ```xml
   <key>CFBundleDisplayName</key>
   <string>relaxed</string>
   ```

2. **Background audio** — so sessions keep playing when the screen locks or the
   app is backgrounded (pairs with the `audioSession` handling already in the web
   app):
   ```xml
   <key>UIBackgroundModes</key>
   <array>
     <string>audio</string>
   </array>
   ```

3. **Light status-bar text** on the Ink ground:
   ```xml
   <key>UIStatusBarStyle</key>
   <string>UIStatusBarStyleLightContent</string>
   <key>UIViewControllerBasedStatusBarAppearance</key>
   <false/>
   ```

(App Transport Security needs no changes — the app only talks to `https://`.)

## 3. Xcode — sign & test

```bash
npm run ios:open                  # opens ios/App/App.xcworkspace
```

- Select the **App** target → **Signing & Capabilities**:
  - Check **Automatically manage signing**, pick your **Team**.
  - **Bundle Identifier**: `app.relaxed` (must match what you create in App Store
    Connect below; change it here and in `capacitor.config.ts` if you want a
    different one).
  - Confirm **Background Modes → Audio** is present (from the Info.plist edit).
- Set **Minimum Deployments** to **iOS 16.4** or later. (The mute-switch /
  background-audio fix uses the `audioSession` API, which is iOS 16.4+. On older
  iOS the app still runs; audio just won't override the ring/silent switch.)
- Run on the **Simulator**, then a **real device**. Check: it loads relaxed.app,
  a session plays, audio continues when you lock the screen, the splash and icon
  look right, and content clears the notch and home indicator.

## 4. App Store Connect — create the app

At [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → +**:

- **Name**: `relaxed` (this must be unique across the App Store — if it's taken,
  fall back to `relaxed.app` or `relaxed — mindfulness`).
- **Bundle ID**: `app.relaxed` (register it under **Certificates, IDs & Profiles**
  first if it isn't listed).
- **Primary category**: Health & Fitness (secondary: Lifestyle).
- **Privacy Policy URL**: **required.** You need a public privacy page — see the
  note at the bottom; I can add `relaxed.app/privacy` for you.
- **App Privacy** questionnaire: the app collects essentially nothing —
  - the name a user types is stored **on their device** (localStorage), not sent
    anywhere identifiable;
  - Vercel **Web Analytics** records anonymous, aggregate page views (no
    cross-app tracking, no advertising ID).
  Answer accordingly (no data "linked to identity", no tracking).
- **Export compliance**: the app uses only standard HTTPS encryption →
  choose the **exempt** option (add `ITSAppUsesNonExemptEncryption = NO` to
  Info.plist to skip the prompt on every upload).
- **Screenshots**: capture on a 6.7" device/simulator (home, tray, a playing
  session) — the dark UI shots look great.

## 5. Archive & upload

In Xcode:

1. Set the run destination to **Any iOS Device (arm64)**.
2. **Product → Archive**.
3. When the Organizer opens: **Distribute App → App Store Connect → Upload**.
4. Back in App Store Connect, attach the build to the version, fill in the
   description, keywords, and support URL, then **Submit for Review**.

## 6. Review notes (read this — it's the one real risk)

Apple's guideline **4.2 (minimum functionality)** can flag apps that are "just a
website in a wrapper." In the **App Review notes**, describe what makes this a
real app, not a bookmark:

> relaxed generates a **bespoke guided meditation on demand** — it writes a
> unique script for the user's stated intention and time, voices it with
> real-time speech synthesis, and mixes it live over a continuous soundscape with
> background playback that continues when the device is locked. There is no login;
> open it and start a session.

No demo account is needed (there's no sign-in). If review pushes back, the honest
levers are: emphasize the real-time generated audio + background playback, and add
a small native touch (e.g. a haptic on session start via `@capacitor/haptics`) —
ask me and I'll wire it in.

---

## Updating later

Because this is a shell over the live site, **most changes ship with a normal
Vercel deploy** — no new App Store build needed. You only cut a new iOS build when
you change something **native**: the icon/splash (`assets/` → `npm run ios:assets`),
the app config (`capacitor.config.ts` → `npm run ios:sync`), or an Info.plist
capability. Then re-archive and upload.

## Open item: privacy policy

The App Store requires a public **Privacy Policy URL**. The app collects almost
nothing, but you still need the page. Say the word and I'll add a
`relaxed.app/privacy` route (brand-styled, plain-English: name stored locally,
anonymous analytics, audio generated per session, no accounts, no selling data)
so you have a URL to paste into App Store Connect.
