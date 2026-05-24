"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api, type ElectionOption } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ElectionForm({ qleId, options }: { qleId: number; options: ElectionOption[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function confirm() {
    if (!choice) return;
    setSubmitting(true);
    try {
      await api.elect(qleId, choice);
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      {options.map((opt) => {
        const active = choice === opt.action;
        return (
          <button
            type="button"
            key={opt.action}
            onClick={() => setChoice(opt.action)}
            className={cn(
              "w-full text-left p-4 rounded-lg border transition-all",
              active ? "border-[var(--color-brand)] bg-brand-soft" : "border-default bg-surface hover:border-strong"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                  active ? "border-[var(--color-brand)] bg-[var(--color-brand)]" : "border-default"
                )}
              >
                {active && <CheckCircle2 className="h-4 w-4 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink">{opt.label}</div>
                {opt.description && <p className="text-sm text-muted mt-1">{opt.description}</p>}
                {opt.citation && (
                  <p className="text-xs text-muted-2 font-mono mt-1.5 italic">{opt.citation}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
      <Button variant="primary" onClick={confirm} disabled={!choice || submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
        Confirm
      </Button>
    </div>
  );
}
