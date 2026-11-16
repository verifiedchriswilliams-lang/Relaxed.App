"use client";

// Throwaway diagnostic route (not linked anywhere, no production impact): isolates WHY
// getUserMedia throws InvalidStateError inside the voiced flow but works on a plain page.
// Each button is its own user gesture. Test the baseline first, then set up a condition on
// one tap and grab the mic on the next, so audio-session state is separated from the
// user-activation requirement. Remove once the cause is found.

import { useRef, useState } from "react";

export default function MicTest() {
  const [log, setLog] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const add = (s: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${s}`, ...l]);

  // The real thing: first-await getUserMedia, nothing before it (matches requestMic).
  const micNow = async () => {
    add("getUserMedia(audio) ...");
    try {
      const m = await navigator.mediaDevices.getUserMedia({ audio: true });
      m.getTracks().forEach((t) => t.stop());
      add("✅ GRANTED");
    } catch (e) {
      const err = e as { name?: string; message?: string };
      add(`❌ ${err?.name ?? "?"}: ${err?.message ?? ""}`);
    }
  };

  // Condition A: create + resume an AudioContext (sets the audio session to playback), on
  // its own gesture. Then tap "mic now" to see if that state breaks getUserMedia.
  const makeCtx = async () => {
    try {
      const AC =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return add("no AudioContext ctor");
      const ctx = ctxRef.current ?? new AC();
      ctxRef.current = ctx;
      await ctx.resume().catch(() => {});
      add(`AudioContext created, state=${ctx.state}`);
    } catch (e) {
      add(`ctx err: ${String((e as { message?: string })?.message ?? e)}`);
    }
  };

  // Condition B: play the intro video (muted, silent track) once, on its own gesture.
  const playVideo = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.play();
      add("video playing");
      window.setTimeout(() => {
        v.pause();
        add("video paused");
      }, 400);
    } catch (e) {
      add(`video.play err: ${String((e as { message?: string })?.message ?? e)}`);
    }
  };

  const btn: React.CSSProperties = {
    padding: "14px 16px",
    fontSize: 16,
    borderRadius: 12,
    border: "1px solid #5a554e",
    background: "#1e1c1a",
    color: "#efebe3",
    textAlign: "left",
  };

  return (
    <main
      style={{
        padding: 20,
        fontFamily: "ui-monospace, Menlo, monospace",
        color: "#efebe3",
        background: "#121110",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>mic isolation test</h1>
      <p style={{ fontSize: 13, color: "#b8b2a8", maxWidth: 360 }}>
        Tap 1 first (baseline). Then to test a condition: reload, tap 2 (or 3), then tap 1
        again. Watch for GRANTED vs an error name.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360, margin: "18px 0" }}>
        <button style={btn} onClick={micNow}>1 · get mic now (baseline)</button>
        <button style={btn} onClick={makeCtx}>2 · create + resume AudioContext</button>
        <button style={btn} onClick={playVideo}>3 · play intro video once</button>
        <button style={btn} onClick={() => setLog([])}>clear log</button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5 }}>{log.join("\n")}</pre>
      <video
        ref={videoRef}
        src="/orb/intro.mp4"
        muted
        playsInline
        preload="auto"
        style={{ width: 120, opacity: 0.4, marginTop: 12 }}
      />
    </main>
  );
}
