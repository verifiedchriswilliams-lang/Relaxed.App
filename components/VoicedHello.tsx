"use client";

// The relaxed voiced first run (behind VOICED_HELLO_ENABLED). On open it plays the
// load video (the stem resolving into the orb), then hands off seamlessly to the live
// orb. One tap wakes it (unlocks audio + the orb speaks the greeting); then, where voice
// input is available, the orb listens for the spoken name (with a typed fallback).
//
// The orb reacts only to the APP's own voice level (via levelSource), never the mic.
// three.js loads only with this component, which the page imports lazily (ssr:false).

import { useEffect, useRef, useState } from "react";
import RingOrb from "@/components/RingOrb";

export interface VoicedHelloProps {
  step: "welcome" | "name";
  speaking: boolean;
  listening: boolean;
  canSpeak: boolean;
  onBegin: () => void;
  onListen: () => void;
  onType: () => void;
  /** The app's own voice output level, 0..1 (engine.voiceLevel). */
  voiceLevel: () => number;
  reduced?: boolean;
}

export default function VoicedHello({
  step,
  speaking,
  listening,
  canSpeak,
  onBegin,
  onListen,
  onType,
  voiceLevel,
  reduced,
}: VoicedHelloProps) {
  const [introDone, setIntroDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Fallback: if the video can't autoplay (or errors), don't trap the user on it.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const done = () => setIntroDone(true);
    v.addEventListener("ended", done);
    v.addEventListener("error", done);
    const safety = window.setTimeout(done, 8000); // never hang past the 6s video
    v.play?.().catch(() => {}); // muted autoplay is allowed; ignore rejection
    return () => {
      v.removeEventListener("ended", done);
      v.removeEventListener("error", done);
      window.clearTimeout(safety);
    };
  }, []);

  const mode = speaking ? "speaking" : listening ? "listening" : "idle";

  return (
    <div className="vhello" role="dialog" aria-label="Welcome">
      <RingOrb
        mode={mode}
        levelSource={voiceLevel}
        running={introDone}
        reduced={reduced}
        style={{ position: "absolute", inset: 0 }}
      />
      {!introDone && (
        <video
          ref={videoRef}
          className="vhello-video"
          src="/orb/intro.mp4"
          muted
          playsInline
          autoPlay
          preload="auto"
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (v.duration && v.currentTime >= v.duration - 0.1) setIntroDone(true);
          }}
        />
      )}

      <div className={`vhello-ui${introDone ? " ready" : ""}`}>
        {step === "welcome" ? (
          <button className="vhello-tap" onClick={onBegin} aria-label="Begin">
            <div className="vhello-copy">welcome to relaxed</div>
            <div className="vhello-hint">{speaking ? "" : "touch to begin"}</div>
          </button>
        ) : (
          <div className="vhello-name">
            <div className="vhello-copy">what should we call you?</div>
            {canSpeak && (
              <>
                <button
                  className={`vhello-mic${listening ? " on" : ""}`}
                  onClick={onListen}
                  disabled={listening}
                  aria-label="Say your name"
                >
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <path d="M12 18v3" />
                  </svg>
                </button>
                <div className="vhello-hint">{listening ? "listening…" : "tap and say your name"}</div>
              </>
            )}
            <button className="vhello-type" onClick={onType}>
              {canSpeak ? "or type instead" : "continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
