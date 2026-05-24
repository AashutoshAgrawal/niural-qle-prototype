import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        neutral: "bg-surface-3 text-ink-2 border border-default",
        brand: "bg-brand-soft text-[var(--color-brand)] border border-[var(--color-brand-soft)]",
        success: "bg-[var(--color-success-soft)] text-[var(--color-success)] border border-[var(--color-success-soft)]",
        warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border border-[var(--color-warning-soft)]",
        danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border border-[var(--color-danger-soft)]",
        violet: "bg-[var(--color-violet-soft)] text-[var(--color-violet)] border border-[var(--color-violet-soft)]",
        outline: "border border-default text-muted bg-transparent",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
