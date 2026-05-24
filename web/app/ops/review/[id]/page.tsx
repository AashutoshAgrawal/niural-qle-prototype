import Link from "next/link";
import { ChevronLeft, Clock, AlertTriangle, Sparkles, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { AppShell, buildSidebarSections } from "@/components/persona-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/sla-indicator";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { AuditTimeline } from "@/components/audit-timeline";
import { ReviewForm } from "./review-form";
import { DocPreview } from "@/components/review/doc-preview";
import { FieldMatchTable } from "@/components/review/field-match-table";
import { ElectionsCard } from "@/components/review/elections-card";
import { DependentCard } from "@/components/review/dependent-card";
import { EmployeeContextCard } from "@/components/review/employee-context-card";
import { enrichReview } from "@/lib/review-mock";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("benops");
  const qle = await api.getQLE(parseInt(id));
  const enrichment = enrichReview(qle);
  const document = qle.documents?.[0];

  return (
    <AppShell session={session} sidebarSections={buildSidebarSections(session, "/ops")}>
      {/* Breadcrumb + page header */}
      <div className="mb-4">
        <Link href="/ops" className="text-sm text-muted hover:text-ink inline-flex items-center gap-1">
          <ChevronLeft className="h-3.5 w-3.5" /> Back to queue
        </Link>
      </div>

      <header className="mb-6 pb-6 border-b border-default">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>Review #{qle.id}</span>
              <span>·</span>
              <span>Submitted {formatDate(qle.created_at)}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">
              {qle.event_type_label}: {qle.employee?.name}
            </h1>
            <p className="text-sm text-muted mt-1">
              {qle.employee?.organization?.name} · Event date {formatDate(qle.event_date)} ·
              Election window closes {formatDate(qle.election_deadline)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SlaPill
              icon={<Clock className="h-3.5 w-3.5" />}
              label="BenOps SLA"
              value={`${enrichment.sla.benopsHoursRemaining}h left`}
              tone={enrichment.sla.benopsHoursRemaining < 2 ? "danger" : "warning"}
            />
            <SlaPill
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Employee window"
              value={`${enrichment.sla.employeeDaysRemaining}d left`}
              tone={enrichment.sla.employeeDaysRemaining < 5 ? "warning" : "neutral"}
            />
            <StatusBadge status={qle.status} statusLabel={qle.status_label} />
          </div>
        </div>
      </header>

      {/* Late-submission banner */}
      {qle.flagged_late && (
        <Card className="border-[var(--color-warning)] bg-[var(--color-warning-soft)] mb-4">
          <CardContent className="py-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] mt-0.5" />
            <p className="text-sm text-ink-2">
              <strong>Late submission.</strong> Event date is past the 30-day election window.
              Confirm with state rules before approving.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main 2-col layout: document on left, decision rail on right */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5 mb-5">
        <div className="space-y-5 min-w-0">
          {/* Document preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Uploaded document</span>
                {document && (
                  <Badge variant={
                    document.routing_decision === "auto_approve" ? "success" :
                    document.routing_decision === "benops_review" ? "warning" :
                    "danger"
                  }>
                    {(document.routing_decision || "").replace("_", " ") || "—"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-5">
                <DocPreview enrichment={enrichment} filename={document?.filename || "document.pdf"} />
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
                      Classifier output
                    </div>
                    <ConfidenceMeter value={document?.confidence ?? 0} />
                    <dl className="mt-3 space-y-2 text-sm">
                      <RowKV k="Classified as" v={document?.classified_type || "uncertain"} />
                      <RowKV k="Document type" v={enrichment.doc.previewTitle.split("—").pop()?.trim() || "—"} />
                      <RowKV k="Quality" v={document?.quality_issue || "OK"} />
                    </dl>
                  </div>
                  {document?.notes && (
                    <div className="text-xs p-3 rounded-lg bg-surface-2 border border-default leading-relaxed">
                      <div className="flex items-center gap-1.5 text-muted font-medium mb-1">
                        <Sparkles className="h-3 w-3" />
                        System note
                      </div>
                      <div className="text-ink-2">{document.notes}</div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Field-match table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Field match — document vs employee</span>
                <Badge
                  variant={
                    enrichment.overallMatch === "match" ? "success" :
                    enrichment.overallMatch === "warn" ? "warning" :
                    "danger"
                  }
                >
                  Overall: {enrichment.overallMatch === "match" ? "Match" : enrichment.overallMatch === "warn" ? "Minor issues" : "Mismatch"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <FieldMatchTable enrichment={enrichment} />
            </CardContent>
          </Card>

          {/* Requested elections */}
          <Card>
            <CardHeader>
              <CardTitle>Requested elections</CardTitle>
            </CardHeader>
            <CardContent>
              <ElectionsCard enrichment={enrichment} />
            </CardContent>
          </Card>

          {/* Dependent verification */}
          {enrichment.dependentClaim && (
            <Card>
              <CardHeader>
                <CardTitle>Dependent to be added</CardTitle>
              </CardHeader>
              <CardContent>
                <DependentCard dep={enrichment.dependentClaim} />
              </CardContent>
            </Card>
          )}

          {/* Audit (collapsed by default) */}
          <details className="card-elevated">
            <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between">
              <CardTitle>Audit trail ({qle.audit?.length || 0} events)</CardTitle>
              <ChevronDown className="h-4 w-4 text-muted-2" />
            </summary>
            <div className="px-6 pb-5">
              <AuditTimeline entries={qle.audit || []} />
            </div>
          </details>
        </div>

        {/* Decision rail */}
        <aside className="space-y-4 xl:sticky xl:top-4 self-start">
          <ReviewForm
            qleId={qle.id}
            reviewerName={session.name}
            enrichment={enrichment}
          />

          <Card>
            <CardHeader>
              <CardTitle>Employee context</CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeContextCard employee={qle.employee} enrichment={enrichment} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function SlaPill({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "danger" | "warning" | "neutral";
}) {
  const cls =
    tone === "danger" ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" :
    tone === "warning" ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" :
    "bg-surface-2 text-ink-2";
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${cls}`}>
      {icon}
      <span className="text-muted">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function RowKV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-ink-2 font-medium text-right truncate">{v}</dd>
    </div>
  );
}
