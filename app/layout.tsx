import type { Metadata, Viewport } from "next";
import { Manrope, Figtree } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { BRAND } from "@/lib/brand";
import "./globals.css";
import "./relaxed.css";

// ElevenMind's face: Manrope, light weights for the big words.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// relaxed's face: Figtree (SIL OFL), self-hosted by next/font at build. Exposed
// as a CSS variable so the [data-brand="relaxed"] layer can point --font at it
// without disturbing ElevenMind.
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--rx-font-family",
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: `${BRAND.name} · Personalized Mindfulness`,
  description: `The way out is in. ${BRAND.name} writes you a mindfulness session in the moment, from your name, the time you have, and the state you want to reach, and speaks it aloud over a calming soundscape.`,
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    url: "/",
    title: `${BRAND.name} · Personalized Mindfulness`,
    description:
      "The way out is in. A mindfulness session composed for you in the moment, voiced aloud over a calming soundscape.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} · Personalized Mindfulness`,
    description: "The way out is in.",
  },
};

export const viewport: Viewport = {
  // Both brands are single dark worlds: relaxed on Ink, ElevenMind on night blue.
  themeColor: BRAND.id === "relaxed" ? "#121110" : "#070912",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-brand={BRAND.id}
      className={`${manrope.className} ${figtree.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
