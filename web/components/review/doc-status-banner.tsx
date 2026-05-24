/**
 * Status banner shown above the document preview. Communicates:
 *   - the current state (auto-approved / under review / approved / rejected)
 *   - who made the decision (system or reviewer name)
 *   - when
 *   - the reason (if rejected) or any pending action
 *
 * Used on the QLE detail page so employees / HR / BenOps see the same
 * truth about every document in the system, not just ones awaiting review.
 */
import { Check, AlertTriangle, X, Clock, Sparkles } from "lucide-react";
import type { QLE, Document, AuditEntry } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

type State =
  | "auto_approved"
  | "approved_by_reviewer"
  | "under_review"
  | "rejected_at_intake"
  | "rejected_by_reviewer"
  | "resubmitted";

interface BannerProps {
  state: State;
  title: string;
  subtitle?: string;
  reviewer?: string;
  when?: string | null;
  reason?: string;
  tone: "success" | "warning" | "danger" | "brand";
}

const TONE: Record<BannerProps["tone"], {
  bg: string; border: string; iconBg: string; iconColor: string; titleColor: string;
}> = {
  success: {
    bg: "bg-[var(--color-success-soft)]",
    border: "border-[var(--color-success-soft)]",
    iconBg: "bg-[var(--color-success)]",
    iconColor: "text-white",
    titleColor: "text-[var(--color-success)]",
  },
  warning: {
    bg: "bg-[var(--color-warning-soft)]",
    border: "border-[var(--color-warning-soft)]",
    iconBg: "bg-[var(--color-warning)]",
    iconColor: "text-white",
    titleColor: "text-[var(--color-warning)]",
  },
  danger: {
    bg: "bg-[var(--color-danger-soft)]",
    border: "border-[var(--color-danger-soft)]",
    iconBg: "bg-[var(--color-danger)]",
    iconColor: "text-white",
    titleColor: "text-[var(--color-danger)]",
  },
  brand: {
    bg: "bg-brand-soft",
    border: "border-[var(--color-brand-soft)]",
    iconBg: "bg-[var(--color-brand)]",
    iconColor: "text-white",
    titleColor: "text-[var(--color-brand)]",
  },
};

const ICONS: Record<State, React.ComponentType<{ className?: string }>> = {
  auto_approved: Sparkles,
  approved_by_reviewer: Check,
  under_review: Clock,
  rejected_at_intake: AlertTriangle,
  rejected_by_reviewer: X,
  resubmitted: Clock,
};

export function deriveDocState(qle: QLE, doc: Document): BannerProps {
  const audit = qle.audit || [];

  // QLE was rejected
  if (qle.status === "rejected") {
    if (doc.routing_decision === "reject") {
      return {
        state: "rejected_at_intake",
        title: "Rejected at intake",
        subtitle: "The system caught this before it reached a human reviewer.",
        when: doc.created_at,
        reason: doc.notes || qle.intake_notes || undefined,
        tone: "danger",
      };
    }
    const rejection = findAudit(audit, ["doc_rejected"]);
    return {
      state: "rejected_by_reviewer",
      title: "Rejected by reviewer",
      subtitle: rejection?.details,
      reviewer: cleanActor(rejection?.actor) ?? "BenOps",
      when: rejection?.timestamp ?? null,
      reason: qle.intake_notes ?? undefined,
      tone: "danger",
    };
  }

  // QLE is currently under BenOps review
  if (qle.status === "benops_review") {
    return {
      state: "under_review",
      title: "Pending BenOps review",
      subtitle: "Medium-confidence documents are double-checked by a human within 4 hours.",
      when: doc.created_at,
      tone: "warning",
    };
  }

  // Past intake — doc was either auto-approved or approved by a reviewer
  if (doc.routing_decision === "auto_approve") {
    return {
      state: "auto_approved",
      title: "Auto-approved at upload",
      subtitle: `High-confidence ${labelFor(doc.classified_type)}. No reviewer needed.`,
      when: doc.created_at,
      tone: "success",
    };
  }

  // Otherwise, a reviewer approved it
  const approval = findAudit(audit, ["doc_approved", "docs_verified"]);
  return {
    state: "approved_by_reviewer",
    title: "Approved by reviewer",
    subtitle: approval?.details ?? "Document validated and routed to election.",
    reviewer: cleanActor(approval?.actor) ?? "BenOps",
    when: approval?.timestamp ?? doc.created_at,
    tone: "success",
  };
}

function findAudit(entries: AuditEntry[], actions: string[]): AuditEntry | undefined {
  return [...entries].reverse().find((e) => actions.includes(e.action));
}

function cleanActor(actor: string | undefined | null): string | undefined {
  if (!actor) return undefined;
  if (actor === "system") return "Niural system";
  if (actor === "employee") return "Employee";
  if (actor.startsWith("benops:")) return actor.slice("benops:".length);
  return actor;
}

function labelFor(classified?: string | null): string {
  if (!classified) return "document";
  return {
    birth_adoption: "birth certificate",
    marriage: "marriage certificate",
    divorce: "divorce decree",
    death_of_dependent: "death certificate",
    loss_of_other_coverage: "coverage-loss letter",
  }[classified] || classified.replace(/_/g, " ");
}

export function DocStatusBanner({ props }: { props: BannerProps }) {
  const tone = TONE[props.tone];
  const Icon = ICONS[props.state];

  return (
    <div className={`rounded-xl border ${tone.border} ${tone.bg} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 rounded-lg ${tone.iconBg} ${tone.iconColor} flex items-center justify-center shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className={`text-sm font-semibold ${tone.titleColor}`}>
              {props.title}
            </div>
            {props.when && (
              <div className="text-xs text-muted shrink-0">
                {formatDateTime(props.when)}
              </div>
            )}
          </div>
          {props.subtitle && (
            <p className="text-sm text-ink-2 mt-1 leading-relaxed">{props.subtitle}</p>
          )}
          {props.reviewer && (
            <div className="text-xs text-muted-2 mt-1.5">
              by <span className="text-ink-2 font-medium">{props.reviewer}</span>
            </div>
          )}
          {props.reason && (
            <div className="mt-3 px-3 py-2 rounded-md bg-surface border border-default text-sm text-ink-2 italic">
              &ldquo;{props.reason}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
