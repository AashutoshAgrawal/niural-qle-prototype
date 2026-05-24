import Link from "next/link";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { AppShell, PageHeader, buildSidebarSections } from "@/components/persona-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuditTimeline } from "@/components/audit-timeline";
import { ResolveForm } from "./resolve-form";
import { PrefilledFields } from "@/components/review/prefilled-fields";
import { formatDateTime } from "@/lib/utils";
import { AlertTriangle, Network, Code2, ChevronDown } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EscalationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("benops");
  const txn = await api.getEscalation(parseInt(id));

  return (
    <AppShell session={session} sidebarSections={buildSidebarSections(session, "/ops")}>
      <div className="mb-6">
        <Link href="/ops" className="text-sm text-muted hover:text-ink">← Back to queue</Link>
      </div>
      <PageHeader
        title="Carrier escalation"
        description={`#${txn.qle_id} · ${txn.carrier} via Noyo`}
        actions={<Badge variant="danger">{txn.status}</Badge>}
      />

      <div className="rounded-xl border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-[var(--color-danger)] mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[var(--color-danger)]">
            No acknowledgement from {txn.carrier} after {txn.retry_count + 1} attempt{txn.retry_count !== 0 ? "s" : ""}.
          </p>
          <p className="text-sm text-ink-2 mt-0.5">
            Daily reconciliation flagged this transaction. Full payload available below for Noyo support.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Network className="h-4 w-4 text-muted" /> Transaction</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted">Noyo transaction ID</dt><dd className="font-mono">{txn.transaction_id || "—"}</dd>
                <dt className="text-muted">Submitted</dt><dd>{formatDateTime(txn.submitted_at)}</dd>
                <dt className="text-muted">Retries</dt><dd className="tabular-nums">{txn.retry_count}</dd>
                <dt className="text-muted">Error</dt><dd>{txn.error || "(no explicit error — silent drop suspected)"}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payload sent to Noyo</CardTitle>
              <p className="text-sm text-muted mt-1">The structured request submitted to Noyo. Expand the raw JSON below if you need to share it with Noyo support.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <PrefilledFields data={txn.payload as Record<string, unknown>} />
              <details className="rounded-lg border border-default">
                <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between text-xs text-muted hover:bg-surface-2">
                  <span className="flex items-center gap-1.5">
                    <Code2 className="h-3.5 w-3.5" />
                    Raw JSON (for Noyo support tickets)
                  </span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </summary>
                <pre className="text-xs font-mono whitespace-pre-wrap bg-surface-2 p-3 border-t border-default overflow-auto max-h-80">
                  {JSON.stringify(txn.payload, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>

          <ResolveForm txnId={txn.id} actorName={session.name} />
        </div>

        <aside>
          <Card>
            <CardHeader><CardTitle>Audit trail</CardTitle></CardHeader>
            <CardContent><AuditTimeline entries={txn.qle.audit || []} /></CardContent>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
