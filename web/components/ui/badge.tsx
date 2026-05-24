import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status chip / tag.
 * - `chip` shape (default) is rounded-md, used for state labels
 * - `tag` shape is rounded-full, used for soft tags
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold leading-[1.4] whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-muted",
        brand:   "bg-brand-soft text-[var(--color-brand)]",
        success: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
        warning: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
        danger:  "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
        violet:  "bg-[var(--color-violet-soft)] text-[var(--color-violet)]",
        outline: "border border-default text-muted bg-transparent",
      },
      shape: {
        chip: "rounded-md",
        tag:  "rounded-full px-2.5",
      },
    },
    defaultVariants: { variant: "neutral", shape: "chip" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, shape, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, shape, className }))} {...props} />;
}
