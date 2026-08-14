import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ElevenMind: guided sessions, composed on demand",
  description:
    "Personalized mindfulness. Every session is written fresh for you, from your name, the time you have, and the state you want to reach, then voiced aloud.",
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
