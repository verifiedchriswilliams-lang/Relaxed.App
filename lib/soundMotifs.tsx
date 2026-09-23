import React from "react";

// Per-soundscape line motifs for the relaxed.app player, drawn in the stem
// mark's language: a single stroke weight, flat caps, no fill, currentColor so
// they follow the theme. Each sits inside the breathing session ring and carries
// one honest motion true to its sound. No colour, no photograph. Geometry
// validated in the design preview.

// A sine-ish wave path. Period = 2*step; drifting one period (--drift) loops
// seamlessly. Drawn wider than the viewBox so the ends never show in the ring.
function wave(y: number, amp: number, step: number): string {
  let x = -2 * step;
  let d = `M${x} ${y} Q${x + step * 0.5} ${y - amp} ${x + step} ${y}`;
  x += step;
  while (x < 140) {
    x += step;
    d += ` T${x} ${y}`;
  }
  return d;
}

function Wave({ y, amp, step, dur }: { y: number; amp: number; step: number; dur: number }) {
  return (
    <path
      className="s thin m-drift"
      style={{ "--drift": `${2 * step}px`, animationDuration: `${dur}s` } as React.CSSProperties}
      d={wave(y, amp, step)}
    />
  );
}

const AXIS = <line className="axis" x1={10} y1={50} x2={90} y2={50} />;

function Piano() {
  const x0 = 27;
  const w = 46;
  const keys = 7;
  const kw = w / keys;
  const top = 42;
  const h = 22;
  const bk = [1, 2, 4, 5, 6];
  const bw = kw * 0.56;
  const bh = h * 0.6;
  return (
    <>
      <rect className="s thin" x={x0} y={top} width={w} height={h} rx={1.5} />
      {Array.from({ length: keys - 1 }).map((_, i) => {
        const x = x0 + (i + 1) * kw;
        return <line key={i} className="s thin" x1={x} y1={top} x2={x} y2={top + h} />;
      })}
      {bk.map((i, j) => (
        <rect
          key={j}
          className="fillc m-shimmer"
          x={x0 + i * kw - bw / 2}
          y={top}
          width={bw}
          height={bh}
          rx={0.8}
          style={{ animationDelay: `${j * 0.3}s` }}
        />
      ))}
    </>
  );
}

type Inner = React.ReactNode;

