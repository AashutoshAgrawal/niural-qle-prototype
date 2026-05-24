import { Mail, MapPin, Briefcase, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/ui/badge";
import type { Employee } from "@/lib/api";
import type { ReviewEnrichment } from "@/lib/review-mock";

export function EmployeeContextCard({
  employee,
  enrichment,
}: {
  employee: Employee | null;
  enrichment: ReviewEnrichment;
}) {
  if (!employee) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Avatar name={employee.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink truncate">{employee.name}</div>
          <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
            <Mail className="h-3 w-3" /> {employee.email}
          </div>
          <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
            <Briefcase className="h-3 w-3" /> {employee.organization?.name ?? "—"}
          </div>
          <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
            <MapPin className="h-3 w-3" /> {employee.state}
          </div>
        </div>
      </div>

      <div className="border-t border-default pt-3">
        <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-2">
          Current coverage
        </div>
        <div className="space-y-1.5">
          {employee.coverages.filter((c) => c.active).map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="text-ink">{c.line_label}</span>
              <span className="text-muted text-xs">{c.carrier} · {c.plan_type}</span>
            </div>
          ))}
          {employee.coverages.filter((c) => c.active).length === 0 && (
            <div className="text-sm text-muted-2 italic">No active coverage</div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-muted">Current tier</span>
          <Badge variant="neutral">{enrichment.eligibility.currentTier}</Badge>
        </div>
      </div>

      <div className="border-t border-default pt-3 flex items-center gap-2 text-sm">
        <Users className="h-3.5 w-3.5 text-muted-2" />
        <span className="text-muted">{enrichment.eligibility.priorQleSummary}</span>
      </div>
    </div>
  );
}
