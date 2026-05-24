"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { Flag, Loader2, X } from "lucide-react";

export function DisputeForm({ qleId, hasOpenDispute }: { qleId: number; hasOpenDispute: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  if (hasOpenDispute) {
    return (
      <div className="mt-4 p-3 rounded-lg bg-[var(--color-violet-soft)] text-sm text-[var(--color-violet)]">
        Your dispute is being reviewed by our benefits team. We&apos;ll update you within 4 hours.
      </div>
    );
  }

  async function submit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await api.dispute(qleId, reason);
      startTransition(() => router.refresh());
    } catch {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 text-xs text-muted hover:text-ink inline-flex items-center gap-1"
      >
        <Flag className="h-3 w-3" /> Don&apos;t see an option you think you qualify for? Let us know.
      </button>
    );
  }

  return (
    <div className="mt-4 p-4 rounded-lg border border-[var(--color-violet)] bg-[var(--color-violet-soft)]">
      <div className="flex items-start justify-between mb-2">
        <Label className="m-0 text-[var(--color-violet)]">Request review of your eligible options</Label>
        <button onClick={() => setOpen(false)} className="text-muted-2 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-ink-2 mb-3">
        If you believe you qualify for an option not listed above (e.g., a state continuation we missed),
        tell us why and our benefits team will take another look.
      </p>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="I'm an unmarried NJ resident and don't have other coverage — I should be eligible for NJ continuation to 31."
        rows={3}
        className="bg-surface"
      />
      <div className="flex items-center gap-2 mt-3">
        <Button variant="primary" size="sm" onClick={submit} disabled={submitting || !reason.trim()}>
          {submitting ? <Loader2 className="animate-spin" /> : <Flag />} Submit for review
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