const MOTIFS: Record<string, Inner> = {
  // ---- Nature ----
  rain: (
    <>
      {[
        [38, 38],
        [50, 34],
        [62, 38],
        [44, 42],
        [56, 42],
      ].map(([x, y], i) => (
        <line
          key={i}
          className="s thin m-fall"
          x1={x}
          y1={y}
          x2={x - 3}
          y2={y + 14}
          style={{ animationDelay: `${i * 0.42}s` }}
        />
      ))}
    </>
  ),
  // A crested wave breaking above two flowing current lines. The crest gently
  // swells (bob) while the currents drift beneath it.
  ocean: (
    <>
      <g className="m-swirl">
        <path
          className="s thin"
          d="M16 57 Q32 57 40 43 Q47 31 60 36 Q71 40 66 51 Q61 58 53 54 Q47 51 52 46"
        />
        <circle className="fillc" cx={61} cy={36} r={1.5} />
      </g>
      <Wave y={63} amp={3} step={18} dur={8} />
      <path
        className="s thin m-drift"
        style={{ "--drift": "36px", animationDuration: "11s", opacity: 0.8 } as React.CSSProperties}
        d={wave(70, 2.4, 18)}
      />
    </>
  ),
  // Flat flowing lines with one swirl gust in the middle.
  wind: (
    <>
      <Wave y={40} amp={3} step={20} dur={5} />
      <g className="m-swirl">
        <path className="s thin" d="M24 50 H56 C64 50 64 40 57 40 C51 40 52 48 58 48" />
      </g>
      <Wave y={60} amp={3} step={20} dur={7} />
    </>
  ),
  thunder: (
    <>
      <path
        className="s thin"
        d="M33 52 Q26 52 27 45 Q27 39 34 40 Q35 31 44 32 Q50 27 56 33 Q66 31 66 41 Q73 42 71 49 Q70 52 64 52 Z"
      />
      <path className="s m-flash" d="M50 52 L44 62 L50 62 L44 72" />
    </>
  ),
  // Larger chimes hung from the bar; each sways from its top, neighbours meeting.
  windchimes: (
    <>
      <line className="s thin" x1={31} y1={28} x2={65} y2={28} />
      {[
        [34, 72],
        [41, 76],
        [48, 73],
        [55, 75],
        [62, 70],
      ].map(([x, y2], i) => (
        <line
          key={i}
          className="s thin m-chime"
          x1={x}
          y1={28}
          x2={x}
          y2={y2}
          style={{ transformOrigin: "center top", animationDelay: `${(i % 2) * 2.5}s` }}
        />
      ))}
    </>
  ),

  // Three distant birds gliding, each bobbing gently on its own beat.
  birdsong: (
    <>
      {[
        ["M30 43 Q36 36 42 43 Q48 36 54 43", 0],
        ["M50 33 Q54 28.5 58 33 Q62 28.5 66 33", 0.9],
        ["M37 56 Q41 51.5 45 56 Q49 51.5 53 56", 1.8],
      ].map(([d, delay], i) => (
        <path
          key={i}
          className="s thin m-bob"
          style={{ animationDelay: `${delay}s` }}
          d={d as string}
        />
      ))}
    </>
  ),
  // Gentle parallel currents with two slow eddies rippling open.
  brook: (
    <>
      <Wave y={43} amp={2.4} step={16} dur={7} />
      <Wave y={52} amp={2.4} step={15} dur={9} />
      <Wave y={61} amp={2.4} step={16} dur={8} />
      <circle className="s thin m-ripple" cx={43} cy={52} r={4} />
      <circle
        className="s thin m-ripple"
        cx={60}
        cy={47}
        r={4}
        style={{ animationDelay: "2.3s" }}
      />
    </>
  ),
  // Two crossed logs, a flame swaying above, embers pulsing off the tip.
  campfire: (
    <>
      <line className="s thin" x1={35} y1={69} x2={62} y2={61} />
      <line className="s thin" x1={38} y1={61} x2={65} y2={69} />
      <path className="s thin m-sway" d="M50 60 Q39 51 46 40 Q49 33 50 38 Q52 29 57 39 Q63 50 50 60 Z" />
      <circle className="fillc m-pulse" cx={45} cy={31} r={1.6} />
      <circle
        className="fillc m-pulse"
        cx={56}
        cy={28}
        r={1.4}
        style={{ animationDelay: "1.6s" }}
      />
    </>
  ),

  // ---- Music ----
  bowls: (
    <>
      {[
        [3.4, "M27 54 Q50 40 73 54"],
        [1.7, "M30 51 Q50 39 70 51"],
        [0, "M33 48 Q50 38 67 48"],
      ].map(([delay, d], i) => (
        <path
          key={i}
          className="s thin m-ripple"
          style={{ animationDelay: `${delay}s` }}
          d={d as string}
        />
      ))}
      <path className="s" d="M33 60 Q50 78 67 60" />
      <path className="s" d="M33 60 L67 60" />
    </>
  ),
  pad: (
    <>
      {[12, 20, 28].map((r, i) => (
        <circle
          key={i}
          className="s thin m-pulse"
          cx={50}
          cy={50}
          r={r}
          style={{ animationDelay: `${i * 1.4}s` }}
        />
      ))}
    </>
  ),
  piano: <Piano />,
  lofi: (
    <g className="m-spin">
      <circle className="s thin" cx={50} cy={50} r={21} />
      <circle className="s thin" cx={50} cy={50} r={6.5} />
      <circle className="fillc" cx={50} cy={50} r={1.7} />
      <line className="s thin" x1={50} y1={29} x2={50} y2={33.5} />
    </g>
  ),
  // Right-side-up harp with sound waves radiating off the strings.
  harp: (
    <>
      <line className="s thin" x1={35} y1={26} x2={35} y2={72} />
      <path className="s thin" d="M35 26 Q54 24 62 40" />
      <line className="s thin" x1={35} y1={72} x2={62} y2={40} />
      {[
        [42, 28, 65],
        [48, 31, 58],
        [54, 35, 50],
      ].map(([x, t, b], i) => (
        <line
          key={i}
          className="s thin m-pluck"
          x1={x}
          y1={t}
          x2={x}
          y2={b}
          style={{ animationDelay: `${i * 0.5}s` }}
        />
      ))}
      {[0, 1.2, 2.4].map((delay, i) => (
        <path
          key={`w${i}`}
          className="s thin m-pulse"
          style={
            {
              transformBox: "view-box",
              transformOrigin: "60px 40px",
              animationDelay: `${delay}s`,
            } as React.CSSProperties
          }
          d="M66 32 Q76 40 66 48"
        />
      ))}
    </>
  ),

  // Four warm strings sustaining, a bow drawn across them.
  strings: (
    <>
      {[41, 48, 55, 62].map((y, i) => (
        <line
          key={i}
          className="s thin m-shimmer"
          x1={30}
          y1={y}
          x2={70}
          y2={y}
          style={{ animationDelay: `${i * 0.5}s` }}
        />
      ))}
      <line className="s thin" x1={36} y1={34} x2={64} y2={68} />
    </>
  ),
  // The thumb piano: graduated tines on a bridge, plucked in turn.
  kalimba: (
    <>
      <line className="s thin" x1={30} y1={62} x2={70} y2={62} />
      {[46, 41, 37, 33, 37, 41, 46].map((top, i) => {
        const x = 34 + i * 5.3;
        return (
          <line
            key={i}
            className="s thin m-pluck"
            x1={x}
            y1={62}
            x2={x}
            y2={top}
            style={{ animationDelay: `${(i % 4) * 0.4}s` }}
          />
        );
      })}
    </>
  ),
  // A flute laid flat with its tone holes; two notes drift off the end.
  flute: (
    <>
      <line className="s" x1={28} y1={53} x2={66} y2={53} />
      <circle className="fillc" cx={31} cy={53} r={1.7} />
      {[39, 47, 55, 62].map((x, i) => (
        <circle key={i} className="fillc" cx={x} cy={53} r={1.4} />
      ))}
      <circle className="s thin m-pulse" cx={70} cy={47} r={3.2} />
      <circle
        className="s thin m-pulse"
        cx={75}
        cy={42}
        r={2.4}
        style={{ animationDelay: "1.8s" }}
      />
    </>
  ),

  // ---- Frequencies (oscilloscope: a faint centre axis unifies the family) ----
  brown: (
    <>
      {AXIS}
      {Array.from({ length: 13 }).map((_, i) => {
        const x = 29 + i * 3.5;
        const hh = [6, 10, 7, 12, 8, 11, 7, 13, 8, 10, 7, 9, 6][i];
        return (
          <line
            key={i}
            className="s thin m-shimmer"
            x1={x}
            y1={50 - hh / 2}
            x2={x}
            y2={50 + hh / 2}
            style={{ animationDelay: `${(i % 5) * 0.2}s` }}
          />
        );
      })}
    </>
  ),
  pad432: (
    <>
      {AXIS}
      <Wave y={50} amp={5} step={10} dur={5} />
    </>
  ),
  binaural: (
    <>
      {AXIS}
      <path
        className="s thin m-drift"
        style={{ "--drift": "32px", animationDuration: "9s" } as React.CSSProperties}
        d={wave(50, 7, 16)}
      />
      <path
        className="s thin m-drift"
        style={
          { "--drift": "33.8px", animationDuration: "9.8s", opacity: 0.75 } as React.CSSProperties
        }
        d={wave(50, 7, 16.9)}
      />
    </>
  ),
  delta: (
    <>
      {AXIS}
      <Wave y={52} amp={16} step={32} dur={13} />
    </>
  ),
  theta: (
    <>
      {AXIS}
      <Wave y={50} amp={9} step={17} dur={8} />
    </>
  ),
  // White noise: the densest, tallest spikes of the noise beds.
  whitenoise: (
    <>
      {AXIS}
      {Array.from({ length: 17 }).map((_, i) => {
        const x = 27 + i * 2.8;
        const hh = [10, 16, 8, 18, 12, 20, 9, 17, 13, 19, 10, 16, 8, 15, 11, 18, 9][i];
        return (
          <line
            key={i}
            className="s thin m-shimmer"
            x1={x}
            y1={50 - hh / 2}
            x2={x}
            y2={50 + hh / 2}
            style={{ animationDelay: `${(i % 6) * 0.15}s` }}
          />
        );
      })}
    </>
  ),
  // Green noise: mid-band, so mid-height spikes between brown and white.
  green: (
    <>
      {AXIS}
      {Array.from({ length: 15 }).map((_, i) => {
        const x = 28 + i * 3.1;
        const hh = [8, 13, 9, 14, 10, 12, 8, 15, 9, 13, 10, 11, 8, 12, 9][i];
        return (
          <line
            key={i}
            className="s thin m-shimmer"
            x1={x}
            y1={50 - hh / 2}
            x2={x}
            y2={50 + hh / 2}
            style={{ animationDelay: `${(i % 5) * 0.22}s` }}
          />
        );
      })}
    </>
  ),
  // Alpha: a smooth, steady rhythmic wave (calmer than theta, tighter than 432).
  alpha: (
    <>
      {AXIS}
      <Wave y={50} amp={7} step={15} dur={7} />
    </>
  ),
};

// Fallback: a calm single wave for any id without a bespoke motif.
const DEFAULT_MOTIF: Inner = <Wave y={50} amp={8} step={20} dur={9} />;

export function SoundMotif({ id }: { id: string }) {
  return (
    <svg className="pmotif" viewBox="0 0 100 100" aria-hidden="true">
      {MOTIFS[id] ?? DEFAULT_MOTIF}
    </svg>
  );
}
