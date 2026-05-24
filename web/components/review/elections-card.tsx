import { ArrowRight, TrendingUp, TrendingDown, Minus, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReviewEnrichment, RequestedElection } from "@/lib/review-mock";

const ACTION_VARIANT: Record<RequestedElection["action"], "success" | "danger" | "warning" | "neutral"> = {
  add_dependent: "success",
  remove_dependent: "danger",
  tier_change: "warning",
  no_change: "neutral",
  self_enrol: "success",
};

export function ElectionsCard({ enrichment }: { enrichment: ReviewEnrichment }) {
  const elections = enrichment.elections;
  if (elections.length === 0) {
    return <p className="text-sm text-muted">No coverage changes requested.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {elections.map((e, i) => (
          <ElectionRow key={i} e={e} />
        ))}
      </div>

      <div className="border-t border-default pt-3 flex items-center justify-between text-sm">
        <div className="text-muted">Estimated monthly premium impact</div>
        <div className="flex items-center gap-3">
          <PremiumChip
            label="Total"
            delta={enrichment.totalPremiumDelta}
          />
          <PremiumChip
            label="Employee share"
            delta={enrichment.employeeSharePremiumDelta}
          />
        </div>
      </div>
    </div>
  );
}

function ElectionRow({ e }: { e: RequestedElection }) {
  const isChange = e.action !== "no_change";
  return (
    <div
      className={
        "rounded-lg border border-default px-4 py-3 " +
        (isChange ? "bg-surface" : "bg-surface-2")
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted shrink-0 w-14">
            {e.line}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-ink truncate">{e.actionLabel}</span>
              <Badge variant={ACTION_VARIANT[e.action]}>
                {e.action.replace("_", " ")}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted">
              <Building2 className="h-3 w-3" />
              <span>{e.carrier} · {e.plan}</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-muted text-right shrink-0">
          <div className="flex items-center gap-1 justify-end">
            <span>{e.tierFrom}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-ink">{e.tierTo}</span>
          </div>
          <div className="mt-0.5">Effective {e.effectiveDate}</div>
        </div>
      </div>
    </div>
  );
}

function PremiumChip({ label, delta }: { label: string; delta: number }) {
  const icon = delta > 0 ? <TrendingUp className="h-3.5 w-3.5" />
    : delta < 0 ? <TrendingDown className="h-3.5 w-3.5" />
      : <Minus className="h-3.5 w-3.5" />;
  const colour = delta > 0
    ? "text-[var(--color-warning)] bg-[var(--color-warning-soft)]"
    : delta < 0
      ? "text-[var(--color-success)] bg-[var(--color-success-soft)]"
      : "text-muted bg-surface-2";
  const sign = delta > 0 ? "+" : "";
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${colour}`}>
      {icon}
      <span>{label}: {sign}${Math.abs(delta).toLocaleString()}/mo</span>
    </div>
  );
}
