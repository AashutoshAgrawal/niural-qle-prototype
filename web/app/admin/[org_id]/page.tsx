import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, CircleCheck, AlertTriangle, FileStack, Database,
  Building2, Clock, ShieldCheck, Activity, Users, Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { AppShell, PageHeader, buildSidebarSections } from "@/components/persona-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, SlaIndicator } from "@/components/sla-indicator";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Sparkline } from "@/components/dashboard/sparkline";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { adminStats, sparkSeries, deltaVsLastWeek } from "@/lib/dashboard-mock";
import { formatDate, daysBetween, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_KEYS = [
  "submitted", "documents_verified", "election_pending", "election_confirmed",
  "carrier_in_progress", "active", "rejected", "benops_review",
];

const STATUS_DISPLAY: Record<string, string> = {
  submitted: "Submitted",
  documents_verified: "Documents verified",
  election_pending: "Election pending",
  election_confirmed: "Election confirmed",
  carrier_in_progress: "Carrier update",
  active: "Active",
  rejected: "Rejected",
  benops_review: "Under review",
};

export default async function AdminDashboard({ params }: { params: Promise<{ org_id: string }> }) {
  const { org_id } = await params;
  const session = await requireRole("hr_admin");
  if (parseInt(org_id) !== session.org_id) redirect(`/admin/${session.org_id}`);

  const data = await api.getOrg(parseInt(org_id));
  const total = data.sla_counts.green + data.sla_counts.yellow + data.sla_counts.red;
  const stats = adminStats(data);

  // Risk callouts: QLEs close to deadline that aren't active
  const atRisk = data.qles
    .filter((q) => q.status !== "active" && q.status !== "rejected")
    .map((q) => ({ qle: q, days: daysBetween(q.election_deadline) }))
    .filter((x) => x.days <= 7)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  // Recent activity — derive from real QLEs
  const recentActivity = data.qles.slice(0, 6).map((q) => ({
    id: `q${q.id}`,
    when: timeAgo(q.created_at),
    actor: q.employee?.name ?? "Employee",
    action: `submitted a ${q.event_type_label.toLowerCase()} event`,
    ref: { label: `#${q.id}`, href: `/qle/${q.id}` },
    tone: (q.status === "rejected" ? "danger" :
           q.status === "benops_review" ? "warning" :
           q.status === "active" ? "success" : "brand") as "danger" | "warning" | "success" | "brand",
  }));

  // Carrier health snapshot
  const carrierHealth = computeCarrierHealth(data);

  // Event type distribution
  const eventCounts = data.qles.reduce<Record<string, number>>((acc, q) => {
    acc[q.event_type_label] = (acc[q.event_type_label] || 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell session={session} sidebarSections={buildSidebarSections(session, `/admin/${org_id}`)}>
      <PageHeader
        title="Benefits dashboard"
        description={`${data.name} · ${data.employees.length} employees · Real-time view of every QLE`}
        actions={
          <div className="hidden md:flex items-center gap-2 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-[var(--color-success)] animate-pulse" />
            Live · last refreshed just now
          </div>
        }
      />

      {/* HERO KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Total events"
          value={total}
          icon={FileStack}
          accent="brand"
          delta={stats.totalDelta}
          spark={stats.totalSpark}
          hint="All life events across your org"
        />
        <KpiCard
          label="On track"
          value={data.sla_counts.green}
          icon={CircleCheck}
          accent="success"
          delta={stats.greenDelta}
          spark={sparkSeries(data.id + 4, data.sla_counts.green)}
          hint="Within SLA, no action needed"
        />
        <KpiCard
          label="At risk"
          value={data.sla_counts.yellow}
          icon={AlertTriangle}
          accent="warning"
          delta={deltaVsLastWeek(data.id + 5, data.sla_counts.yellow)}
          deltaInverted
          spark={sparkSeries(data.id + 5, data.sla_counts.yellow)}
          hint="Approaching SLA breach"
        />
        <KpiCard
          label="Overdue"
          value={data.sla_counts.red}
          icon={Clock}
          accent="danger"
          delta={stats.redDelta}
          deltaInverted
          spark={stats.redSpark}
          hint="Past SLA — needs immediate attention"
        />
      </div>

      {/* SECONDARY KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SecondaryStat
          label="Active coverage"
          value={`${stats.activeCoverageEmployees}/${data.employees.length}`}
          hint="Employees enrolled"
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <SecondaryStat
          label="Avg time to active"
          value={`${stats.avgResolutionDays}d`}
          hint="Submit → coverage live"
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <SecondaryStat
          label="Auto-approval rate"
          value={`${stats.approvalRatePct}%`}
          hint="Documents that skipped manual review"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
        />
        <SecondaryStat
          label="Events this quarter"
          value={data.qles.length}
          hint="Up from prior quarter"
          icon={<Calendar className="h-3.5 w-3.5" />}
        />
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 mb-5">
        <div className="space-y-5 min-w-0">
          {/* At-risk callouts */}
          {atRisk.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
                  Needs your attention
                  <Badge variant="warning">{atRisk.length}</Badge>
                </CardTitle>
                <p className="text-sm text-muted mt-1">Employees whose election window closes within 7 days.</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {atRisk.map(({ qle, days }) => (
                  <Link
                    key={qle.id}
                    href={`/qle/${qle.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-default bg-surface hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${
                        days <= 0 ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" :
                        days <= 2 ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" :
                        "bg-surface-2 text-muted"
                      }`}>
                        <Clock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink truncate">
                          {qle.employee?.name} · {qle.event_type_label}
                        </div>
                        <div className="text-xs text-muted truncate">
                          Status: {qle.status_label} · Deadline {formatDate(qle.election_deadline)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-semibold tabular-nums ${
                        days <= 0 ? "text-[var(--color-danger)]" :
                        days <= 2 ? "text-[var(--color-warning)]" :
                        "text-ink-2"
                      }`}>
                        {days <= 0 ? "Overdue" : `${days}d left`}
                      </div>
                      <div className="text-xs text-muted-2">to elect</div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Status breakdown chart */}
          <Card>
            <CardHeader>
              <CardTitle>By stage</CardTitle>
              <p className="text-sm text-muted mt-1">Where every event sits in the workflow right now.</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {STATUS_KEYS.map((k) => {
                  const count = data.status_counts[k] || 0;
                  const max = Math.max(...Object.values(data.status_counts || {}), 1);
                  const pct = (count / max) * 100;
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <span className="text-sm text-ink-2 w-36 shrink-0">{STATUS_DISPLAY[k]}</span>
                      <div className="flex-1 h-2.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: count > 0 ? `${Math.max(8, pct)}%` : "0%", background: stageColor(k) }}
                        />
                      </div>
                      <span className="text-sm tabular-nums w-8 text-right font-medium text-ink">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Carrier health snapshot */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted" />
                Carrier health
              </CardTitle>
              <p className="text-sm text-muted mt-1">How each carrier is performing on your team&apos;s recent QLEs.</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {carrierHealth.map((c) => (
                  <div key={c.name} className="rounded-lg border border-default bg-surface p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-ink">{c.name}</div>
                      <Badge variant={c.viaApi ? "success" : "warning"}>
                        {c.viaApi ? "Noyo API" : "Manual portal"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <KvLine label="Submitted" value={c.submitted} />
                      <KvLine label="Verified" value={c.verified} accent={c.verified === c.submitted ? "success" : undefined} />
                      <KvLine label="Failed" value={c.failed} accent={c.failed > 0 ? "danger" : undefined} />
                    </div>
                    <div className="h-2 bg-surface-2 rounded-full mt-3 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: c.submitted > 0 ? `${(c.verified / c.submitted) * 100}%` : "0%",
                          background: "var(--color-success)",
                        }}
                      />
                    </div>
                    <div className="text-xs text-muted-2 mt-1.5">
                      {c.submitted > 0
                        ? `${Math.round((c.verified / c.submitted) * 100)}% verified active`
                        : "No recent activity"}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Full event table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted" />
                Your team&apos;s events
                <Badge variant="neutral">{data.qles.length}</Badge>
              </CardTitle>
              <p className="text-sm text-muted mt-1">
                Click any row to see the full status, document, and audit trail. No need to email Niural.
              </p>
            </CardHeader>
            <CardContent className="p-0 pb-0">
              {data.qles.length === 0 ? (
                <Empty icon={Database} title="No events yet" description="When your employees report a life event, it'll show up here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-2 border-y border-default text-[11px] uppercase tracking-wider text-muted font-semibold">
                      <tr>
                        <th className="text-left px-4 py-2.5">Employee</th>
                        <th className="text-left px-4 py-2.5">Event</th>
                        <th className="text-left px-4 py-2.5">State / Carrier</th>
                        <th className="text-left px-4 py-2.5">Submitted</th>
                        <th className="text-left px-4 py-2.5">Deadline</th>
                        <th className="text-left px-4 py-2.5">Status</th>
                        <th className="text-left px-4 py-2.5">SLA</th>
                        <th className="text-right px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.qles.map((q) => (
                        <tr key={q.id} className="border-b border-default last:border-0 hover:bg-surface-2 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-ink">{q.employee?.name}</td>
                          <td className="px-4 py-2.5 text-ink-2">{q.event_type_label}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <Badge variant="neutral">{q.employee?.state}</Badge>
                              <Badge variant="brand">{q.employee?.carrier}</Badge>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-muted text-xs">{formatDate(q.created_at)}</td>
                          <td className="px-4 py-2.5 text-muted text-xs">{formatDate(q.election_deadline)}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={q.status} statusLabel={q.status_label} />
                          </td>
                          <td className="px-4 py-2.5"><SlaIndicator health={q.sla_health} label /></td>
                          <td className="px-4 py-2.5 text-right">
                            <Link
                              href={`/qle/${q.id}`}
                              className="inline-flex items-center gap-1 text-[var(--color-brand)] text-sm font-medium hover:underline"
                            >
                              Open <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          {/* Event mix mini-chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileStack className="h-4 w-4 text-muted" />
                Event mix
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(eventCounts).length === 0 ? (
                <div className="text-sm text-muted py-2">No events yet.</div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(eventCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => {
                      const max = Math.max(...Object.values(eventCounts));
                      const pct = (v / max) * 100;
                      return (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className="w-28 text-ink-2 truncate">{k}</span>
                          <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="tabular-nums w-5 text-right">{v}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted" />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed items={recentActivity} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--color-success)]" />
                14-day trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{total}</div>
                  <div className="text-xs text-muted">events</div>
                </div>
                <Sparkline data={stats.totalSpark} width={120} height={40} accent="brand" />
              </div>
              <div className="text-xs text-muted-2 pt-2 border-t border-default">
                Showing the last 14 days. Volume is roughly stable — what matters is the SLA mix above.
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}

function SecondaryStat({
  label, value, hint, icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-default bg-surface p-4">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted font-semibold mb-1.5">
        {icon}{label}
      </div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-2 mt-0.5">{hint}</div>}
    </div>
  );
}

function KvLine({ label, value, accent }: { label: string; value: number; accent?: "success" | "danger" }) {
  const cls = accent === "success" ? "text-[var(--color-success)]" : accent === "danger" ? "text-[var(--color-danger)]" : "text-ink-2";
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function stageColor(stage: string): string {
  if (stage === "active") return "var(--color-success)";
  if (stage === "rejected") return "var(--color-danger)";
  if (stage === "benops_review") return "var(--color-warning)";
  if (stage.startsWith("election")) return "var(--color-violet)";
  return "var(--color-brand)";
}

function computeCarrierHealth(data: Awaited<ReturnType<typeof api.getOrg>>) {
  const map = new Map<string, { name: string; viaApi: boolean; submitted: number; verified: number; failed: number }>();
  for (const q of data.qles) {
    for (const t of q.carrier_transactions) {
      const m = map.get(t.carrier) || { name: t.carrier, viaApi: true, submitted: 0, verified: 0, failed: 0 };
      m.submitted += 1;
      if (t.verification_status === "verified") m.verified += 1;
      if (t.verification_status === "failed") m.failed += 1;
      map.set(t.carrier, m);
    }
    for (const t of q.task_cards) {
      const m = map.get(t.carrier) || { name: t.carrier, viaApi: false, submitted: 0, verified: 0, failed: 0 };
      m.viaApi = false;
      m.submitted += 1;
      if (t.verification_status === "verified") m.verified += 1;
      if (t.verification_status === "failed") m.failed += 1;
      map.set(t.carrier, m);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.submitted - a.submitted);
}
