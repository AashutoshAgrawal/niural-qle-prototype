"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle, X, ArrowUpRight, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea, Label, Select } from "@/components/ui/input";
import type { ReviewEnrichment } from "@/lib/review-mock";

type Action = "approve" | "request_reupload" | "reject" | "escalate";

const REUPLOAD_REASONS = [
  "Wrong document type (e.g. invitation instead of certificate)",
  "Image is blurry or low resolution",
  "Document is cropped — key fields cut off",
  "Names on document don't match declared dependent",
  "Event date on document doesn't match declared date",
  "Document is not dated or issuer not visible",
];

const REJECT_REASONS = [
  "Document is fraudulent or tampered with",
  "Event does not qualify under plan rules",
  "Submission is past the 30-day election window with no allowance",
  "Other (note required)",
];

const ESCALATE_REASONS = [
  "State-specific rule interpretation needed",
  "Carrier policy ambiguity",
  "Possible fraud — needs second reviewer",
  "Multi-employer complication",
];

export function ReviewForm({
  qleId,
  reviewerName,
  enrichment,
}: {
  qleId: number;
  reviewerName: string;
  enrichment: ReviewEnrichment;
}) {
  const router = useRouter();
  const [action, setAction] = useState<Action>(enrichment.recommendation.action);
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function submit() {
    setSubmitting(true);
    try {
      // The backend currently only supports approve/reject. The UI captures
      // richer intent; we map non-binary actions to the closest API call
      // while keeping the full reason in the audit notes.
      const apiDecision: "approve" | "reject" =
        action === "approve" ? "approve" : "reject";
      const combinedNotes =
        action === "approve"
          ? notes || "Approved by reviewer."
          : `${actionLabel(action)}${reason ? ` — ${reason}` : ""}${notes ? `. ${notes}` : ""}`;
      await api.review(qleId, apiDecision, reviewerName, combinedNotes);
      startTransition(() => router.push("/ops"));
    } catch {
      setSubmitting(false);
    }
  }

  const reasonsForAction =
    action === "request_reupload" ? REUPLOAD_REASONS :
    action === "reject" ? REJECT_REASONS :
    action === "escalate" ? ESCALATE_REASONS :
    [];

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <RecommendationBanner enrichment={enrichment} onUseRecommendation={() => {
          setAction(enrichment.recommendation.action);
          setReason("");
        }} />

        <div>
          <Label className="mb-2">Decision</Label>
          <div className="grid grid-cols-2 gap-2">
            <ActionTile
              active={action === "approve"}
              onClick={() => { setAction("approve"); setReason(""); }}
              icon={<Check className="h-4 w-4" />}
              label="Approve"
              tone="success"
              recommended={enrichment.recommendation.action === "approve"}
            />
            <ActionTile
              active={action === "request_reupload"}
              onClick={() => { setAction("request_reupload"); setReason(""); }}
              icon={<RotateCcw className="h-4 w-4" />}
              label="Request reupload"
              tone="warning"
              recommended={enrichment.recommendation.action === "request_reupload"}
            />
            <ActionTile
              active={action === "reject"}
              onClick={() => { setAction("reject"); setReason(""); }}
              icon={<X className="h-4 w-4" />}
              label="Reject"
              tone="danger"
              recommended={enrichment.recommendation.action === "reject"}
            />
            <ActionTile
              active={action === "escalate"}
              onClick={() => { setAction("escalate"); setReason(""); }}
              icon={<ArrowUpRight className="h-4 w-4" />}
              label="Escalate to lead"
              tone="brand"
              recommended={enrichment.recommendation.action === "escalate"}
            />
          </div>
        </div>

        {reasonsForAction.length > 0 && (
          <div>
            <Label className="mb-2">Reason</Label>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select a reason…</option>
              {reasonsForAction.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <Label className="mb-2">Notes for audit log</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              action === "approve" ? "Anything BenOps should see later?"
                : action === "request_reupload" ? "What does the employee need to upload?"
                  : action === "reject" ? "Why is this being rejected?"
                    : "Why does this need lead review?"
            }
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-default">
          <div className="text-xs text-muted">
            Reviewing as <strong className="text-ink">{reviewerName}</strong>
          </div>
          <Button
            variant={action === "approve" ? "primary" : action === "reject" ? "danger" : "secondary"}
            onClick={submit}
            disabled={submitting || (reasonsForAction.length > 0 && !reason)}
          >
            {submitting && <Loader2 className="animate-spin" />}
            Submit {actionLabel(action).toLowerCase()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendationBanner({
  enrichment,
  onUseRecommendation,
}: {
  enrichment: ReviewEnrichment;
  onUseRecommendation: () => void;
}) {
  const r = enrichment.recommendation;
  return (
    <div className="rounded-lg p-3.5 bg-brand-tint border border-[var(--color-brand-soft)]">
      <div className="flex items-start gap-2.5">
        <div className="h-7 w-7 rounded-md bg-[var(--color-brand)] flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-[var(--color-brand)] font-semibold">
            System recommendation
          </div>
          <div className="text-sm font-medium text-ink mt-0.5">{r.label}</div>
          <div className="text-xs text-muted mt-1">{r.reasoning}</div>
        </div>
        <Button variant="link" size="sm" onClick={onUseRecommendation}>
          Use
        </Button>
      </div>
    </div>
  );
}

function ActionTile({
  active, onClick, icon, label, tone, recommended,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "success" | "warning" | "danger" | "brand";
  recommended: boolean;
}) {
  const toneClasses: Record<typeof tone, string> = {
    success: "data-[active=true]:border-[var(--color-success)] data-[active=true]:bg-[var(--color-success-soft)] data-[active=true]:text-[var(--color-success)]",
    warning: "data-[active=true]:border-[var(--color-warning)] data-[active=true]:bg-[var(--color-warning-soft)] data-[active=true]:text-[var(--color-warning)]",
    danger:  "data-[active=true]:border-[var(--color-danger)] data-[active=true]:bg-[var(--color-danger-soft)] data-[active=true]:text-[var(--color-danger)]",
    brand:   "data-[active=true]:border-[var(--color-brand)] data-[active=true]:bg-brand-soft data-[active=true]:text-[var(--color-brand)]",
  };
  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className={
        "relative flex items-center gap-2 px-3 py-2.5 rounded-lg border border-default bg-surface text-sm font-medium text-ink-2 hover:bg-surface-2 transition-colors text-left " +
        toneClasses[tone]
      }
    >
      {icon}
      <span>{label}</span>
      {recommended && (
        <AlertCircle className="ml-auto h-3.5 w-3.5 text-[var(--color-brand)]" aria-label="Recommended" />
      )}
    </button>
  );
}

function actionLabel(a: Action): string {
  if (a === "approve") return "Approve";
  if (a === "request_reupload") return "Request reupload";
  if (a === "reject") return "Reject";
  return "Escalate";
}
