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
  // Draw edge to edge in the native shell so the dark ground fills behind the
  // status bar and home indicator, and make the safe-area insets resolve to real
  // values (env(safe-area-inset-*)) so chrome clears the status bar / Dynamic
  // Island and the home indicator. Without this the top bars under-clear the
  // island on modern iPhones.
  viewportFit: "cover",
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
        {BRAND.id === "relaxed" && (
          // Pre-paint anti-flash cover. Runs synchronously before React hydrates and, when
          // the voiced first-run overlay is going to show (mirroring the page's own gate),
          // paints an Ink cover (html.vh-booting) so the classic home never flashes in the
          // gap before the mount effect sets `hello`. The page removes the class once its own
          // Ink cover (.vh-prefill) is committed. No-ops (and shows nothing) when voiced is off.
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{
  var d=document.documentElement;
  if(d.getAttribute('data-brand')!=='relaxed')return;
  var ls=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
  var p=new URLSearchParams(location.search),vq=p.get('voiced');
  var voiced=${process.env.NEXT_PUBLIC_VOICED_HELLO === "1" ? "true" : "false"}||vq==='1'||(vq!=='0'&&ls('relaxed.voiced.v1')==='1');
  if(!voiced)return;
  var forced=vq==='1';
  var name='';try{name=(JSON.parse(ls('elevenmind.prefs.v1')||'{}')||{}).name||''}catch(e){}
  var hadName=!!(name&&(''+name).trim());
  var seenHello=ls('relaxed.hello.v1')==='1';
  var recentLen=0;try{recentLen=(JSON.parse(ls('relaxed.recent.v1')||'[]')||[]).length}catch(e){}
  if(forced||(!hadName&&!seenHello)||(hadName&&recentLen>0))d.classList.add('vh-booting');
}catch(e){}})();`,
            }}
          />
        )}
        {children}
        <Analytics />
      </body>
    </html>
  );
}
