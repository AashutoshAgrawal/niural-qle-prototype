import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { api, type QLE } from "@/lib/api";
import { requireSession, type Session } from "@/lib/session";
import { AppShell, PageHeader, buildSidebarSections } from "@/components/persona-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusTracker } from "@/components/status-tracker";
import { StatusBadge } from "@/components/sla-indicator";
import { AuditTimeline } from "@/components/audit-timeline";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { CarrierTracks } from "@/components/carrier-tracks";
import { ElectionForm } from "./election-form";
import { ResubmitForm } from "./resubmit-form";
import { DisputeForm } from "./dispute-form";
import { HrActionPanel } from "./hr-action-panel";
import { formatDate } from "@/lib/utils";
import {
  FileText, Download, AlertTriangle, CircleCheck, Scale, ShieldCheck, Sparkles,
} from "lucide-react";
import { DocPreview } from "@/components/review/doc-preview";
import { DocStatusBanner, deriveDocState } from "@/components/review/doc-status-banner";
import { enrichReview } from "@/lib/review-mock";

export const dynamic = "force-dynamic";

export default async function QlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  let qle: QLE;
  try {
    qle = await api.getQLE(parseInt(id));
  } catch {
    notFound();
  }

  // Authorization
  if (session.kind === "employee" && qle.employee_id !== session.id) {
    redirect("/me");
  }
  if (session.kind === "hr_admin" && qle.employee?.organization?.id !== session.org_id) {
    redirect(`/admin/${session.org_id}`);
  }

  const backHref = backFor(session);
  const backLabel = backLabelFor(session);
  const openDispute = qle.disputes.find(d => d.status === "open");

  return (
    <AppShell session={session} sidebarSections={buildSidebarSections(session, "/qle")}>
      <div className="mb-6">
        <Link href={backHref} className="text-sm text-muted hover:text-ink">← {backLabel}</Link>
      </div>
      <PageHeader
        title={qle.event_type_label}
        description={
          session.kind === "employee"
            ? `Reported on ${formatDate(qle.created_at)} · election deadline ${formatDate(qle.election_deadline)}`
            : `${qle.employee?.name} · ${qle.employee?.organization?.name} · #${qle.id}`
        }
        actions={<StatusBadge status={qle.status} statusLabel={qle.status_label} />}
      />

      <Card className="mb-6">
        <CardContent className="py-8">
          <StatusTracker status={qle.status} />
        </CardContent>
      </Card>

      <ContextBanner qle={qle} session={session} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {session.kind === "employee" && qle.status === "election_pending" && qle.eligible_options && (
            <Card>
              <CardHeader>
                <CardTitle>Choose your benefit change</CardTitle>
                <p className="text-sm text-muted mt-1">
                  Based on your event, plan, and state. Your carrier gets updated automatically once you confirm.
                </p>
              </CardHeader>
              <CardContent>
                <ElectionForm qleId={qle.id} options={qle.eligible_options} />
                <DisputeForm qleId={qle.id} hasOpenDispute={!!openDispute} />
              </CardContent>
            </Card>
          )}

          {openDispute && session.kind !== "employee" && (
            <Card className="border-[var(--color-violet)]">
              <CardHeader>
                <CardTitle className="text-[var(--color-violet)]">Open dispute</CardTitle>
                <p className="text-sm text-muted mt-1">
                  The employee believes the rules engine missed an option they qualify for.
                </p>
              </CardHeader>
              <CardContent>
                <div className="text-sm p-3 rounded-lg bg-[var(--color-violet-soft)] mb-3">
                  &ldquo;{openDispute.employee_reason}&rdquo;
                </div>
                {session.kind === "benops" && (
                  <Link href="/ops" className="text-brand text-sm font-medium">
                    Resolve in the queue →
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {qle.documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted" /> Document
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {qle.documents.map((d) => {
                  const enrichment = enrichReview(qle);
                  const banner = deriveDocState(qle, d);
                  return (
                    <div key={d.id} className="space-y-4">
                      <DocStatusBanner props={banner} />

                      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-5">
                        <DocPreview enrichment={enrichment} filename={d.filename} />
                        <div className="space-y-4">
                          <div>
                            <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                              Classifier output
                            </div>
                            <ConfidenceMeter value={d.confidence} />
                            <dl className="mt-3 space-y-2 text-sm">
                              <KvLine k="Classified as" v={d.classified_type?.replace(/_/g, " ") || "uncertain"} />
                              <KvLine k="Routing" v={(d.routing_decision || "").replace(/_/g, " ") || "—"} />
                              <KvLine k="Quality" v={d.quality_issue || "OK"} />
                            </dl>
                          </div>
                          {d.notes && session.kind !== "employee" && (
                            <div className="text-xs p-3 rounded-lg bg-surface-2 border border-default leading-relaxed">
                              <div className="flex items-center gap-1.5 text-muted font-medium mb-1">
                                <Sparkles className="h-3 w-3" />
                                System note
                              </div>
                              <div className="text-ink-2">{d.notes}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {session.kind === "employee" && qle.status === "rejected" && (
            <ResubmitForm qleId={qle.id} />
          )}

          {/* Parallel carrier tracks — visible once election is dispatched */}
          {(qle.carrier_transactions.length > 0 || qle.task_cards.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted" /> Carrier propagation
                </CardTitle>
                <p className="text-sm text-muted mt-1">
                  {session.kind === "employee"
                    ? "Each of your coverages is being updated. We confirm coverage is active on the carrier's end — not just submitted."
                    : "One track per coverage line. The QLE is only marked active when every line is verified."}
                </p>
              </CardHeader>
              <CardContent>
                <CarrierTracks
                  transactions={qle.carrier_transactions}
                  tasks={qle.task_cards}
                  role={session.kind}
                />
              </CardContent>
            </Card>
          )}

          {/* HR action panel — only for HR admins, only when QLE is theirs */}
          {session.kind === "hr_admin" && (
            <HrActionPanel
              qleId={qle.id}
              actorName={session.name}
              flaggedLate={qle.flagged_late}
              hasFailedVerification={qle.carrier_transactions.some(t => t.verification_status === "failed")}
            />
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{session.kind === "employee" ? "Timeline" : "Audit trail"}</span>
                {session.kind !== "employee" && (
                  <a href={`http://localhost:8000/api/audit/${qle.id}/export`} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm"><Download /> CSV</Button>
                  </a>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTimeline entries={qle.audit || []} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function ContextBanner({ qle, session }: { qle: QLE; session: Session }) {
  if (qle.status === "active") {
    return (
      <div className="rounded-xl border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] p-4 mb-6 flex items-start gap-3">
        <CircleCheck className="h-5 w-5 text-[var(--color-success)] mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--color-success)]">Coverage active.</p>
          <p className="text-sm text-ink-2 mt-0.5">
            Every coverage line is verified active in the carriers&apos; claims systems.
          </p>
        </div>
      </div>
    );
  }
  if (qle.status === "rejected" && session.kind === "employee") {
    return (
      <div className="rounded-xl border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-[var(--color-danger)] mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--color-danger)]">Your document needs to be resubmitted.</p>
          <p className="text-sm text-ink-2 mt-0.5">{qle.intake_notes}</p>
        </div>
      </div>
    );
  }
  if (qle.status === "benops_review") {
    return (
      <div className="rounded-xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--color-warning)]">
            {session.kind === "employee" ? "Your submission is being reviewed." : "Awaiting human review."}
          </p>
          <p className="text-sm text-ink-2 mt-0.5">
            {session.kind === "employee"
              ? "Our benefits team is double-checking the document. You'll hear back within 4 hours."
              : qle.intake_notes}
          </p>
        </div>
      </div>
    );
  }
  if (qle.event_type === "dependent_aging_off" && qle.eligible_options?.some(o => o.citation)) {
    return (
      <div className="rounded-xl border border-[var(--color-violet-soft)] bg-[var(--color-violet-soft)] p-4 mb-6 flex items-start gap-3">
        <Scale className="h-5 w-5 text-[var(--color-violet)] mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--color-violet)]">State continuation may apply.</p>
          <p className="text-sm text-ink-2 mt-0.5">
            Your state offers options beyond federal COBRA. Review the eligible choices below.
          </p>
        </div>
      </div>
    );
  }
  // Coverage verification context — failed line(s) exist
  const failedLine = qle.carrier_transactions.find(t => t.verification_status === "failed");
  if (failedLine) {
    return (
      <div className="rounded-xl border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-[var(--color-danger)] mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--color-danger)]">
            One of your coverage lines didn&apos;t propagate.
          </p>
          <p className="text-sm text-ink-2 mt-0.5">
            Your {failedLine.coverage_line_label.toLowerCase()} change reached {failedLine.carrier} but didn&apos;t appear in
            their claims system. Our team is on it.
          </p>
        </div>
      </div>
    );
  }
  return null;
}

function KvLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-ink-2 font-medium text-right truncate">{v}</dd>
    </div>
  );
}

function backFor(s: Session): string {
  if (s.kind === "employee") return "/me";
  if (s.kind === "hr_admin") return `/admin/${s.org_id}`;
  return "/ops";
}
function backLabelFor(s: Session): string {
  if (s.kind === "employee") return "Back to your benefits";
  if (s.kind === "hr_admin") return `Back to ${s.org_name}`;
  return "Back to queue";
}
