# relaxed — Apple TV app (tvOS V1)

A **native tvOS (SwiftUI)** ambient companion for the living room. Like the watch, it
is a genuinely native build (tvOS has no WKWebView, so the Capacitor/Web-Audio app
can't run here) that shares the App Store listing. Targeted for the **1.5** submission.

**What V1 does:**

1. **Pick a soundscape** — the 15 free beds (Nature / Music / Frequencies), each shown
   with its line-art motif, chosen with the Siri Remote (focus engine).
2. **Pick a length** — 10 / 20 / 30 / 60 minutes, or open-ended.
3. **Breathe on the big screen** — a full-screen luminous orb breathes on the same
   6s-in / 2.5s-hold / 6s-out cadence as the phone (`lib/breath.ts`), with the
   soundscape's line art held inside a breathing ring, while the bed loops underneath.
4. **Controls** — the remote's **play/pause** toggles; **Menu** ends the session and
   returns home. A length countdown ends the session on its own.

The bed audio streams from the same Vercel Blob store the web + phone use, and each bed
is played at its **measured loudness gain** (the same `normGain` normalization as the
web, `lib/audio/levels.ts`), so beds sit at an even level.

**Not in V1** (deferred to tvOS v2, by design):

- **Guided AI voice / full sessions.** The voice pipeline (generate → ElevenLabs → mix
  under the bed with ducking + loudness) is a large native port, exactly why the watch
  shipped silent first. The breathing orb already makes V1 a *guided* breathing session,
  not just a sound player. V2 can add the voice over the same bed engine.
- **Premium beds + IAP.** The 9 premium beds are in the catalog data but filtered out of
  the picker; a StoreKit entitlement isn't ported to tvOS yet. V1 ships the 15 free beds.
- **HealthKit.** tvOS has no HealthKit, so no Mindful-Minutes logging (that stays a
  watch/phone feature).

## Files (the whole app)

| File | What it is |
|---|---|
| `RelaxedTVApp.swift` | `@main` App + the 2-screen router |
| `Views.swift` | `HomeView` (soundscape + length picker), `SessionView` (the big breathing orb), `BedCard`, `BigOrb` |
| `SessionEngine.swift` | State machine: selected bed, length, countdown, play/pause/end |
| `AudioEngine.swift` | `BedPlayer` — downloads a bed, applies its loudness gain, loops it via `AVAudioEngine` |
| `Catalog.swift` | The 24-bed catalog + `normGain` + the Blob host `Config` (mirrors `lib/audio/soundscapes.ts` / `levels.ts`) |
| `SoundMotif.swift` | The soundscape line-art motifs (shared language with the watch) |
| `Theme.swift` | Ink/Bone tokens + the breath cadence (mirrors `lib/breath.ts`) |

> As with the watch and the StoreKit plugin, `ios/` is generated on the Mac and is
> **not** committed (see the repo `.gitignore`). So the tvOS target + these files must
> be re-added if `ios/` is ever regenerated.

## Before you build: set the Blob host (required for sound)

Open `Catalog.swift` and set `Config.blobBase` to your store's **public** base URL (the
`NEXT_PUBLIC_BLOB_BASE_URL` value from Vercel, e.g.
`https://xxxxxxxx.public.blob.vercel-storage.com`). It's a public, non-secret value
(that's what the `NEXT_PUBLIC_` prefix means). Without it the app runs the breathing
visual **silently** and shows a small "sound unavailable" note, so you'll know.

```swift
// Catalog.swift
static let blobBase = "https://xxxxxxxx.public.blob.vercel-storage.com"
```

(Find it in Vercel → the relaxed project → Settings → Environment Variables, or in
`docs/operations-runbook.md`.)

## Xcode setup (a new target, done once on the Mac)

1. `npm run ios:open` to open `ios/App/App.xcworkspace`.
2. **File → New → Target… → tvOS → App.** Name it **`relaxed TV`**.
   - Interface **SwiftUI**, Language **Swift**, Life Cycle **SwiftUI App**.
   - Leave "Include Tests" unchecked. Activate the new scheme when asked.
3. Xcode generates a template `…App.swift` and `ContentView.swift` for the tvOS target.
   **Delete both** (Move to Trash) — ours replace them, and two `@main` types won't
   compile.
4. **Add these source files** to the **`relaxed TV`** target: drag the `.swift` files
   from `native/tvos/` into the target's group. When prompted: **Copy items if needed**,
   target = **`relaxed TV`** only. (Same copy-sync story as the watch: Xcode compiles its
   own copies under `ios/`, so after pulling a change to `native/tvos/*.swift`, re-copy
   them into the target folder.)
5. **Deployment target: tvOS 16.0** (or your floor; the app uses `Canvas`, `TimelineView`,
   async `URLSession.download`, which need tvOS 15+; 16 is a safe modern floor).
6. **Swift Language Version: Swift 5** for the tvOS target (as with the watch). The audio
   loader hands a decoded `AVAudioPCMBuffer` from a background task back to the main
   actor; under Swift 6 strict concurrency that needs extra annotations, so stay on
   Swift 5 for now.
7. **Background audio:** on the `relaxed TV` target → **Signing & Capabilities →
   + Capability → Background Modes → check "Audio, AirPlay, and Picture in Picture"** so
   the bed keeps playing. (`BedPlayer.configureSession()` sets the `AVAudioSession`
   category to `.playback`.)
8. Pick the **`relaxed TV`** scheme + an **Apple TV simulator** (or a real Apple TV) and
   **Run**.

**Expect:** the home screen (the "relaxed" wordmark, the soundscape grid, a length row,
`begin`) → choose a bed with the remote, press `begin` → a full-screen breathing orb
with the soundscape line art, the bed looping, a countdown → **play/pause** toggles,
**Menu** returns home.

## Caveats to verify on device / in the simulator

- **FLAC decoding + download.** The beds are FLAC. tvOS has decoded FLAC since tvOS 11,
  and `BedPlayer` **downloads** the whole bed, then decodes + loops it locally (rather
  than progressive streaming), which sidesteps remote-FLAC streaming quirks. Confirm a
  bed loads and loops seamlessly; if a specific bed won't decode, that's the thing to
  check first. (Beds are short seamless loops, so the full download + in-memory PCM is
  small; a pathologically long bed would use more memory.)
- **Loudness.** Gains are the measured `normGain` values from `levels.ts`. A few very
  quiet nature beds carry large make-up gains; `normGain` caps them under the peak
  ceiling so they don't clip, but verify nothing is jarring at a normal TV volume.
- **Focus feel.** The soundscape tiles use the standard tvOS `.card` button style and the
  length/begin buttons use `.borderedProminent`, so focus is the system default. Give it
  a pass with the remote to confirm the focus order reads naturally.

## App Store (Guideline 4.2 / minimum functionality)

V1 is a real experience, not a web wrapper: 15 soundscapes, a guided breathing visual on
the same cadence as the phone, and session timing, all native. It's a companion to the
approved iOS app and shares the listing. Submission notes should emphasize the native
breathing + ambient-audio experience (and that guided voice is coming). If review pushes
on functionality, the fast follow is tvOS v2's guided voice over the same bed engine.
