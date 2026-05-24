import Link from "next/link";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { AppShell, PageHeader, buildSidebarSections } from "@/components/persona-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskActions } from "./task-actions";
import { PrefilledFields } from "@/components/review/prefilled-fields";
import { formatDateTime } from "@/lib/utils";
import { Globe, CircleCheck, AlertTriangle, Mail, ListChecks, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("benops");
  const card = await api.getTask(parseInt(id));

  return (
    <AppShell session={session} sidebarSections={buildSidebarSections(session, "/ops")}>
      <div className="mb-6">
        <Link href="/ops" className="text-sm text-muted hover:text-ink">← Back to queue</Link>
      </div>
      <PageHeader
        title={`${card.carrier} portal update`}
        description={`#${card.qle_id} · ${card.qle.employee?.name}`}
        actions={
          card.status === "completed" ? <Badge variant="success">Completed</Badge> :
          card.status === "portal_unavailable" ? <Badge variant="warning">Portal down — rescheduled</Badge> :
          <Badge variant="brand">Open</Badge>
        }
      />

      {card.status === "completed" && (
        <div className="rounded-xl border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] p-4 mb-6 flex items-start gap-3">
          <CircleCheck className="h-5 w-5 text-[var(--color-success)] mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[var(--color-success)]">Task completed.</p>
            <p className="text-sm text-ink-2 mt-0.5">{formatDateTime(card.completed_at)}</p>
          </div>
        </div>
      )}

      {card.status === "portal_unavailable" && (
        <div className="rounded-xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[var(--color-warning)]">Portal unavailable.</p>
            <p className="text-sm text-ink-2 mt-0.5">Rescheduled to {formatDateTime(card.rescheduled_to)}. HR admin notified.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted" /> Portal</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={card.portal_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-default bg-surface hover:bg-surface-2 text-sm font-medium transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                Open {card.carrier} portal
                <ExternalLink className="h-3 w-3 text-muted-2" />
              </a>
              <div className="text-xs text-muted-2 mt-2 font-mono break-all">{card.portal_url}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pre-filled data</CardTitle>
              <p className="text-sm text-muted mt-1">
                Hover any row and click the copy icon, or open the portal to paste directly. Nested fields are formatted as their own sub-table.
              </p>
            </CardHeader>
            <CardContent>
              <PrefilledFields data={card.prefilled_data as Record<string, unknown>} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-muted" /> Portal checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {card.checklist.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="h-5 w-5 rounded-full bg-surface-3 text-muted text-xs font-medium flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-ink-2">{step.replace(/^\d+\.\s*/, "")}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted" /> Pre-drafted confirmation email</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm whitespace-pre-wrap font-sans bg-surface-2 p-4 rounded-lg border border-default">{card.drafted_email}</pre>
            </CardContent>
          </Card>
        </div>

        <aside>
          {card.status !== "completed" && (
            <Card>
              <CardHeader><CardTitle>Complete this task</CardTitle></CardHeader>
              <CardContent>
                <TaskActions taskId={card.id} carrier={card.carrier} actorName={session.name} />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
