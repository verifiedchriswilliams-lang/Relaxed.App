import React from "react";

// Per-soundscape line motifs for the relaxed.app player, drawn in the stem
// mark's language: a single stroke weight, flat caps, no fill, currentColor so
// they follow the theme. Each sits inside the breathing session ring and carries
// one honest motion true to its sound (rain falling, waves drifting, a record
// turning). No colour, no photograph. Geometry validated in the design preview.

// A sine-ish wave path. Period = 2*step; drifting one period (--drift) loops
// seamlessly. Drawn wider than the viewBox so the ends never show inside the ring.
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

function Wave({
  y,
  amp,
  step,
  dur,
}: {
  y: number;
  amp: number;
  step: number;
  dur: number;
}) {
  return (
    <path
      className="s thin m-drift"
      style={
        { "--drift": `${2 * step}px`, animationDuration: `${dur}s` } as React.CSSProperties
      }
      d={wave(y, amp, step)}
    />
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
  ocean: (
    <>
      <Wave y={48} amp={8} step={20} dur={7} />
      <Wave y={58} amp={8} step={20} dur={11} />
    </>
  ),
  wind: (
    <>
      <Wave y={42} amp={3.5} step={20} dur={4.2} />
      <Wave y={50} amp={2.6} step={20} dur={5.6} />
      <Wave y={58} amp={3.5} step={20} dur={7} />
    </>
  ),
  thunder: (
    <>
      <path className="s thin" d="M35 45 Q34 37 42 37 Q45 31 53 34 Q63 32 64 42" />
      <path className="s m-flash" d="M53 45 L45 58 L51 58 L44 71" />
    </>
  ),
  windchimes: (
    <g className="m-sway" style={{ transformOrigin: "center top" }}>
      <line className="s thin" x1={35} y1={33} x2={65} y2={33} />
      {[
        [41, 60],
        [48, 66],
        [55, 62],
        [61, 55],
      ].map(([x, y2], i) => (
        <line key={i} className="s thin" x1={x} y1={33} x2={x} y2={y2} />
      ))}
    </g>
  ),

  // ---- Music ----
  bowls: (
    <>
      {[
        [3, "M28 58 Q50 46 72 58"],
        [1.5, "M31 55 Q50 45 69 55"],
        [0, "M34 52 Q50 44 66 52"],
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
  piano: (
    <g className="m-bob">
      <ellipse className="fillc" cx={45} cy={63} rx={7} ry={5} />
      <line className="s" x1={52} y1={63} x2={52} y2={34} />
      <path className="s" d="M52 34 Q60 36 59 45" />
    </g>
  ),
  lofi: (
    <g className="m-spin">
      <circle className="s thin" cx={50} cy={50} r={21} />
      <circle className="s thin" cx={50} cy={50} r={6.5} />
      <circle className="fillc" cx={50} cy={50} r={1.7} />
      <line className="s thin" x1={50} y1={29} x2={50} y2={33.5} />
    </g>
  ),
  harp: (
    <>
      <path className="s thin" d="M38 30 L38 70 L64 70" />
      <path className="s thin" d="M38 30 Q54 33 64 70" />
      {[
        [45, 41],
        [51, 48],
        [57, 57],
      ].map(([x, y1], i) => (
        <line
          key={i}
          className="s thin m-pluck"
          x1={x}
          y1={y1}
          x2={x}
          y2={70}
          style={{ animationDelay: `${i * 0.5}s` }}
        />
      ))}
    </>
  ),

  // ---- Frequencies ----
  brown: (
    <>
      {Array.from({ length: 11 }).map((_, i) => {
        const x = 31 + i * 3.8;
        const h = [7, 11, 8, 13, 9, 12, 7, 13, 8, 10, 8][i];
        return (
          <line
            key={i}
            className="s thin m-shimmer"
            x1={x}
            y1={50 - h / 2}
            x2={x}
            y2={50 + h / 2}
            style={{ animationDelay: `${(i % 5) * 0.22}s` }}
          />
        );
      })}
    </>
  ),
  pad432: <Wave y={50} amp={5} step={12} dur={5} />,
  binaural: (
    <>
      <path
        className="s thin m-drift"
        style={{ "--drift": "32px", animationDuration: "9s" } as React.CSSProperties}
        d={wave(46, 7, 16)}
      />
      <path
        className="s thin m-drift"
        style={{ "--drift": "32px", animationDuration: "9.7s" } as React.CSSProperties}
        d={wave(54, 7, 16)}
      />
    </>
  ),
  delta: <Wave y={52} amp={15} step={30} dur={12} />,
  theta: <Wave y={50} amp={9} step={18} dur={8} />,
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
