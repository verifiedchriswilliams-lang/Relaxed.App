# Spatial audio — findings brief (research, not yet a plan)

> Reference for the roadmap "spatial audio" backlog item. Captures what turning
> relaxed.app into a spatial-audio experience would involve, the options, and what
> the source audio must be. **Decision-support only — no work is committed.**

**Bottom line:** convincing "enveloping calm" is achievable **entirely in the
browser** with the Web Audio API we already have, works the same in iOS Safari /
WKWebView, and needs **no native build**. True Apple Spatial Audio with head
tracking is **native-only** and would mean giving up the "hosted site reaches
everyone instantly" property for a real native audio pipeline. **Start web-side.**

## 1. Achievable purely in-browser
- **`PannerNode` with `panningModel: "HRTF"`** — binaural stereo via head-related
  impulse responses: place each source at an (x,y,z), move the `AudioListener` or
  panners slowly over time, renders with real sense of direction/height on
  headphones. Available since 2015; **works in iOS Safari/WKWebView.** Costs more
  CPU than the default `equalpower` model, but a handful of panners is fine.
- **`ConvolverNode`** — room/space reverb from an impulse response. This is what
  actually sells "enveloping" (a long, soft hall/forest IR reads as spaciousness
  more than motion does). Cheap, one node, universal.
- **`AudioListener` + gentle automation** — very slow orbits/drift (tens of seconds
  per cycle) or it turns gimmicky.
- **Realistic in-browser ceiling:** HRTF panners + convolution reverb + slow
  motion. "Pseudo-spatial" (no head tracking) but genuinely immersive on headphones.

### iOS Safari / WKWebView caveats to QA
- HRTF panner **works but has had sharp edges** — documented cases of `PannerNode`
  position changes having no spatial effect on some iOS Safari versions. Treat
  cross-version iOS behavior as a real-device QA item, not a given.
