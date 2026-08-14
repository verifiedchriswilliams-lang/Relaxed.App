import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://elevenmind.io"),
  title: "ElevenMind — Personalized Mindfulness",
  description:
    "Personalized mindfulness, composed on demand. Every session is made for you, from your name, the time you have, and the state you want to reach, voiced aloud over a calming soundscape.",
  openGraph: {
    type: "website",
    siteName: "ElevenMind",
    url: "/",
    title: "ElevenMind — Personalized Mindfulness",
    description:
      "Personalized mindfulness, composed on demand. Every session made for you, voiced aloud over a calming soundscape.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ElevenMind — Personalized Mindfulness",
    description: "Personalized mindfulness, composed on demand.",
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
