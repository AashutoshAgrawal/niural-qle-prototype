"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Loader2, ThumbsUp, ThumbsDown, X } from "lucide-react";

export function DisputeResolveForm({
  disputeId, qleId, actorName,
}: { disputeId: number; qleId: number; actorName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [actor, setActor] = useState(actorName);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState<"upheld" | "override" | null>(null);
  const [, startTransition] = useTransition();

  async function resolve(upheld: boolean) {
    setSubmitting(upheld ? "upheld" : "override");
    try {
      await api.resolveDispute(disputeId, actor, upheld, notes);
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setSubmitting(null);
    }
  }

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>Resolve</Button>
    );
  }

  return (
    <div className="absolute right-4 mt-1 z-10 w-80 p-4 rounded-lg bg-surface border border-strong shadow-lg space-y-3">
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium">Resolve dispute #{disputeId}</div>
        <button onClick={() => setOpen(false)} className="text-muted-2 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div>
        <Label>Resolver</Label>
        <Input value={actor} onChange={(e) => setActor(e.target.value)} />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="success" size="sm" onClick={() => resolve(false)} disabled={!!submitting}>
          {submitting === "override" ? <Loader2 className="animate-spin" /> : <ThumbsUp />}
          Override engine
        </Button>
        <Button variant="secondary" size="sm" onClick={() => resolve(true)} disabled={!!submitting}>
          {submitting === "upheld" ? <Loader2 className="animate-spin" /> : <ThumbsDown />}
          Uphold engine
        </Button>
      </div>
    </div>
  );
}
