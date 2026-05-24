/**
 * Inline SVG sparkline. Compact, no axis, with end-point dot.
 */
const COLOR: Record<string, string> = {
  neutral: "var(--color-muted)",
  brand:   "var(--color-brand)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger:  "var(--color-danger)",
  violet:  "var(--color-violet)",
};

export function Sparkline({
  data, width = 84, height = 28, accent = "brand",
}: {
  data: number[];
  width?: number;
  height?: number;
  accent?: keyof typeof COLOR;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = Math.max(max - min, 1);
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / span) * height;
    return { x, y };
  });
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${width},${height} L0,${height} Z`;
  const color = COLOR[accent];
  const last = pts[pts.length - 1];

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${accent}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${accent})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r={2.5} fill={color} stroke="var(--color-surface)" strokeWidth="1.5" />
    </svg>
  );
}
