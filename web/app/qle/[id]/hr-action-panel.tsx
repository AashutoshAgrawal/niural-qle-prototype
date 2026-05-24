"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Loader2, RefreshCw, AlertTriangle, Clock, Settings2, X } from "lucide-react";

type Action = "resend" | "approve_late" | "escalate";

export function HrActionPanel({
  qleId, actorName, flaggedLate, hasFailedVerification,
}: {
  qleId: number; actorName: string; flaggedLate: boolean; hasFailedVerification: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Action | null>(null);
  const [actor, setActor] = useState(actorName);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function execute() {
    setSubmitting(true);
    try {
      if (open === "resend") {
        const r = await api.hrResendCarrier(qleId, actor, notes);
        setResult(`Resent ${r.resent} carrier line(s).`);
      } else if (open === "approve_late") {
        await api.hrApproveLate(qleId, actor, notes);
        setResult("Late submission approved.");
      } else if (open === "escalate") {
        await api.hrEscalate(qleId, actor, notes);
        setResult("Escalated to BenOps.");
      }
      setOpen(null);
      setNotes("");
      startTransition(() => router.refresh());
    } catch (e) {
      setResult(`Failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted" /> Actions
        </CardTitle>
        <p className="text-sm text-muted mt-1">
          You can intervene on this event from here — no need to email anyone.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {result && (
          <div className="text-sm p-2.5 rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success)]">
            {result}
          </div>
        )}

        {!open && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              variant="secondary"
              onClick={() => { setResult(null); setOpen("resend"); }}
              disabled={!hasFailedVerification}
              title={hasFailedVerification ? "" : "No failed carrier lines to resend"}
            >
              <RefreshCw /> Re-send to carrier
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setResult(null); setOpen("approve_late"); }}
              disabled={!flaggedLate}
              title={flaggedLate ? "" : "Not flagged as late"}
            >
              <Clock /> Approve late submission
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setResult(null); setOpen("escalate"); }}
            >
              <AlertTriangle /> Escalate to BenOps
            </Button>
          </div>
        )}

        {open && (
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="text-sm font-medium">
                {open === "resend" && "Re-send failed carrier line(s)"}
                {open === "approve_late" && "Approve this late submission"}
                {open === "escalate" && "Escalate to BenOps"}
              </div>
              <button onClick={() => setOpen(null)} className="text-muted-2 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <Label>Your name</Label>
              <Input value={actor} onChange={(e) => setActor(e.target.value)} />
            </div>
            <div>
              <Label>Notes (logged to audit)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            <Button variant="primary" onClick={execute} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" /> : null}
              Confirm
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
