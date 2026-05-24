import type { AuditEntry } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import {
  CheckCircle2, AlertTriangle, FileCheck, FileX, UserCheck,
  Send, ArrowRightLeft, Clock, Bell, Scale, ShieldCheck, RefreshCw,
} from "lucide-react";

const ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  submitted: { icon: Send, color: "var(--color-brand)" },
  intake_complete: { icon: FileCheck, color: "var(--color-brand)" },
  docs_verified: { icon: CheckCircle2, color: "var(--color-success)" },
  doc_approved: { icon: UserCheck, color: "var(--color-success)" },
  doc_rejected: { icon: FileX, color: "var(--color-danger)" },
  rejected_at_intake: { icon: FileX, color: "var(--color-danger)" },
  queued_for_review: { icon: AlertTriangle, color: "var(--color-warning)" },
  state_rule_applied: { icon: Scale, color: "var(--color-violet)" },
  election_pending: { icon: Clock, color: "var(--color-violet)" },
  election_confirmed: { icon: CheckCircle2, color: "var(--color-violet)" },
  carrier_submitted: { icon: ArrowRightLeft, color: "var(--color-brand)" },
  carrier_acked: { icon: ShieldCheck, color: "var(--color-success)" },
  carrier_retry: { icon: RefreshCw, color: "var(--color-warning)" },
  carrier_escalated: { icon: AlertTriangle, color: "var(--color-danger)" },
  reconciliation_alert: { icon: AlertTriangle, color: "var(--color-danger)" },
  task_card_created: { icon: FileCheck, color: "var(--color-brand)" },
  task_card_completed: { icon: CheckCircle2, color: "var(--color-success)" },
  portal_unavailable: { icon: AlertTriangle, color: "var(--color-warning)" },
  reminder_sent: { icon: Bell, color: "var(--color-warning)" },
  status_active: { icon: CheckCircle2, color: "var(--color-success)" },
  escalation_resolved: { icon: CheckCircle2, color: "var(--color-success)" },
  resubmitted: { icon: RefreshCw, color: "var(--color-brand)" },
};

export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted py-4">No audit entries yet.</p>;

  return (
    <ol className="relative">
      {entries.map((e, i) => {
        const cfg = ICONS[e.action] || { icon: CheckCircle2, color: "var(--color-muted)" };
        const Icon = cfg.icon;
        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < entries.length - 1 && (
              <div className="absolute left-3.5 top-7 bottom-0 w-px bg-[var(--color-border)]" />
            )}
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 bg-surface border border-default"
              style={{ color: cfg.color }}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-ink">
                  {e.action.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-muted-2 font-mono">{e.actor}</span>
              </div>
              {e.details && <p className="text-sm text-muted mt-0.5">{e.details}</p>}
              <p className="text-xs text-muted-2 mt-0.5">{formatDateTime(e.timestamp)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
