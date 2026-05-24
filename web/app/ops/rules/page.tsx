import Link from "next/link";
import { api } from "@/lib/api";
import { requireRole } from "@/lib/session";
import { AppShell, PageHeader, buildSidebarSections } from "@/components/persona-shell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RulesAdmin } from "./rules-admin";
import { Scale, Check, X } from "lucide-react";

const EVENT_LABEL: Record<string, string> = {
  dependent_aging_off: "Dependent aging off",
  marriage: "Marriage",
  divorce: "Divorce",
  birth_adoption: "Birth or adoption",
  death_of_dependent: "Death of dependent",
  loss_of_other_coverage: "Loss of other coverage",
};

const CONDITION_LABEL: Record<string, (v: unknown) => { label: string; value: string }> = {
  unmarried:           (v) => ({ label: "Marital status",     value: v ? "Unmarried" : "Married" }),
  nj_resident:         (v) => ({ label: "Residency",          value: v ? "New Jersey" : "Other" }),
  ny_resident:         (v) => ({ label: "Residency",          value: v ? "New York"   : "Other" }),
  no_other_coverage:   (v) => ({ label: "Other coverage",     value: v ? "None on file" : "Has other" }),
  no_employer_coverage:(v) => ({ label: "Employer coverage",  value: v ? "Not eligible" : "Eligible" }),
  disabled_dependent:  (v) => ({ label: "Disability status",  value: v ? "Disabled dependent" : "Not disabled" }),
  veteran:             (v) => ({ label: "Veteran status",     value: v ? "Veteran"     : "Non-veteran" }),
  max_age:             (v) => ({ label: "Max age",            value: `≤ ${v} years` }),
};

const ACTION_LABEL: Record<string, string> = {
  federal_cobra: "COBRA (federal)",
  nj_continuation_to_31: "NJ continuation (to 31)",
  ny_young_adult_option_to_29: "NY Young Adult Option (to 29)",
  cal_cobra_extension: "Cal-COBRA extension",
  il_military_dependent_to_30: "IL military dependent (to 30)",
};

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const session = await requireRole("benops");
  const rules = await api.listRules();

  return (
    <AppShell session={session} sidebarSections={buildSidebarSections(session, "/ops/rules")}>
      <div className="mb-6">
        <Link href="/ops" className="text-sm text-muted hover:text-ink">← Back to queue</Link>
      </div>
      <PageHeader
        title="State rules"
        description="State-specific continuation rules. You can add, modify, or deactivate rules without an engineering deploy."
      />

      <div className="rounded-xl border border-[var(--color-violet-soft)] bg-[var(--color-violet-soft)] p-4 mb-6 flex items-start gap-3">
        <Scale className="h-5 w-5 text-[var(--color-violet)] mt-0.5" />
        <p className="text-sm text-ink-2">
          When a dependent ages off, the rules engine consults this table for the employee&apos;s state. If conditions match, state continuation is surfaced alongside federal COBRA.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Existing rules ({rules.filter(r => r.active).length} active)</CardTitle>
          <p className="text-sm text-muted mt-1">Each row maps a (state, event, conditions) tuple to the additional options surfaced to the employee. Conditions are evaluated against the dependent on file.</p>
        </CardHeader>
        <CardContent className="pb-0">
          <div className="-mx-6">
            <Table>
              <THead>
                <TR>
                  <TH>State</TH>
                  <TH>Applies to</TH>
                  <TH>Conditions</TH>
                  <TH>Eligible actions</TH>
                  <TH>Citation</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {rules.map((r) => {
                  const conditions = Object.entries(r.conditions || {});
                  return (
                    <TR key={r.id}>
                      <TD><Badge variant="violet">{r.state}</Badge></TD>
                      <TD className="text-sm">{EVENT_LABEL[r.event_type] || r.event_type.replace(/_/g, " ")}</TD>
                      <TD>
                        {conditions.length === 0 ? (
                          <span className="text-xs text-muted-2 italic">No conditions</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-sm">
                            {conditions.map(([k, v]) => {
                              const meta = CONDITION_LABEL[k];
                              const text = meta ? `${meta(v).label}: ${meta(v).value}` : `${k}: ${String(v)}`;
                              return (
                                <span key={k} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-surface-2 border border-default text-ink-2">
                                  {text}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {r.eligible_actions.map((a) => (
                            <Badge key={a} variant="neutral" className="text-[10px]">
                              {ACTION_LABEL[a] || a.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      </TD>
                      <TD className="text-xs italic text-muted max-w-[200px] truncate" title={r.citation || ""}>{r.citation || "—"}</TD>
                      <TD>
                        {r.active ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success)] font-medium">
                            <Check className="h-3 w-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted font-medium">
                            <X className="h-3 w-3" /> Inactive
                          </span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RulesAdmin />
    </AppShell>
  );
}
