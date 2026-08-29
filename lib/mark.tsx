// The relaxed "stem" mark: the lowercase r reduced to a single open stroke —
// a stem and a shoulder, no terminal. Pure geometry on a 100×100 grid, drawn as
// a stroke (never a fill), flat caps (never rounded). Geometry is exact and must
// not be redrawn by eye. See the identity handoff for the full spec.
export const STEM_PATH = "M40 74 V40 C40 30 49 26 60 26";

// Stroke weight compensates as the mark gets smaller so it keeps resolving.
export function stemStroke(px: number): number {
  if (px < 24) return 16;
  if (px < 40) return 14;
  return 13;
}

// In-product glyph. Inherits the current text colour (currentColor) so it is
// theme-aware wherever it sits. aria-hidden by default — the wordmark carries
// the accessible name.
export function StemGlyph({
  size = 22,
  className,
  title,
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d={STEM_PATH}
        stroke="currentColor"
        strokeWidth={stemStroke(size)}
        strokeLinecap="butt"
      />
    </svg>
  );
}
