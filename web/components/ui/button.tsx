import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-[background,color,border,box-shadow,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-canvas)] [&_svg:not(.is-spinner)]:size-4 [&_svg:not(.is-spinner)]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-2)] active:translate-y-px shadow-[0_1px_0_rgba(16,16,24,0.04),0_1px_2px_rgba(113,77,255,0.20)]",
        secondary:
          "bg-surface border border-default text-ink hover:bg-surface-2 hover:border-strong active:translate-y-px",
        ghost:
          "text-ink-2 hover:bg-surface-2 hover:text-ink",
        success:
          "bg-[var(--color-success)] text-white hover:opacity-90 active:translate-y-px",
        danger:
          "bg-[var(--color-danger)] text-white hover:opacity-90 active:translate-y-px",
        outline:
          "border border-default bg-transparent hover:bg-surface-2 text-ink active:translate-y-px",
        link:
          "text-[var(--color-brand)] underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm:   "h-8 px-3 text-xs rounded-md",
        md:   "h-9 px-3.5",
        lg:   "h-11 px-5 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={loading || disabled}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && <Loader2 className="is-spinner h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
