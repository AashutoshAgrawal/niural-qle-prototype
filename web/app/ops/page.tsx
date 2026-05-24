import Link from "next/link";
import {
  AlertTriangle, FileSearch, Network, Clipboard, ShieldCheck,
  ArrowRight, CircleCheck, Inbox, ShieldAlert, Flag, Clock, Activity,
  Sparkles, TrendingUp, Filter,
} from "lucide-react";
import { api, type QLE, type CarrierTxn, type TaskCard } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { AppShell, PageHeader, buildSidebarSections } from "@/components/persona-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { ReconcileButton, ReminderButton, ProactiveScanButton } from "@/components/benops-actions";
import { DisputeResolveForm } from "./dispute-resolve-form";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { QueueRow, QueueList, type RowTone } from "@/components/dashboard/queue-row";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import {
  benopsStats, triggerReason, priority, escalationReason, manualTaskReason, activityFeed,
} from "@/lib/dashboard-mock";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OpsQueue() {
  const session = await requireRole("benops");
  const q = await api.benopsQueue();
  const stats = benopsStats(q);
  const feed = activityFeed(q);

  // Sort review queue by priority/SLA urgency
  const sortedReview = [...q.review_queue].sort((a, b) => priority(a).rank - priority(b).rank);

  return (
    <AppShell session={session} sidebarSections={buildSidebarSections(session, "/ops")}>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <PageHeader
          title="Operations console"
          description={`Signed in as ${session.name}. Events sorted by SLA urgency.`}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <ReconcileButton />
          <ReminderButton />
          <ProactiveScanButton />
        </div>
      </div>

      {/* HERO KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Awaiting review"
          value={q.counts.review}
          icon={FileSearch}
          accent="warning"
          delta={stats.reviewDelta}
          spark={stats.reviewSpark}
          hint="Documents the OCR couldn't auto-approve."
          href="#section-review"
        />
        <KpiCard
          label="Carrier escalations"
          value={q.counts.escalations}
          icon={ShieldAlert}
          accent="danger"
          delta={stats.escDelta}
          deltaInverted
          spark={stats.escSpark}
          hint="Noyo acked but coverage never reached carrier claims."
          href="#section-escalations"
        />
        <KpiCard
          label="Manual portal tasks"
          value={q.counts.tasks}
          icon={Clipboard}
          accent="brand"
          delta={stats.taskDelta}
          spark={stats.taskSpark}
          hint="Arlo and Angle — no API. BenOps logs into the portal."
          href="#section-tasks"
        />
        <KpiCard
          label="Verifications due"
          value={q.counts.verifications_due}
          icon={ShieldCheck}
          accent="violet"
          delta={stats.verifDelta}
          spark={stats.verifSpark}
          hint="48–72h follow-up to confirm portal update landed."
          href="#section-verifications"
        />
      </div>

      {/* SECONDARY KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SecondaryStat
          label="Median resolution"
          value={`${stats.medianResolutionHours}h`}
          icon={<Clock className="h-3.5 w-3.5" />}
          hint="From submit → coverage active"
        />
        <SecondaryStat
          label="SLA breach rate"
          value={`${stats.slaBreachRatePct}%`}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          hint="Target: under 5%"
          tone={stats.slaBreachRatePct > 5 ? "danger" : "success"}
        />
        <SecondaryStat
          label="Closed today"
          value={stats.itemsClosedToday}
          icon={<CircleCheck className="h-3.5 w-3.5" />}
          hint={`by ${session.name.split(" ")[0]} and team`}
        />
        <SecondaryStat
          label="At risk this week"
          value={q.counts.at_risk}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          hint="QLEs > 2 days old, not active"
          tone={q.counts.at_risk > 0 ? "warning" : "success"}
        />
      </div>

      {/* MAIN GRID: queue on the left, activity feed on the right */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5 min-w-0">
          {/* Documents awaiting review */}
          <Card id="section-review" className="scroll-mt-24">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-[var(--color-warning)]" />
                  Documents awaiting review
                  <Badge variant="warning">{q.review_queue.length}</Badge>
                </CardTitle>
                <SortHint label="Sorted by SLA urgency" />
              </div>
              <p className="text-sm text-muted mt-1">
                Medium-confidence documents the OCR couldn&apos;t auto-approve. SLA target: 4h to decision.
              </p>
            </CardHeader>
            <CardContent className="p-0 pb-0">
              {sortedReview.length === 0 ? (
                <Empty icon={CircleCheck} title="Inbox zero" description="No documents queued for review." />
              ) : (
                <QueueList>
                  
                  
                    {sortedReview.map((qle) => {
                      const reason = triggerReason(qle);
                      const prio = priority(qle);
                      return (
                        <QueueRow
                          key={qle.id}
                          priorityLabel={prio.label}
                          priorityTone={prio.tone}
                          triggerLabel={reason.label}
                          triggerTone={reason.tone}
                          identifier={`#${qle.id}`}
                          personName={qle.employee?.name ?? "—"}
                          personSubtitle={qle.employee?.organization?.name ?? undefined}
                          eventLabel={qle.event_type_label}
                          eventSubtitle={`Submitted ${timeAgo(qle.created_at)}`}
                          slaLabel={slaCountdown(qle)}
                          slaTone={slaToneFor(qle)}
                          owner={session.name}
                          actionLabel="Review"
                          actionHref={`/ops/review/${qle.id}`}
                        />
                      );
                    })}
                  
                </QueueList>
              )}
            </CardContent>
          </Card>

          {/* Carrier escalations */}
          <Card id="section-escalations" className="scroll-mt-24">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[var(--color-danger)]" />
                  Carrier escalations
                  <Badge variant="danger">{q.escalations.length}</Badge>
                </CardTitle>
                <SortHint label="Sorted by age" />
              </div>
              <p className="text-sm text-muted mt-1">
                Noyo acked, but the carrier&apos;s claims system has no record of the change. Reconciliation caught these.
              </p>
            </CardHeader>
            <CardContent className="p-0 pb-0">
              {q.escalations.length === 0 ? (
                <Empty icon={CircleCheck} title="No escalations" description="Every transaction verified active on the carrier side." />
              ) : (
                <QueueList>
                  
                  
                    {q.escalations.map((t) => (
                      <QueueRow
                        key={t.id}
                        priorityLabel="P0 · Drop"
                        priorityTone="danger"
                        triggerLabel={t.carrier}
                        triggerTone="danger"
                        identifier={`#${t.qle_id}`}
                        personName={qleEmployeeName(q.all_qles, t.qle_id) ?? "—"}
                        personSubtitle={qleOrgName(q.all_qles, t.qle_id)}
                        eventLabel={`${t.carrier} · ${t.coverage_line_label}`}
                        eventSubtitle={escalationReason(t)}
                        slaLabel={timeAgo(t.submitted_at)}
                        slaTone="danger"
                        owner={session.name}
                        actionLabel="Investigate"
                        actionHref={`/ops/escalation/${t.id}`}
                      />
                    ))}
                  
                </QueueList>
              )}
            </CardContent>
          </Card>

          {/* Manual carrier tasks (Arlo/Angle) */}
          <Card id="section-tasks" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clipboard className="h-4 w-4 text-[var(--color-brand)]" />
                Manual portal tasks
                <Badge variant="brand">{q.tasks.length}</Badge>
              </CardTitle>
              <p className="text-sm text-muted mt-1">
                Arlo and Angle — no API. Pre-filled task card with checklist and drafted carrier confirmation email.
              </p>
            </CardHeader>
            <CardContent className="p-0 pb-0">
              {q.tasks.length === 0 ? (
                <Empty icon={CircleCheck} title="No portal tasks" />
              ) : (
                <QueueList>
                  
                  
                    {q.tasks.map((t) => {
                      const reason = manualTaskReason(t);
                      return (
                        <QueueRow
                          key={t.id}
                          priorityLabel="P1 · Manual"
                          priorityTone="warning"
                          triggerLabel={reason.label}
                          triggerTone={reason.tone as RowTone}
                          identifier={`#${t.qle_id}`}
                          personName={qleEmployeeName(q.all_qles, t.qle_id) ?? "—"}
                          personSubtitle={qleOrgName(q.all_qles, t.qle_id)}
                          eventLabel={`${t.carrier} · ${t.coverage_line_label}`}
                          eventSubtitle={t.portal_url}
                          slaLabel={timeAgo(t.created_at)}
                          slaTone="warning"
                          owner={session.name}
                          actionLabel="Open"
                          actionHref={`/ops/task/${t.id}`}
                        />
                      );
                    })}
                  
                </QueueList>
              )}
            </CardContent>
          </Card>

          {/* Verifications due */}
          {q.verifications_due.length > 0 && (
            <Card id="section-verifications" className="scroll-mt-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[var(--color-violet)]" />
                  Verifications due
                  <Badge variant="violet">{q.verifications_due.length}</Badge>
                </CardTitle>
                <p className="text-sm text-muted mt-1">
                  48–72h after a manual portal update. Verify the carrier actually processed the change.
                </p>
              </CardHeader>
              <CardContent className="p-0 pb-0">
                <QueueList>
                  
                  
                    {q.verifications_due.map((t) => (
                      <QueueRow
                        key={t.id}
                        priorityLabel="P1 · Follow"
                        priorityTone="violet"
                        triggerLabel="Verify carrier"
                        triggerTone="violet"
                        identifier={`#${t.qle_id}`}
                        personName={qleEmployeeName(q.all_qles, t.qle_id) ?? "—"}
                        personSubtitle={qleOrgName(q.all_qles, t.qle_id)}
                        eventLabel={`${t.carrier} · ${t.coverage_line_label}`}
                        eventSubtitle={`Portal updated ${timeAgo(t.completed_at)}`}
                        slaLabel={t.verification_due ? timeAgo(t.verification_due) : "—"}
                        slaTone="warning"
                        owner={session.name}
                        actionLabel="Verify"
                        actionHref={`/ops/task/${t.id}`}
                      />
                    ))}
                  
                </QueueList>
              </CardContent>
            </Card>
          )}

          {/* Disputes */}
          {q.disputes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-[var(--color-violet)]" />
                  Disputed elections
                  <Badge variant="violet">{q.disputes.length}</Badge>
                </CardTitle>
                <p className="text-sm text-muted mt-1">
                  Employees who believe the rules engine missed an option they qualify for.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {q.disputes.map((d) => (
                  <div key={d.id} className="rounded-lg border border-default bg-surface p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="violet">Dispute</Badge>
                        <span className="font-mono text-xs text-muted">#{d.qle_id}</span>
                        <span className="text-muted">·</span>
                        <span className="text-muted text-xs">filed {timeAgo(d.created_at)}</span>
                      </div>
                      <Link href={`/qle/${d.qle_id}`} className="text-xs text-[var(--color-brand)] font-medium inline-flex items-center gap-1 hover:underline">
                        View QLE <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="text-sm italic text-ink-2 mb-3 px-3 py-2 rounded-md bg-[var(--color-violet-soft)]/60 border-l-2 border-[var(--color-violet)]">
                      &ldquo;{d.employee_reason}&rdquo;
                    </div>
                    <DisputeResolveForm disputeId={d.id} qleId={d.qle_id} actorName={session.name} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* All events */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-muted" />
                  All events
                  <Badge variant="neutral">{q.all_qles.length}</Badge>
                </CardTitle>
                <button className="text-xs text-muted hover:text-ink inline-flex items-center gap-1.5">
                  <Filter className="h-3 w-3" /> Filter
                </button>
              </div>
              <p className="text-sm text-muted mt-1">Every event in the system. Click any row to see status + audit.</p>
            </CardHeader>
            <CardContent className="p-0 pb-0">
              {q.all_qles.length === 0 ? (
                <Empty icon={Inbox} title="No events in system" />
              ) : (
                <QueueList>
                  
                  
                    {q.all_qles.map((qle) => {
                      const prio = priority(qle);
                      const totalLines = qle.carrier_transactions.length + qle.task_cards.length;
                      const verifiedLines =
                        qle.carrier_transactions.filter(t => t.verification_status === "verified").length
                        + qle.task_cards.filter(t => t.verification_status === "verified").length;
                      return (
                        <QueueRow
                          key={qle.id}
                          priorityLabel={prio.label}
                          priorityTone={prio.tone}
                          triggerLabel={qle.status_label}
                          triggerTone={statusTone(qle.status)}
                          identifier={`#${qle.id}`}
                          personName={qle.employee?.name ?? "—"}
                          personSubtitle={qle.employee?.organization?.name ?? undefined}
                          eventLabel={qle.event_type_label}
                          eventSubtitle={`Created ${timeAgo(qle.created_at)}`}
                          slaLabel={slaCountdown(qle)}
                          slaTone={slaToneFor(qle)}
                          owner={totalLines > 0 ? `${verifiedLines}/${totalLines}` : "—"}
                          actionLabel="View"
                          actionHref={`/qle/${qle.id}`}
                        />
                      );
                    })}
                  
                </QueueList>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-muted" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={feed} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-[var(--color-brand)]" />
                System tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted">
              <Tip
                title="Hit P0 first"
                body="Items past their SLA are highlighted red. Clear those before P1s."
              />
              <Tip
                title="Reconcile daily"
                body="Run reconciliation once a day to catch silent carrier drops before employees do."
              />
              <Tip
                title="Drafts save time"
                body="Each Arlo / Angle task ships with a pre-drafted confirmation email. Copy-paste, don't retype."
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function SortHint({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-2">
      <Filter className="h-3 w-3" />
      {label}
    </span>
  );
}

function SecondaryStat({
  label, value, icon, hint, tone,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  hint?: string;
  tone?: "danger" | "warning" | "success";
}) {
  const valColor =
    tone === "danger" ? "text-[var(--color-danger)]" :
    tone === "warning" ? "text-[var(--color-warning)]" :
    tone === "success" ? "text-[var(--color-success)]" :
    "text-ink";
  return (
    <div className="rounded-xl border border-default bg-surface p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
        {icon}{label}
      </div>
      <div className={`text-xl font-semibold tabular-nums ${valColor}`}>{value}</div>
      {hint && <div className="text-xs text-muted-2 mt-0.5">{hint}</div>}
    </div>
  );
}

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-ink-2 text-xs font-semibold mb-0.5">{title}</div>
      <div className="text-xs leading-relaxed">{body}</div>
    </div>
  );
}

function slaCountdown(qle: QLE): string {
  if (!qle.election_deadline) return "—";
  const ms = new Date(qle.election_deadline).getTime() - Date.now();
  if (ms <= 0) return "Overdue";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${hours}h left`;
}

function slaToneFor(qle: QLE): RowTone {
  if (qle.sla_health === "red") return "danger";
  if (qle.sla_health === "yellow") return "warning";
  return "success";
}

function statusTone(s: string): RowTone {
  if (s === "active") return "success";
  if (s === "rejected") return "danger";
  if (s === "benops_review" || s === "disputed") return "warning";
  if (s.startsWith("election")) return "violet";
  return "neutral";
}

function qleEmployeeName(qles: QLE[], qleId: number): string | null {
  const q = qles.find((q) => q.id === qleId);
  return q?.employee?.name ?? null;
}

function qleOrgName(qles: QLE[], qleId: number): string | undefined {
  const q = qles.find((q) => q.id === qleId);
  return q?.employee?.organization?.name;
}

// Suppress unused warnings for CarrierTxn/TaskCard types
type _Refs = CarrierTxn | TaskCard;
const _suppress: _Refs | null = null;
void _suppress;
