import { cn } from "@/lib/utils";

export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.9 ? "var(--color-success)" :
    value >= 0.7 ? "var(--color-warning)" :
    "var(--color-danger)";
  const label = value >= 0.9 ? "High confidence" : value >= 0.7 ? "Medium confidence" : "Low confidence";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className="text-sm font-semibold tabular-nums" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-3 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all")}
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
