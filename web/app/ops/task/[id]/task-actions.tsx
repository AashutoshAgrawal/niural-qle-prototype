"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export function TaskActions({ taskId, carrier, actorName }: { taskId: number; carrier: string; actorName: string }) {
  const router = useRouter();
  const [actor, setActor] = useState(actorName);
  const [ref, setRef] = useState("");
  const [submitting, setSubmitting] = useState<"complete" | "unavailable" | null>(null);
  const [, startTransition] = useTransition();

  async function complete() {
    setSubmitting("complete");
    try {
      await api.completeTask(taskId, actor, ref);
      startTransition(() => router.push("/ops"));
    } catch { setSubmitting(null); }
  }

  async function unavailable() {
    setSubmitting("unavailable");
    try {
      await api.taskUnavailable(taskId, actor);
      startTransition(() => router.push("/ops"));
    } catch { setSubmitting(null); }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Your name</Label>
        <Input value={actor} onChange={(e) => setActor(e.target.value)} />
      </div>
      <div>
        <Label>Carrier confirmation reference</Label>
        <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. ARL-99281" />
      </div>
      <Button variant="success" onClick={complete} disabled={!!submitting} className="w-full">
        {submitting === "complete" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
        Mark complete
      </Button>
      {carrier === "Angle" && (
        <Button variant="secondary" onClick={unavailable} disabled={!!submitting} className="w-full">
          {submitting === "unavailable" ? <Loader2 className="animate-spin" /> : <AlertTriangle />}
          Portal unavailable
        </Button>
      )}
    </div>
  );
}
