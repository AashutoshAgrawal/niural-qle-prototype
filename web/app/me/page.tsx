import Link from "next/link";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { AppShell, PageHeader, buildSidebarSections } from "@/components/persona-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge, SlaIndicator } from "@/components/sla-indicator";
import { ProactiveBanner } from "@/components/proactive-banner";
import { formatDate, daysBetween } from "@/lib/utils";
import { Plus, FileText, ArrowRight, MapPin, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyPortal() {
  const session = await requireRole("employee");
  const data = await api.getEmployee(session.id);

  const pendingNotifs = (data.proactive_notifications || []).filter(n => !n.acknowledged_at && !n.converted_qle_id);

  return (
    <AppShell session={session} sidebarSections={buildSidebarSections(session, "/me")}>
      <PageHeader
        title="Your benefits"
        description="Review your coverage and report any changes in your life that affect your benefits."
        actions={
          <Link href="/me/submit">
            <Button variant="primary"><Plus /> Report a life event</Button>
          </Link>
        }
      />

      {/* Phase 0: proactive notifications surface at the top */}
      <ProactiveBanner notifications={pendingNotifs} />

      <div className="flex items-center gap-2 mb-6">
        <Badge variant="neutral"><Building2 className="h-2.5 w-2.5" /> {data.organization?.name}</Badge>
        <Badge variant="neutral"><MapPin className="h-2.5 w-2.5" /> {data.state}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
        {data.coverages.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between mb-1.5">
              <div className="text-xs text-muted uppercase tracking-wider font-medium">{c.line_label}</div>
              <Badge variant="brand">{c.carrier}</Badge>
            </div>
            <div className="font-semibold tracking-tight">{c.plan_type}</div>
            <div className="text-xs text-muted mt-1">Active</div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your qualifying life events</CardTitle>
          <p className="text-sm text-muted mt-1">
            Marriage, divorce, birth, loss of coverage, or a dependent aging off let you change your benefits outside open enrollment.
          </p>
        </CardHeader>
        <CardContent className="pb-0">
          {data.qles.length === 0 ? (
            <Empty
              icon={FileText}
              title="No life events on file"
              description="When something changes — marriage, baby, a dependent ages off — start here."
              action={
                <Link href="/me/submit">
                  <Button variant="primary"><Plus /> Report a life event</Button>
                </Link>
              }
            />
          ) : (
            <div className="-mx-6">
              <Table>
                <THead>
                  <TR>
                    <TH>Event</TH>
                    <TH>Event date</TH>
                    <TH>Status</TH>
                    <TH>SLA</TH>
                    <TH>Deadline</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {data.qles.map((q) => {
                    const days = daysBetween(q.election_deadline);
                    return (
                      <TR key={q.id}>
                        <TD className="font-medium">{q.event_type_label}</TD>
                        <TD className="text-muted">{formatDate(q.event_date)}</TD>
                        <TD><StatusBadge status={q.status} statusLabel={q.status_label} /></TD>
                        <TD><SlaIndicator health={q.sla_health} label /></TD>
                        <TD className="text-muted">
                          {formatDate(q.election_deadline)}
                          <span className="text-xs text-muted-2 ml-1">({days}d)</span>
                        </TD>
                        <TD>
                          <Link href={`/qle/${q.id}`} className="text-brand text-sm font-medium inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                            View <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
