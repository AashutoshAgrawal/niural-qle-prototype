"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";

export function RulesAdmin() {
  const router = useRouter();
  const [state, setState] = useState("");
  const [eventType, setEventType] = useState("dependent_aging_off");
  const [conditions, setConditions] = useState("");
  const [actions, setActions] = useState("");
  const [citation, setCitation] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const cond = JSON.parse(conditions);
      const acts = JSON.parse(actions);
      await api.addRule({ state, event_type: eventType, conditions: cond, eligible_actions: acts, citation, description });
      setState(""); setConditions(""); setActions(""); setCitation(""); setDescription("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Add a new rule</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>State (2-letter)</Label>
            <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} maxLength={2} required placeholder="MA" />
          </div>
          <div>
            <Label>Event type</Label>
            <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="dependent_aging_off">dependent_aging_off</option>
              <option value="marriage">marriage</option>
              <option value="divorce">divorce</option>
              <option value="birth_adoption">birth_adoption</option>
              <option value="death_of_dependent">death_of_dependent</option>
              <option value="loss_of_other_coverage">loss_of_other_coverage</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Conditions (JSON)</Label>
            <Textarea value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder='{"unmarried": true, "max_age": 30}' required className="font-mono" />
          </div>
          <div className="md:col-span-2">
            <Label>Eligible actions (JSON array)</Label>
            <Textarea value={actions} onChange={(e) => setActions(e.target.value)} placeholder='["federal_cobra", "custom_state_continuation"]' required className="font-mono" />
          </div>
          <div>
            <Label>Citation</Label>
            <Input value={citation} onChange={(e) => setCitation(e.target.value)} placeholder="M.G.L. c. 175 § 110" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <p className="md:col-span-2 text-sm text-[var(--color-danger)]">{error}</p>}
          <div className="md:col-span-2">
            <Button type="submit" variant="primary" disabled={submitting || !state || !conditions || !actions}>
              {submitting ? <Loader2 className="animate-spin" /> : <Plus />}
              Add rule
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
