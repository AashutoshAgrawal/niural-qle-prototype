/**
 * Single queue row, Linear-style: structured info in one card-row,
 * no column alignment dependencies, robust to any width.
 *
 * Layout (per row):
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ [Avatar] Person · Org                  🕐 SLA   [Action →]  │
 *   │          Event description                                  │
 *   │          [Priority]  [Reason]                Owner          │
 *   └─────────────────────────────────────────────────────────────┘
 */
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Avatar } from "@/components/avatar";

export type RowTone = "danger" | "warning" | "brand" | "neutral" | "success" | "violet";

const TONE: Record<RowTone, string> = {
  danger:  "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  brand:   "bg-brand-soft text-[var(--color-brand)]",
  neutral: "bg-surface-2 text-muted",
  success: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  violet:  "bg-[var(--color-violet-soft)] text-[var(--color-violet)]",
};

export interface QueueRowProps {
  priorityLabel: string;
  priorityTone: RowTone;
  triggerLabel: string;
  triggerTone: RowTone;
  identifier?: string;
  identifierHref?: string;
  personName: string;
  personSubtitle?: string;
  eventLabel: string;
  eventSubtitle?: string;
  slaLabel: string;
  slaTone: RowTone;
  owner?: string | null;
  actionLabel: string;
  actionHref: string;
}

export function QueueList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-[var(--color-border)] overflow-hidden">{children}</div>;
}

export function QueueRow(p: QueueRowProps) {
  return (
    <Link
      href={p.actionHref}
      className="flex items-stretch group cursor-pointer hover:bg-[var(--color-brand-tint)] transition-colors"
    >
      {/* Tone strip on the left — instant visual urgency */}
      <div className={`w-1 shrink-0 ${stripColor(p.priorityTone)}`} />

      <div className="flex items-start gap-3 px-5 py-4 flex-1 min-w-0">
        <Avatar name={p.personName} size="md" />

        {/* Center column */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-sm font-semibold text-ink truncate group-hover:text-[var(--color-brand)] transition-colors">
              {p.personName}
              {p.personSubtitle && (
                <span className="font-normal text-muted ml-2">· {p.personSubtitle}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0">
              <Clock className={`h-3.5 w-3.5 ${slaIconClass(p.slaTone)}`} />
              <span className={`tabular-nums font-medium ${slaTextClass(p.slaTone)}`}>
                {p.slaLabel}
              </span>
            </div>
          </div>

          <div className="text-sm text-ink-2 mt-0.5 truncate">
            {p.eventLabel}
            {p.eventSubtitle && (
              <span className="text-muted ml-1.5">· {p.eventSubtitle}</span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Chip tone={p.priorityTone}>{p.priorityLabel}</Chip>
            <Chip tone={p.triggerTone}>{p.triggerLabel}</Chip>
            {p.identifier && (
              <span className="text-[11px] font-mono text-muted-2">{p.identifier}</span>
            )}
            <div className="flex-1" />
            {p.owner && (
              <span className="text-[11px] text-muted">{p.owner}</span>
            )}
          </div>
        </div>

        {/* Always-visible chevron — signals interactivity */}
        <div className="shrink-0 self-center pl-2 text-muted-2 group-hover:text-[var(--color-brand)] group-hover:translate-x-0.5 transition-all">
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function stripColor(tone: RowTone): string {
  switch (tone) {
    case "danger":  return "bg-[var(--color-danger)]";
    case "warning": return "bg-[var(--color-warning)]";
    case "brand":   return "bg-[var(--color-brand)]";
    case "success": return "bg-[var(--color-success)]";
    case "violet":  return "bg-[var(--color-violet)]";
    default:        return "bg-transparent";
  }
}

function Chip({ children, tone }: { children: React.ReactNode; tone: RowTone }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${TONE[tone]}`}>
      {children}
    </span>
  );
}

function slaIconClass(tone: RowTone): string {
  return tone === "danger" ? "text-[var(--color-danger)]" :
    tone === "warning" ? "text-[var(--color-warning)]" :
    tone === "success" ? "text-[var(--color-success)]" :
    "text-muted-2";
}
function slaTextClass(tone: RowTone): string {
  return tone === "danger" ? "text-[var(--color-danger)]" :
    tone === "warning" ? "text-[var(--color-warning)]" :
    "text-ink-2";
}
