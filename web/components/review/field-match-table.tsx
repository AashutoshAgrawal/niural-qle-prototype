import { Check, AlertTriangle, X } from "lucide-react";
import type { DocFact, ReviewEnrichment } from "@/lib/review-mock";

const ICONS = {
  match: <Check className="h-4 w-4 text-[var(--color-success)]" />,
  warn: <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />,
  fail: <X className="h-4 w-4 text-[var(--color-danger)]" />,
};

const PILL: Record<DocFact["match"], string> = {
  match: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  warn: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  fail: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
};

const PILL_LABEL: Record<DocFact["match"], string> = {
  match: "Match",
  warn: "Warning",
  fail: "Mismatch",
};

export function FieldMatchTable({ enrichment }: { enrichment: ReviewEnrichment }) {
  return (
    <div className="overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[160px_1fr_1fr_100px] gap-3 px-4 py-2.5 bg-surface-2 border-b border-default text-[11px] uppercase tracking-wider text-muted font-semibold">
        <div>Field</div>
        <div>Document says</div>
        <div>Employee declared</div>
        <div className="text-right">Status</div>
      </div>
      {/* Body */}
      <div>
        {enrichment.factMatches.map((f) => (
          <div
            key={f.label}
            className="grid grid-cols-[160px_1fr_1fr_100px] gap-3 px-4 py-3 border-b border-default last:border-0 items-start"
          >
            <div className="text-sm text-muted">{f.label}</div>
            <div className="text-sm text-ink">
              <div className="font-medium">{f.documentValue}</div>
              {f.note && (
                <div className="text-xs text-muted mt-0.5">{f.note}</div>
              )}
            </div>
            <div className="text-sm text-ink font-medium">{f.declaredValue}</div>
            <div className="flex items-center justify-end gap-1.5">
              {ICONS[f.match]}
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${PILL[f.match]}`}>
                {PILL_LABEL[f.match]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
