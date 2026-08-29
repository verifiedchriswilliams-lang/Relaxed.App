import { ImageResponse } from "next/og";
import { tileDataUri } from "@/lib/iconArt";

// Brand-aware favicon, generated at build. relaxed => stem on a dark Ink tile;
// ElevenMind => teal "11". Kept dynamic so one codebase serves both marks.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width="512" height="512" src={tileDataUri(512)} alt="" />
      </div>
    ),
    { ...size }
  );
}
