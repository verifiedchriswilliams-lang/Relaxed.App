"use client";

// The session orb (relaxed voiced experience, behind the flag). The living RingOrb
// warps the quieted-core frame (public/orb/calm-play.png) so the chosen soundscape's
// line motif can glow in the centre, made of the same light, while the ribbons go on
// reacting to the app's own voice. The motif holds steady (its own gentle loop); the
// breath lives in the orb/ring, not the motif. A "none" voice session simply omits the
// motif prop to show the quieted core alone, or passes the soundscape to keep a living
// centre even with no voice.
//
// Import lazily (next/dynamic, ssr:false) like RingOrb so three.js stays out of the
// main bundle.

import RingOrb, { type RingOrbProps } from "@/components/RingOrb";
import { SoundMotif } from "@/lib/soundMotifs";

export interface PlayOrbProps extends Omit<RingOrbProps, "texture"> {
  /** Soundscape id whose motif glows in the core (e.g. "rain"). Omit for a bare core. */
  soundscape?: string;
  /** When true, the orb scales gently with the breath clock (the page's --pb var); the
   *  motif stays steady. The breath lives in the orb, not the sound. */
  breathing?: boolean;
}

export default function PlayOrb({ soundscape, breathing, className, style, ...orb }: PlayOrbProps) {
  const cls = ["orb-play", breathing ? "breathing" : "", className].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style}>
      <div className="orb-canvas">
        <RingOrb texture="play" {...orb} />
      </div>
      {soundscape ? <SoundMotif id={soundscape} className="core" /> : null}
    </div>
  );
}
