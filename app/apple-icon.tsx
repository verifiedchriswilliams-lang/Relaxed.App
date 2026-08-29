import { ImageResponse } from "next/og";
import { tileDataUri } from "@/lib/iconArt";

// Brand-aware apple touch icon (home-screen tile), generated at build.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width="180" height="180" src={tileDataUri(180)} alt="" />
      </div>
    ),
    { ...size }
  );
}
