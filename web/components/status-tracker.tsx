import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "submitted", label: "Submitted" },
  { key: "documents_verified", label: "Documents verified" },
  { key: "election_pending", label: "Election pending" },
  { key: "election_confirmed", label: "Election confirmed" },
  { key: "carrier_in_progress", label: "Carrier update" },
  { key: "coverage_verifying", label: "Verifying coverage" },
  { key: "active", label: "Coverage active" },
];

const TERMINAL_PROBLEM = new Set(["rejected", "benops_review", "disputed"]);

export function StatusTracker({ status }: { status: string }) {
  let activeIdx = STAGES.findIndex((s) => s.key === status);
  if (activeIdx === -1) activeIdx = 0;
  const problem = TERMINAL_PROBLEM.has(status);

  return (
    <div className="flex items-center w-full">
      {STAGES.map((stage, i) => {
        const isDone = !problem && i < activeIdx;
        const isCurrent = !problem && i === activeIdx;
        const isPending = problem || i > activeIdx;
        return (
          <div key={stage.key} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-2 min-w-0">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors shrink-0",
                  isDone && "bg-[var(--color-success)] text-white",
                  isCurrent && !problem && "bg-brand text-white animate-pulse-ring",
                  isPending && "bg-surface-3 text-muted border border-default",
                  problem && i === 0 && "bg-[var(--color-danger)] text-white"
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
              </div>
              <div
                className={cn(
                  "text-[11px] text-center leading-tight max-w-[80px]",
                  isCurrent ? "text-ink font-medium" : "text-muted"
                )}
              >
                {stage.label}
              </div>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-1 mt-[-22px] transition-colors",
                  isDone ? "bg-[var(--color-success)]" : "bg-default"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
