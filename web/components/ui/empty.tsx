import * as React from "react";
import { cn } from "@/lib/utils";

export function Empty({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}>
      {Icon && (
        <div className="mb-3 h-12 w-12 rounded-full bg-surface-3 flex items-center justify-center">
          <Icon className="h-5 w-5 text-muted" />
        </div>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
