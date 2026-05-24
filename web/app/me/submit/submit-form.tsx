"use client";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, type Employee, type Coverage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Wizard } from "@/components/wizard";
import { FileDrop } from "@/components/file-drop";
import {
  AlertCircle, Heart, Baby, ScrollText, Calendar, FileUp,
  ArrowLeft, ArrowRight, CheckCircle2, Loader2, Info, Users,
  User, Hash, MapPin, TrendingUp, TrendingDown, ShieldCheck, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EVENT_TYPES = [
  { value: "marriage",              label: "Got married",          icon: Heart,      description: "Add a spouse to your benefits.",                                           addsDependent: true },
  { value: "birth_adoption",        label: "Had a baby or adopted", icon: Baby,       description: "Add a child to your coverage.",                                            addsDependent: true },
  { value: "loss_of_other_coverage",label: "Lost other coverage",   icon: Users,      description: "You or a dependent gained eligibility because other coverage ended.",     addsDependent: true },
  { value: "divorce",               label: "Got divorced",          icon: ScrollText, description: "Remove a former spouse from your benefits.",                              addsDependent: false },
  { value: "death_of_dependent",    label: "Death of dependent",    icon: ScrollText, description: "Remove a dependent from your benefits.",                                  addsDependent: false },
  { value: "dependent_aging_off",   label: "Dependent aging off",   icon: Calendar,   description: "A child is turning 26 and losing eligibility.",                            addsDependent: false },
] as const;

const DOC_NAME: Record<string, string> = {
  marriage: "marriage certificate",
  divorce: "divorce decree",
  birth_adoption: "birth certificate or adoption papers",
  death_of_dependent: "death certificate",
  loss_of_other_coverage: "letter of coverage loss from the prior carrier",
};

const SAMPLES_BY_EVENT: Record<string, { fname: string; outcome: string; tone: "success" | "warning" | "danger" }[]> = {
  marriage: [
    { fname: "marriage_certificate.pdf", outcome: "Will auto-approve", tone: "success" },
    { fname: "wedding_invitation.pdf", outcome: "Will be rejected (wrong document)", tone: "danger" },
    { fname: "marriage_cert_blurry.jpg", outcome: "Will fail quality check", tone: "danger" },
    { fname: "marriage_cert_datemismatch.pdf", outcome: "Will route to benefits team", tone: "warning" },
  ],
  birth_adoption: [
    { fname: "birth_certificate.pdf", outcome: "Will auto-approve", tone: "success" },
    { fname: "adoption_papers.pdf", outcome: "Will auto-approve", tone: "success" },
  ],
  divorce: [{ fname: "divorce_decree.pdf", outcome: "Will auto-approve", tone: "success" }],
  loss_of_other_coverage: [{ fname: "loss_of_coverage_letter.pdf", outcome: "Will auto-approve", tone: "success" }],
  death_of_dependent: [{ fname: "death_certificate.pdf", outcome: "Will auto-approve", tone: "success" }],
};

const RELATIONSHIP_BY_EVENT: Record<string, string[]> = {
  marriage: ["Spouse", "Domestic partner"],
  birth_adoption: ["Biological child", "Adopted child", "Stepchild"],
  loss_of_other_coverage: ["Self", "Spouse", "Child"],
  divorce: ["Spouse"],
  death_of_dependent: ["Spouse", "Child", "Other"],
  dependent_aging_off: ["Child"],
};

const PREMIUM_DELTA_BY_LINE: Record<string, { add: number; remove: number }> = {
  medical: { add: 312, remove: -312 },
  dental:  { add: 38,  remove: -38 },
  vision:  { add: 16,  remove: -16 },
};

type FileInfo = { name: string; size: number; type: string };

export function SubmitForm({ employee }: { employee: Employee }) {
  const router = useRouter();
  const employeeId = employee.id;
  const [step, setStep] = useState(0);
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [file, setFile] = useState<FileInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  // Dependent capture
  const [depFirstName, setDepFirstName] = useState("");
  const [depLastName, setDepLastName] = useState(lastNameOf(employee.name));
  const [depDob, setDepDob] = useState("");
  const [depRelationship, setDepRelationship] = useState("");
  const [depSsnLast4, setDepSsnLast4] = useState("");
  const [depState, setDepState] = useState(employee.state);
  const [depOtherCoverage, setDepOtherCoverage] = useState(false);
  // Aging-off specific
  const [depUnmarried, setDepUnmarried] = useState<boolean>(true);

  // Elections: per-coverage selection
  const activeCoverages = useMemo(() => employee.coverages.filter((c) => c.active), [employee.coverages]);
  const [selectedLines, setSelectedLines] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    activeCoverages.forEach((c) => { init[c.id] = true; });
    return init;
  });
  const [tier, setTier] = useState<"employee_only" | "employee_plus_one" | "family">("employee_plus_one");

  const eventMeta = EVENT_TYPES.find((t) => t.value === eventType);
  const isAgingOff = eventType === "dependent_aging_off";
  const addsDependent = eventMeta?.addsDependent ?? false;
  const needsFile = !isAgingOff;
  const isAddEvent = addsDependent;
  const isRemoveEvent = !isAddEvent && !isAgingOff && !!eventType;

  const depFullName = `${depFirstName} ${depLastName}`.trim();

  // Step validity
  const step1Valid = !!eventType;
  const step2Valid = !!eventDate &&
    (!isAddEvent || (depFirstName && depLastName && depDob && depRelationship)) &&
    (!isAgingOff || (depFirstName && depState));
  const step3Valid = !needsFile || !!file;

  const steps = [
    { key: "event",     label: "Event type",   description: eventType ? eventMeta?.label : "Pick one" },
    { key: "details",   label: "Details",      description: eventDate || "When & who" },
    { key: "elections", label: "Elections",    description: Object.values(selectedLines).filter(Boolean).length + " line(s)" },
    { key: "document",  label: "Document",     description: needsFile ? (file?.name || "Upload") : "Not required" },
    { key: "review",    label: "Review",       description: "Confirm and submit" },
  ];

  // Compute premium delta preview
  const premiumDelta = useMemo(() => {
    if (!eventType) return 0;
    return activeCoverages.reduce((sum, c) => {
      if (!selectedLines[c.id]) return sum;
      const delta = PREMIUM_DELTA_BY_LINE[c.line] || { add: 0, remove: 0 };
      if (isAddEvent) return sum + delta.add;
      if (isRemoveEvent || isAgingOff) return sum + delta.remove;
      return sum;
    }, 0);
  }, [activeCoverages, selectedLines, eventType, isAddEvent, isRemoveEvent, isAgingOff]);
  const employeeShareDelta = Math.round(premiumDelta * 0.4);

  function next() {
    setError(null);
    if (step === 0 && !step1Valid) { setError("Pick an event type to continue."); return; }
    if (step === 1 && !step2Valid) { setError("Please complete the required fields."); return; }
    if (step === 3 && !step3Valid) { setError("Upload your document to continue."); return; }
    setStep((s) => Math.min(s + 1, 4));
  }

  function back() { setError(null); setStep((s) => Math.max(s - 1, 0)); }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const dependent_info: Record<string, unknown> = isAgingOff
        ? {
            name: depFirstName,
            unmarried: depUnmarried,
            nj_resident: depState === "NJ",
            ny_resident: depState === "NY",
            no_other_coverage: !depOtherCoverage,
          }
        : {
            name: depFullName,
            dob: depDob,
            relationship: depRelationship,
            ssn_last4: depSsnLast4,
            state: depState,
            other_coverage: depOtherCoverage,
            elections: Object.entries(selectedLines).filter(([, v]) => v).map(([k]) => Number(k)),
            tier,
          };
      const qle = await api.submitQLE(employeeId, {
        event_type: eventType,
        event_date: eventDate,
        filename: file?.name || "",
        dependent_info,
      });
      startTransition(() => router.push(`/qle/${qle.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  }

  const samples = SAMPLES_BY_EVENT[eventType] || [];
  const relationshipOptions = RELATIONSHIP_BY_EVENT[eventType] || [];

  return (
    <Card>
      <CardContent className="pt-8 pb-8">
        <Wizard steps={steps} current={step} />

        {/* STEP 1 — Event type */}
        {step === 0 && (
          <div className="animate-fade-in">
            <h2 className="text-lg font-semibold tracking-tight">What changed in your life?</h2>
            <p className="text-sm text-muted mt-1 mb-5">Pick the event that applies. We&apos;ll guide you through the rest.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {EVENT_TYPES.map((t) => {
                const Icon = t.icon;
                const active = eventType === t.value;
                return (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setEventType(t.value)}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                      active ? "border-[var(--color-brand)] bg-brand-soft" : "border-default bg-surface hover:border-strong"
                    )}
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      active ? "bg-[var(--color-brand)] text-white" : "bg-surface-3 text-muted"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{t.label}</div>
                      <div className="text-xs text-muted mt-0.5">{t.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2 — Details + dependent capture */}
        {step === 1 && (
          <div className="animate-fade-in max-w-2xl">
            <h2 className="text-lg font-semibold tracking-tight">A few details</h2>
            <p className="text-sm text-muted mt-1 mb-5">
              {isAddEvent ? "Tell us about the person being added to your coverage."
                : isAgingOff ? "Tell us about your dependent so we can show the right continuation options."
                  : "When did this happen?"}
            </p>

            <div className="space-y-5">
              <div>
                <Label>Date of event</Label>
                <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                <p className="text-xs text-muted mt-1.5 flex items-center gap-1.5">
                  <Info className="h-3 w-3" /> You have 30 days from this date to choose your benefit changes.
                </p>
              </div>

              {(isAddEvent || isAgingOff) && (
                <div className="p-5 rounded-xl bg-surface-2 border border-default space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted" />
                    <div className="text-sm font-semibold">
                      {isAddEvent ? "Dependent being added" : "Dependent aging off"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>First name</Label>
                      <Input value={depFirstName} onChange={(e) => setDepFirstName(e.target.value)} placeholder="First" required />
                    </div>
                    <div>
                      <Label>Last name</Label>
                      <Input value={depLastName} onChange={(e) => setDepLastName(e.target.value)} placeholder="Last" required />
                    </div>
                  </div>

                  {isAddEvent && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Date of birth</Label>
                          <Input type="date" value={depDob} onChange={(e) => setDepDob(e.target.value)} required />
                        </div>
                        <div>
                          <Label>Relationship</Label>
                          <Select value={depRelationship} onChange={(e) => setDepRelationship(e.target.value)} required>
                            <option value="">Select…</option>
                            {relationshipOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>SSN (last 4)</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            value={depSsnLast4}
                            onChange={(e) => setDepSsnLast4(e.target.value.replace(/\D/g, ""))}
                            placeholder="•••• 1234"
                          />
                          <p className="text-xs text-muted-2 mt-1.5">Carriers need this for enrollment. Optional for newborns.</p>
                        </div>
                        <div>
                          <Label>State of residence</Label>
                          <Select value={depState} onChange={(e) => setDepState(e.target.value)}>
                            {["NY","NJ","CA","IL","TX","MA","FL","WA"].map((s) => <option key={s} value={s}>{s}</option>)}
                          </Select>
                        </div>
                      </div>

                      <Toggle label="Has other health coverage" value={depOtherCoverage} onChange={setDepOtherCoverage} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
                    </>
                  )}

                  {isAgingOff && (
                    <>
                      <div>
                        <Label>State of residence</Label>
                        <Select value={depState} onChange={(e) => setDepState(e.target.value)} required>
                          {["NY","NJ","CA","IL","TX","MA","FL","WA"].map((s) => <option key={s} value={s}>{s}</option>)}
                        </Select>
                        <p className="text-xs text-muted mt-1.5">Some states extend coverage past age 26 — we&apos;ll check.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Toggle label="Unmarried" value={depUnmarried} onChange={setDepUnmarried} />
                        <Toggle label="Has other coverage" value={depOtherCoverage} onChange={setDepOtherCoverage} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 — Elections preview */}
        {step === 2 && (
          <div className="animate-fade-in max-w-2xl">
            <h2 className="text-lg font-semibold tracking-tight">Choose your coverage changes</h2>
            <p className="text-sm text-muted mt-1 mb-5">
              Select which of your coverage lines should reflect this event. We&apos;ve picked the most common options.
            </p>

            <div className="space-y-2">
              {activeCoverages.map((c) => (
                <CoverageRow
                  key={c.id}
                  coverage={c}
                  selected={!!selectedLines[c.id]}
                  onToggle={(v) => setSelectedLines((prev) => ({ ...prev, [c.id]: v }))}
                  action={isAddEvent ? `Add ${depFullName || "dependent"}` : isRemoveEvent ? `Remove ${depFullName || "dependent"}` : "No change"}
                  delta={
                    isAddEvent ? (PREMIUM_DELTA_BY_LINE[c.line]?.add ?? 0) :
                      (isRemoveEvent || isAgingOff) ? (PREMIUM_DELTA_BY_LINE[c.line]?.remove ?? 0) :
                        0
                  }
                />
              ))}
            </div>

            {isAddEvent && (
              <div className="mt-5">
                <Label>New coverage tier</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "employee_only", label: "Employee only" },
                    { value: "employee_plus_one", label: "Employee + 1" },
                    { value: "family", label: "Family" },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => setTier(t.value as typeof tier)}
                      className={cn(
                        "px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                        tier === t.value
                          ? "border-[var(--color-brand)] bg-brand-soft text-[var(--color-brand)]"
                          : "border-default bg-surface text-ink-2 hover:bg-surface-2"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <PremiumImpactBox delta={premiumDelta} share={employeeShareDelta} />
          </div>
        )}

        {/* STEP 4 — Document */}
        {step === 3 && (
          <div className="animate-fade-in max-w-2xl">
            <h2 className="text-lg font-semibold tracking-tight">
              {needsFile ? "Upload your supporting document" : "Almost done"}
            </h2>
            <p className="text-sm text-muted mt-1 mb-5">
              {needsFile ? (
                <>We need to verify the event with your <strong>{DOC_NAME[eventType]}</strong>. We&apos;ll check it instantly.</>
              ) : (
                <>Aging-off events are system-triggered — no document needed. Submit to see your eligible options.</>
              )}
            </p>

            {needsFile && (
              <div className="mb-4 rounded-lg bg-pastel-sky/40 border border-default p-3 text-xs text-ink-2 flex gap-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--color-info)]" />
                <div>
                  <strong>Tips for fast approval:</strong> the document should clearly show your full name, the dependent&apos;s full name, and the event date.
                  Photos of certificates are fine if they&apos;re sharp and uncropped.
                </div>
              </div>
            )}

            {needsFile ? (
              <FileDrop value={file} onChange={setFile} demoSamples={samples} />
            ) : (
              <div className="rounded-xl border border-default bg-surface-2 p-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-brand-soft flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-brand)]" />
                </div>
                <div>
                  <div className="text-sm font-medium">No document required</div>
                  <div className="text-xs text-muted mt-0.5">We&apos;ll use the dependent&apos;s date of birth on file.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5 — Review */}
        {step === 4 && (
          <div className="animate-fade-in max-w-2xl">
            <h2 className="text-lg font-semibold tracking-tight">Review and submit</h2>
            <p className="text-sm text-muted mt-1 mb-5">
              Double-check the details below. After you submit we&apos;ll start verifying your document.
            </p>

            <div className="space-y-4">
              <ReviewSection title="Event">
                <RowKV k="Type" v={<span className="font-medium">{eventMeta?.label}</span>} />
                <RowKV k="Date of event" v={fmtDate(eventDate)} />
                <RowKV k="Election window closes" v={addDays(eventDate, 30)} />
              </ReviewSection>

              {(isAddEvent || isAgingOff) && (
                <ReviewSection title={isAddEvent ? "Dependent being added" : "Dependent aging off"} icon={<User className="h-4 w-4" />}>
                  <RowKV k="Name" v={<span className="font-medium">{depFullName || "—"}</span>} />
                  {isAddEvent && <RowKV k="Date of birth" v={fmtDate(depDob) + (depDob ? ` · ${ageFromDob(depDob)} yrs` : "")} />}
                  {isAddEvent && <RowKV k="Relationship" v={depRelationship || "—"} />}
                  {isAddEvent && <RowKV k="SSN" icon={<Hash className="h-3 w-3" />} v={depSsnLast4 ? `•••• ${depSsnLast4}` : "—"} />}
                  <RowKV k="State" icon={<MapPin className="h-3 w-3" />} v={depState} />
                  <RowKV k="Other coverage" v={depOtherCoverage ? "Yes" : "No"} />
                </ReviewSection>
              )}

              <ReviewSection title="Coverage changes">
                {activeCoverages.filter((c) => selectedLines[c.id]).map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] uppercase tracking-wider text-muted w-14 shrink-0">{c.line}</span>
                      <span className="font-medium text-ink">{isAddEvent ? `Add ${depFullName}` : isRemoveEvent ? `Remove ${depFullName}` : "No change"}</span>
                    </div>
                    <span className="text-xs text-muted">{c.carrier} · {c.plan_type}</span>
                  </div>
                ))}
                {activeCoverages.filter((c) => selectedLines[c.id]).length === 0 && (
                  <div className="text-sm text-muted italic">No coverage lines selected.</div>
                )}
                <PremiumImpactBox delta={premiumDelta} share={employeeShareDelta} compact />
              </ReviewSection>

              {needsFile && (
                <ReviewSection title="Supporting document" icon={<FileUp className="h-4 w-4" />}>
                  <div className="font-mono text-sm">{file?.name || "—"}</div>
                  <div className="text-xs text-muted mt-1">
                    Will be classified and matched against the details above. Most documents are approved in under a minute.
                  </div>
                </ReviewSection>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-2 text-sm text-[var(--color-danger)]">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-default">
          <div>
            {step > 0 && (
              <Button variant="ghost" onClick={back} disabled={submitting}>
                <ArrowLeft /> Back
              </Button>
            )}
          </div>
          <div>
            {step < 4 ? (
              <Button
                variant="primary"
                onClick={next}
                disabled={
                  (step === 0 && !step1Valid) ||
                  (step === 1 && !step2Valid) ||
                  (step === 3 && !step3Valid)
                }
              >
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button variant="primary" onClick={submit} disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <FileUp />}
                {submitting ? "Submitting…" : "Submit life event"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageRow({
  coverage, selected, onToggle, action, delta,
}: {
  coverage: Coverage;
  selected: boolean;
  onToggle: (v: boolean) => void;
  action: string;
  delta: number;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
        selected ? "border-[var(--color-brand)] bg-brand-soft" : "border-default bg-surface hover:bg-surface-2"
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onToggle(e.target.checked)}
        className="accent-[var(--color-brand)] h-4 w-4"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted w-14 shrink-0">{coverage.line}</span>
          <span className="text-sm font-medium text-ink truncate">{action}</span>
        </div>
        <div className="text-xs text-muted mt-0.5">{coverage.carrier} · {coverage.plan_type}</div>
      </div>
      {selected && delta !== 0 && (
        <Badge variant={delta > 0 ? "warning" : "success"}>
          {delta > 0 ? "+" : ""}${Math.abs(delta)}/mo
        </Badge>
      )}
    </label>
  );
}

function PremiumImpactBox({ delta, share, compact }: { delta: number; share: number; compact?: boolean }) {
  if (delta === 0) {
    return (
      <div className={cn("rounded-lg bg-surface-2 border border-default text-sm text-muted", compact ? "p-3 mt-3" : "p-4 mt-5")}>
        No premium change with these elections.
      </div>
    );
  }
  const increase = delta > 0;
  const Icon = increase ? TrendingUp : TrendingDown;
  const tint = increase ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" : "bg-[var(--color-success-soft)] text-[var(--color-success)]";
  return (
    <div className={cn("rounded-lg border border-default", compact ? "p-3 mt-3" : "p-4 mt-5", increase ? "bg-pastel-cream/60" : "bg-pastel-mint/40")}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`h-7 w-7 rounded-md flex items-center justify-center ${tint}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="text-sm font-semibold">
          Estimated monthly premium impact
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div>
          <div className="text-xs text-muted">Total premium change</div>
          <div className="text-lg font-semibold tabular-nums">{increase ? "+" : ""}${Math.abs(delta).toLocaleString()}/mo</div>
        </div>
        <div>
          <div className="text-xs text-muted">Your share (est.)</div>
          <div className="text-lg font-semibold tabular-nums">{increase ? "+" : ""}${Math.abs(share).toLocaleString()}/mo</div>
        </div>
      </div>
      <div className="text-xs text-muted-2 mt-2 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        Confirmed amount will appear after carrier acknowledges enrollment.
      </div>
    </div>
  );
}

function ReviewSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-default bg-surface p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-default">
        {icon && <span className="text-muted">{icon}</span>}
        <div className="text-sm font-semibold">{title}</div>
      </div>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );
}

function RowKV({ k, v, icon }: { k: string; v: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm py-0.5">
      <span className="text-muted flex items-center gap-1.5">{icon}{k}</span>
      <span className="text-ink-2 text-right truncate">{v}</span>
    </div>
  );
}

function Toggle({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "flex items-center justify-between gap-2 p-3 rounded-lg border text-sm font-medium transition-colors",
        value
          ? "border-[var(--color-brand)] bg-brand-soft text-[var(--color-brand)]"
          : "border-default bg-surface text-ink-2 hover:border-strong"
      )}
    >
      <span className="flex items-center gap-1.5">{icon}{label}</span>
      <span className={cn(
        "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0",
        value ? "bg-[var(--color-brand)]" : "bg-[var(--color-border-strong)]"
      )}>
        <span className={cn(
          "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
          value ? "translate-x-3.5" : "translate-x-0.5"
        )} />
      </span>
    </button>
  );
}

function lastNameOf(name: string): string {
  const parts = name.split(/\s+/);
  return parts[parts.length - 1] || "";
}
function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function addDays(iso: string, n: number): string {
  if (!iso) return "—";
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function ageFromDob(iso: string): number {
  if (!iso) return 0;
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}
