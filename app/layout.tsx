import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: `${BRAND.name} — Personalized Mindfulness`,
  description: `The way out is in. ${BRAND.name} writes you a mindfulness session in the moment, from your name, the time you have, and the state you want to reach, and speaks it aloud over a calming soundscape.`,
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    url: "/",
    title: `${BRAND.name} — Personalized Mindfulness`,
    description:
      "The way out is in. A mindfulness session composed for you in the moment, voiced aloud over a calming soundscape.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — Personalized Mindfulness`,
    description: "The way out is in.",
  },
};

export const viewport: Viewport = {
  themeColor: "#070912",
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
    <html lang="en" className={manrope.className}>
      <body>{children}</body>
    </html>
  );
}
