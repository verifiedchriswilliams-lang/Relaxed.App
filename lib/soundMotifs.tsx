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
      <g className="m-bob">
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
