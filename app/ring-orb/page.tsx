"use client";

// Isolated dev route for the voice orb (not linked from the app). Lets us view the
// RingOrb component in the real Next.js build and drive it by hand: mode, a voice-level
// slider, a simulated voice, and the resting warmth. Nothing here ships in the product UI.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OrbMode } from "@/components/RingOrb";

const RingOrb = dynamic(() => import("@/components/RingOrb"), { ssr: false });

export default function RingOrbDevPage() {
  const [mode, setMode] = useState<OrbMode>("idle");
  const [level, setLevel] = useState(0);
  const [sim, setSim] = useState(false);
  const [angelic, setAngelic] = useState(0.8);
  const simRef = useRef<number | null>(null);

  // Simulated voice: a wobbling 0..1 level, only meaningful while "speaking".
  useEffect(() => {
    if (!sim) {
      if (simRef.current) cancelAnimationFrame(simRef.current);
      return;
    }
    const t0 = performance.now();
    const tick = () => {
      const n = (performance.now() - t0) / 1000;
      const v = Math.max(
        0,
        Math.min(1, 0.5 + 0.32 * Math.sin(n * 2.6) + 0.15 * Math.sin(n * 5.3 + 1) + 0.08 * Math.sin(n * 9.1)),
      );
      setLevel(v);
      simRef.current = requestAnimationFrame(tick);
    };
    simRef.current = requestAnimationFrame(tick);
    return () => {
      if (simRef.current) cancelAnimationFrame(simRef.current);
    };
  }, [sim]);

  const chip = (on: boolean): React.CSSProperties => ({
    font: "13px -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif",
    letterSpacing: ".04em",
    textTransform: "lowercase",
    color: on ? "#121110" : "#9d988c",
    background: on ? "#efebe3" : "rgba(239,235,227,.05)",
    border: `1px solid ${on ? "#efebe3" : "rgba(239,235,227,.14)"}`,
    borderRadius: 999,
    padding: "9px 15px",
    cursor: "pointer",
  });

  return (
    <main style={{ position: "fixed", inset: 0, background: "#121110", overflow: "hidden" }}>
      <RingOrb mode={mode} level={level} angelicQuiet={angelic} style={{ position: "absolute", inset: 0 }} />
      <div
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "max(18px, env(safe-area-inset-bottom))",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: "14px 16px",
          width: "min(420px, calc(100vw - 32px))",
          background: "rgba(20,18,15,.55)",
          border: "1px solid rgba(239,235,227,.12)",
          borderRadius: 16,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {(["idle", "speaking", "listening"] as OrbMode[]).map((m) => (
            <button key={m} style={chip(mode === m)} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
        <label style={{ font: "12px/1.6 -apple-system,sans-serif", color: "#9d988c", display: "flex", flexDirection: "column", gap: 6 }}>
          app voice level {Math.round(level * 100)}%
          <input type="range" min={0} max={1} step={0.01} value={level} style={{ width: "100%", accentColor: "#d8a85c" }} onChange={(e) => setLevel(parseFloat(e.target.value))} />
        </label>
        <label style={{ font: "12px/1.6 -apple-system,sans-serif", color: "#9d988c", display: "flex", flexDirection: "column", gap: 6 }}>
          angelic (quiet) {Math.round(angelic * 100)}%
          <input type="range" min={0} max={1} step={0.01} value={angelic} style={{ width: "100%", accentColor: "#d8a85c" }} onChange={(e) => setAngelic(parseFloat(e.target.value))} />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button style={chip(sim)} onClick={() => setSim((s) => !s)}>
            sim voice: {sim ? "on" : "off"}
          </button>
        </div>
        <div style={{ font: "11px/1.4 -apple-system,sans-serif", letterSpacing: ".05em", textTransform: "lowercase", color: "#6f6a60", textAlign: "center" }}>
          dev route - responds only while the app speaks (never the mic)
        </div>
      </div>
    </main>
  );
}
