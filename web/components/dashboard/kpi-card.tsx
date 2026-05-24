/**
 * KPI card — the most-read element on any dashboard.
 * Shows: large number, label, delta vs prior period, sparkline,
 * optional drill-down link.
 *
 * Inspired by Linear/Stripe operational dashboards.
 */
import Link from "next/link";
import { ArrowUp, ArrowDown, Minus, ArrowRight } from "lucide-react";
import { Sparkline } from "./sparkline";

export type KpiAccent = "neutral" | "brand" | "success" | "warning" | "danger" | "violet";

const ACCENT: Record<KpiAccent, { iconBg: string; iconColor: string; chip: string; }> = {
  neutral: { iconBg: "bg-surface-2",                  iconColor: "text-muted",                       chip: "bg-surface-2 text-muted" },
  brand:   { iconBg: "bg-brand-soft",                 iconColor: "text-[var(--color-brand)]",        chip: "bg-brand-soft text-[var(--color-brand)]" },
  success: { iconBg: "bg-[var(--color-success-soft)]",iconColor: "text-[var(--color-success)]",      chip: "bg-[var(--color-success-soft)] text-[var(--color-success)]" },
  warning: { iconBg: "bg-[var(--color-warning-soft)]",iconColor: "text-[var(--color-warning)]",      chip: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" },
  danger:  { iconBg: "bg-[var(--color-danger-soft)]", iconColor: "text-[var(--color-danger)]",       chip: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" },
  violet:  { iconBg: "bg-[var(--color-violet-soft)]", iconColor: "text-[var(--color-violet)]",       chip: "bg-[var(--color-violet-soft)] text-[var(--color-violet)]" },
};

export interface KpiCardProps {
  label: string;
  value: number | string;
  unit?: string;
  delta?: number; // raw difference vs previous period
  deltaLabel?: string; // e.g. "vs last week"
  deltaInverted?: boolean; // if true, down is good (e.g. SLA breaches)
  icon?: React.ComponentType<{ className?: string }>;
  accent?: KpiAccent;
  spark?: number[];
  href?: string;
  hint?: string;
}

export function KpiCard({
  label, value, unit, delta, deltaLabel = "vs last 7d", deltaInverted, icon: Icon,
  accent = "neutral", spark, href, hint,
}: KpiCardProps) {
  const a = ACCENT[accent];
  const interactive = !!href;
  const body = (
    <div
      className={
        "card-elevated p-5 transition-all relative group " +
        (interactive
          ? "cursor-pointer hover:border-[var(--color-brand)] hover:shadow-[0_8px_24px_-8px_rgba(113,77,255,0.18)] hover:-translate-y-0.5"
          : "")
      }
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-muted font-semibold">{label}</div>
        {Icon && (
          <div className={`h-8 w-8 rounded-md flex items-center justify-center ${a.iconBg}`}>
            <Icon className={`h-4 w-4 ${a.iconColor}`} />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <div className="text-[28px] font-semibold tabular-nums leading-none tracking-tight">{value}</div>
        {unit && <div className="text-sm text-muted">{unit}</div>}
      </div>

      <div className="flex items-center justify-between mt-3 gap-3">
        <DeltaPill delta={delta} deltaLabel={deltaLabel} inverted={deltaInverted} />
        {spark && spark.length > 1 && (
          <div className="opacity-80">
            <Sparkline data={spark} accent={accent === "neutral" ? "brand" : accent} />
          </div>
        )}
      </div>

      {hint && (
        <div className="text-xs text-muted-2 mt-2 leading-relaxed">{hint}</div>
      )}

      {interactive && (
        <div className="mt-3 pt-3 border-t border-default flex items-center justify-between text-xs">
          <span className="text-muted">Jump to list</span>
          <span className="text-[var(--color-brand)] font-medium inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
            View <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      )}
    </div>
  );
  if (href) return <Link href={href} className="block">{body}</Link>;
  return body;
}

function DeltaPill({ delta, deltaLabel, inverted }: { delta?: number; deltaLabel?: string; inverted?: boolean }) {
  if (delta === undefined) return <div className="text-xs text-muted-2">—</div>;
  if (delta === 0) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-muted">
        <Minus className="h-3 w-3" />
        <span className="tabular-nums">No change</span>
        <span className="text-muted-2">· {deltaLabel}</span>
      </div>
    );
  }
  const up = delta > 0;
  const good = inverted ? !up : up;
  const cls = good
    ? "text-[var(--color-success)] bg-[var(--color-success-soft)]"
    : "text-[var(--color-danger)] bg-[var(--color-danger-soft)]";
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold ${cls}`}>
        <Icon className="h-3 w-3" />
        <span className="tabular-nums">{up ? "+" : ""}{delta}</span>
      </div>
      <span className="text-xs text-muted-2 truncate">{deltaLabel}</span>
    </div>
  );
}
