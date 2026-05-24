import { Circle } from "lucide-react";
import type { SlaHealth } from "@/lib/api";
import { cn } from "@/lib/utils";

const CONFIG: Record<SlaHealth, { color: string; label: string }> = {
  green: { color: "var(--color-success)", label: "On track" },
  yellow: { color: "var(--color-warning)", label: "At risk" },
  red: { color: "var(--color-danger)", label: "Overdue" },
};

export function SlaIndicator({ health, label }: { health: SlaHealth; label?: boolean }) {
  const cfg = CONFIG[health];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Circle className="h-2 w-2 shrink-0" fill={cfg.color} stroke="none" />
      {label && <span className="text-sm text-ink-2">{cfg.label}</span>}
    </span>
  );
}

export function StatusBadge({ status, statusLabel }: { status: string; statusLabel: string }) {
  const variant: Record<string, "neutral" | "brand" | "success" | "warning" | "danger" | "violet"> = {
    submitted: "neutral",
    documents_verified: "brand",
    election_pending: "violet",
    election_confirmed: "violet",
    carrier_in_progress: "brand",
    active: "success",
    rejected: "danger",
    benops_review: "warning",
  };
  const v = variant[status] || "neutral";
  const dot: Record<string, string> = {
    submitted: "var(--color-muted)",
    documents_verified: "var(--color-brand)",
    election_pending: "var(--color-violet)",
    election_confirmed: "var(--color-violet)",
    carrier_in_progress: "var(--color-brand)",
    active: "var(--color-success)",
    rejected: "var(--color-danger)",
    benops_review: "var(--color-warning)",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        v === "neutral" && "bg-surface-3 text-ink-2",
        v === "brand" && "bg-brand-soft text-[var(--color-brand)]",
        v === "violet" && "bg-[var(--color-violet-soft)] text-[var(--color-violet)]",
        v === "success" && "bg-[var(--color-success-soft)] text-[var(--color-success)]",
        v === "warning" && "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
        v === "danger" && "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
      )}
    >
      <Circle className="h-1.5 w-1.5" fill={dot[status]} stroke="none" />
      {statusLabel}
    </span>
  );
}
