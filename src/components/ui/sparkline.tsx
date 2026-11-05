/**
 * Tiny trend line. SVG coordinates ignore dir, so time runs left to right like other charts.
 * Spending starts from zero; prices (fitToRange) use their own low and high so moves are visible.
 */
export function Sparkline({
  values,
  color,
  label,
  fitToRange = false,
  className = "h-8 w-24",
}: {
  values: number[];
  color: string;
  label: string;
  fitToRange?: boolean;
  className?: string;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = fitToRange ? Math.min(...values) : Math.min(0, ...values);
  const range = max - min || 1;
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  const y = (v: number) => 30 - ((v - min) / range) * 26;
  const last = values.length - 1;
  return (
    <svg viewBox="-3 0 106 32" preserveAspectRatio="none" className={`${className} shrink-0 overflow-visible`} role="img" aria-label={label}>
      <polyline
        points={values.map((v, i) => `${i * step},${y(v)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last * step} cy={y(values[last])} r="2.5" fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
