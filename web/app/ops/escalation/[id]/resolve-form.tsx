"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Loader2, CheckCircle2 } from "lucide-react";

export function ResolveForm({ txnId, actorName }: { txnId: number; actorName: string }) {
  const router = useRouter();
  const [actor, setActor] = useState(actorName);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function resolve() {
    setSubmitting(true);
    try {
      await api.resolveEscalation(txnId, actor, notes);
      startTransition(() => router.push("/ops"));
    } catch { setSubmitting(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mark resolved</CardTitle>
        <p className="text-sm text-muted mt-1">After confirming the carrier has the change — e.g. Noyo support manually re-submitted it.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Resolver</Label><Input value={actor} onChange={(e) => setActor(e.target.value)} /></div>
        <div><Label>Resolution notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Contacted Noyo support, ticket #..." /></div>
        <Button variant="success" onClick={resolve} disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          Mark resolved (carrier confirmed)
        </Button>
      </CardContent>
    </Card>
  );
}
