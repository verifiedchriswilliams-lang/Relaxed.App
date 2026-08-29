import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

// Brand-aware share card, generated at build so each deployment (ElevenMind /
// relaxed.app) gets its own name while keeping the ElevenLabs / ElevenMusic
// credit. relaxed uses the "stem" identity (warm Ink, Bone stem, no accent);
// ElevenMind keeps the aurora + teal "11".
export const runtime = "edge";
export const alt = `${BRAND.name} — Personalized Mindfulness`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function RelaxedCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#121110",
        position: "relative",
      }}
    >
      {/* the stem mark */}
      <svg width="150" height="150" viewBox="0 0 100 100" style={{ marginBottom: 34 }}>
        <path
          d="M40 74 V40 C40 30 49 26 60 26"
          fill="none"
          stroke="#EFEBE3"
          strokeWidth="13"
          strokeLinecap="butt"
        />
      </svg>
      {/* wordmark */}
      <div style={{ display: "flex", fontSize: 74, letterSpacing: 1 }}>
        <div style={{ display: "flex", color: "#EFEBE3", fontWeight: 400 }}>
          {BRAND.strong}
        </div>
        <div style={{ display: "flex", color: "#8B857C", fontWeight: 400 }}>
          {BRAND.light}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 27,
          color: "rgba(239,235,227,0.72)",
          marginTop: 26,
        }}
      >
        The way out is in.
      </div>
    </div>
  );
}

function ElevenMindCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#070d16",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            "radial-gradient(120% 80% at 50% 28%, rgba(47,214,168,0.30), rgba(7,13,22,0) 60%)",
        }}
      />
      <div
        style={{
          width: 150,
          height: 150,
          borderRadius: 9999,
          marginBottom: 30,
          display: "flex",
          backgroundImage:
            "radial-gradient(circle at 50% 45%, #ffffff, #cbb8f2 42%, rgba(150,130,240,0) 72%)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", fontSize: 66 }}>
        <div style={{ display: "flex", marginRight: 16 }}>
          <div
            style={{ width: 11, height: 46, borderRadius: 2, backgroundColor: "#5ff0cd", marginRight: 8 }}
          />
          <div style={{ width: 11, height: 46, borderRadius: 2, backgroundColor: "#5ff0cd" }} />
        </div>
        <div style={{ display: "flex", color: "#ffffff", fontWeight: 700 }}>
          {BRAND.strong}
        </div>
        <div style={{ display: "flex", color: "rgba(245,246,252,0.82)", fontWeight: 400 }}>
          {BRAND.light}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: "rgba(245,246,252,0.78)", marginTop: 24 }}>
        The way out is in.
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 36,
          display: "flex",
          fontSize: 18,
          color: "rgba(245,246,252,0.55)",
        }}
      >
        Voiced by ElevenLabs · scored with ElevenMusic
      </div>
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    BRAND.id === "relaxed" ? <RelaxedCard /> : <ElevenMindCard />,
    { ...size }
  );
}
