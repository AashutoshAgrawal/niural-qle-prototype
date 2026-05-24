/**
 * Wizard step indicator — like the kind in Gusto/Rippling enrollment flows.
 * Numbered circles with labels, line between them, current step highlighted.
 */
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type WizardStep = { key: string; label: string; description?: string };

export function Wizard({ steps, current }: { steps: WizardStep[]; current: number }) {
  return (
    <ol className="flex items-start mb-8">
      {steps.map((step, i) => {
        const isDone = i < current;
        const isCurrent = i === current;
        return (
          <li key={step.key} className="flex-1 flex items-start">
            <div className="flex flex-col items-start min-w-0 pr-3">
              <div className="flex items-center gap-2 w-full">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 transition-colors",
                    isDone && "bg-[var(--color-brand)] text-white",
                    isCurrent && "bg-[var(--color-brand)] text-white ring-4 ring-brand-soft",
                    !isDone && !isCurrent && "bg-surface border border-default text-muted"
                  )}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-px transition-colors",
                      isDone ? "bg-[var(--color-brand)]" : "bg-default"
                    )}
                  />
                )}
              </div>
              <div className="mt-2 pr-3 min-w-0">
                <div className={cn("text-xs font-medium", isCurrent ? "text-ink" : "text-muted")}>{step.label}</div>
                {step.description && <div className="text-[11px] text-muted-2 truncate">{step.description}</div>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
