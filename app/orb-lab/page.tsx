"use client";

// Isolated development lab for the liquid-glass orb. Not linked from the app; open
// /orb-lab directly. Lets us study the orb against black and drive its states by hand
// (no voice service required). This is a deterministic dev harness — the "sim" toggle
// is clearly a stand-in, not real voice reactivity.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const LiquidGlassOrb = dynamic(() => import("@/lib/orb/LiquidGlassOrb"), {
  ssr: false,
});

type Mode = "idle" | "speaking" | "listening";

export default function OrbLabPage() {
  const [mode, setMode] = useState<Mode>("idle");
  const [manual, setManual] = useState(0);
  const [sim, setSim] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [level, setLevel] = useState(0);
  const simRef = useRef(0);

  // Simulated amplitude envelope (dev convenience only). A calm, speech-like
  // wander between ~0.2 and ~0.9 while "speaking".
  useEffect(() => {
    if (!sim) {
      setLevel(manual);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const env =
        0.45 +
        0.3 * Math.sin(t * 2.3) +
        0.15 * Math.sin(t * 5.1 + 1.0) +
        0.08 * Math.sin(t * 9.7);
      simRef.current = Math.max(0, Math.min(1, env));
      setLevel(simRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sim, manual]);

  const audioLevel = mode === "speaking" ? level : mode === "listening" ? level * 0.3 : 0;

  return (
    <div style={styles.root}>
      <div style={styles.canvasWrap}>
        <LiquidGlassOrb
          audioLevel={audioLevel}
          isSpeaking={mode === "speaking"}
          isListening={mode === "listening"}
          reducedMotion={reduced}
        />
      </div>

      <div style={styles.panel}>
        <div style={styles.row}>
          {(["idle", "speaking", "listening"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{ ...styles.chip, ...(mode === m ? styles.chipOn : null) }}
            >
              {m}
            </button>
          ))}
        </div>

        <label style={styles.label}>
          audio level {Math.round(level * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={manual}
            disabled={sim}
            onChange={(e) => setManual(parseFloat(e.target.value))}
            style={styles.range}
          />
        </label>

        <div style={styles.row}>
          <button
            onClick={() => setSim((s) => !s)}
            style={{ ...styles.chip, ...(sim ? styles.chipOn : null) }}
          >
            {sim ? "sim: on" : "sim: off"}
          </button>
          <button
            onClick={() => setReduced((r) => !r)}
            style={{ ...styles.chip, ...(reduced ? styles.chipOn : null) }}
          >
            reduced motion
          </button>
        </div>
        <div style={styles.hint}>
          dev harness · drive states by hand · sim is a stand-in, not real voice
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { position: "fixed", inset: 0, background: "#0a0908", overflow: "hidden" },
  canvasWrap: { position: "absolute", inset: 0 },
  panel: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "14px 16px",
    width: "min(420px, calc(100vw - 32px))",
    background: "rgba(20,18,15,0.6)",
    border: "1px solid rgba(239,235,227,0.12)",
    borderRadius: 16,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  },
  row: { display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" },
  chip: {
    font: "13px/1 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    letterSpacing: "0.04em",
    textTransform: "lowercase",
    color: "#b7b2a6",
    background: "rgba(239,235,227,0.05)",
    border: "1px solid rgba(239,235,227,0.14)",
    borderRadius: 999,
    padding: "9px 15px",
    cursor: "pointer",
  },
  chipOn: { color: "#121110", background: "#efebe3", borderColor: "#efebe3" },
  label: {
    font: "12px/1.6 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    letterSpacing: "0.04em",
    textTransform: "lowercase",
    color: "#9d988c",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  range: { width: "100%", accentColor: "#d8a85c" },
  hint: {
    font: "11px/1.4 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    letterSpacing: "0.05em",
    textTransform: "lowercase",
    color: "#6f6a60",
    textAlign: "center",
  },
};