- **AudioContext sample-rate quirk:** iOS prefers 44.1 kHz; context/asset rate
  mismatch causes crackle. Keep context and stems at the same rate. (A separate
  WebKit regression distorts 44.1 kHz **+ AudioWorklet**; we don't use AudioWorklet,
  so it's avoidable.)
- **Multichannel decode is the real iOS limiter:** `decodeAudioData` of files with
  more than 2–3 channels (4-ch ambisonic, Atmos) "may not be supported on some
  mobile browsers." Anything HRTF-panned from **stereo/mono** sidesteps this.
- **System "Spatialize Stereo"** (AirPods/Control Center) applies to our WKWebView
  audio but is **not controllable or head-trackable from web code.** Design for
  plain stereo out; treat system spatialization as a bonus, not a feature we ship.

## 2. Apple Spatial Audio + head tracking (AirPods) from the web
- **Not reachable from Web Audio / WKWebView in any controllable way.** Head-tracked
  object audio is native-only: `AVAudioEngine` (`AVAudio3DMixingNode`), **PHASE**,
  and `CMHeadphoneMotionManager` for head pose. No web API for head tracking.
- The one web seam (multichannel `<video>`/`<audio>` handed to the system
  spatializer) is **file playback**, incompatible with our live-mixed dual-bus engine
  (streamed TTS voice + loop bed mixed in JS). Not a fit for on-the-fly sessions.
- **Cost of true native:** a native audio engine replacing the Web Audio mixer for
  spatial sessions; lose instant-web-delivery; App Store build/review for audio
  changes; a split codebase (web engine + native engine). Large and ongoing;
  Android/desktop gain nothing.

## 3. What the producer would deliver
| Option | Delivers | Enveloping calm | Complexity / iOS risk |
|---|---|---|---|
| **(a) Spatialize existing stereo/mono at runtime** | nothing new, or a few **mono point-source stems** | good, with convolution reverb; motion authored in code | **lowest** — all 2-ch, no iOS multichannel risk |
| **(b) Mono point-source stems + positions** | 3–6 dry **mono** stems/bed + a positions/motion spec | **best control** ("birds left-high, water behind") | low-med; mono decode is safe; more authoring ×24 |
| **(c) First-order ambisonic (B-format, ambiX/ACN-SN3D)** | one **4-ch** loop/bed, decoded to binaural via Omnitone/Resonance | genuinely enveloping, rotatable field, one asset/bed | **med-high, mostly iOS:** 4-ch decode may fail on mobile → needs a stereo fallback |
| **(d) Object-based / Dolby Atmos** | Atmos masters + object metadata | highest ceiling | **not web-deliverable;** native/system renderer; overkill for a calm loop |

**Read:** for a looping ambient bed, the envelope comes far more from **reverb/space
+ a couple of slowly-moving sources** than from full-sphere accuracy. So **(a)/(b)
buy ~80% of the felt effect** for a fraction of the cost and zero iOS multichannel
risk. Ambisonic **(c)** is the "correct" immersive format and best per-asset
envelope, but its payoff assumes headphones and it collides with iOS multichannel
decode, so it's a fast-follow, not the first step. **(d)** is out of scope for a web
app.

## 4. Tiers
| Tier | Effort | Sounds like | Delivery | iOS risk |
|---|---|---|---|---|
| **1 — In-browser pseudo-spatial** (HRTF panners + slow motion + convolution reverb on existing/lightly-reworked stems) | **S–M** | wider, taller, "in a calm space"; sources gently drift; no head tracking | **web**, no native build | **low** — verify HRTF panner across iOS versions on-device |
| **2 — Ambisonic beds → binaural in Web Audio** (new FOA loops via Omnitone/Resonance) | **M–L** (new masters ×up to 24 + fallback) | cohesive full-sphere envelope on headphones | **web**, still no native build | **med-high** — 4-ch decode unreliable on mobile → must ship stereo fallback |
| **3 — Native Apple Spatial Audio + head tracking** (AVAudioEngine/PHASE + `CMHeadphoneMotionManager`) | **L+** (new native pipeline, ongoing) | sound stays fixed as you turn your head; true Apple spatial | **native only** — breaks the web-shell model, iOS-only | it *is* the native build; large maintenance + codebase split |

## 5. Recommendation
**Ship Tier 1 first.** HRTF `PannerNode` + a soft convolution reverb + very slow
authored motion, on a few stems pulled out of the existing beds:
- no new audio stack (fits the dual-bus mixer — spatialize the ambient bus, keep the
  voice bus centered/near),
- no native build, no loss of instant web delivery,
- no iOS multichannel-decode risk (stays stereo/mono),
- one device-QA item (confirm the HRTF panner animates across current iOS versions).

Prove the aesthetic there. If it lands, treat **Tier 2 (ambisonic + stereo
fallback)** as a per-bed content upgrade behind the same engine. Reserve **Tier 3
(native head tracking)** only if it becomes a headline product bet.

**Cheapest producer input to make Tier 1 sound intentional:** for 2–4 flagship beds,
deliver **3–5 dry mono point-source stems + a positions/motion note**, plus one
**long, soft reverb impulse response** per "space."

When this is actually built, it touches `lib/audio/**`, so update
[audio-engine.md](./audio-engine.md) in the same change.

## Sources
MDN [PannerNode.panningModel](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/panningModel)
· MDN [Web audio spatialization basics](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics)
· [Omnitone](https://github.com/GoogleChrome/omnitone/blob/master/README.md)
· [Resonance Audio (web)](https://resonance-audio.github.io/resonance-audio/develop/web/developer-guide)
· Apple [Immerse your app in Spatial Audio (WWDC21)](https://developer.apple.com/videos/play/wwdc2021/10265/)
· Apple [Generating spatial audio from a multichannel stream](https://developer.apple.com/documentation/AudioToolbox/generating-spatial-audio-from-a-multichannel-audio-stream)
· Apple Support [Control Spatial Audio and head tracking](https://support.apple.com/guide/airpods/control-spatial-audio-and-head-tracking-dev00eb7e0a3/web)
· WebKit [bug 274507](https://bugs.webkit.org/show_bug.cgi?id=274507)
· Apple Developer Forums [PannerNode on iOS Safari](https://developer.apple.com/forums/thread/696034)
· Wikipedia [Ambisonics](https://en.wikipedia.org/wiki/Ambisonics)
