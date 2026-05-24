import Link from "next/link";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { AppShell, PageHeader, buildSidebarSections } from "@/components/persona-shell";
import { SubmitForm } from "./submit-form";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const session = await requireRole("employee");
  const employee = await api.getEmployee(session.id);

  return (
    <AppShell session={session} sidebarSections={buildSidebarSections(session, "/me/submit")}>
      <div className="mb-6">
        <Link href="/me" className="text-sm text-muted hover:text-ink">← Back</Link>
      </div>
      <PageHeader
        title="Report a qualifying life event"
        description="A QLE — marriage, birth, divorce, or similar — lets you change your benefits outside open enrollment. You have 30 days from the event."
      />
      <SubmitForm employee={employee} />
    </AppShell>
  );
}
