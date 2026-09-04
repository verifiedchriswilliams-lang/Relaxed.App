import { ImageResponse } from "next/og";
import { artworkDataUri } from "@/lib/iconArt";

// Full-bleed square PNG used as the lock-screen / Control Center "Now Playing"
// artwork (see lib/native.ts). Served over the web so it works in the installed
// app (which loads the hosted site) without a native build.
export const runtime = "edge";

export function GET(request: Request) {
  const category = new URL(request.url).searchParams.get("c") ?? undefined;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width="512" height="512" src={artworkDataUri(512, category)} alt="" />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
