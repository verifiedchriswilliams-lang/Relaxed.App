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
}

export default function PlayOrb({ soundscape, className, style, ...orb }: PlayOrbProps) {
  return (
    <div className={className ? `orb-play ${className}` : "orb-play"} style={style}>
      <RingOrb texture="play" {...orb} />
      {soundscape ? <SoundMotif id={soundscape} className="core" /> : null}
    </div>
  );
}
