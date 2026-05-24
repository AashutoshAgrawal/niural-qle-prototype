import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-2)] shadow-[0_1px_2px_rgba(16,16,24,0.08)]",
        secondary:
          "bg-surface border border-default text-ink hover:bg-surface-2",
        ghost:
          "text-ink-2 hover:bg-surface-2 hover:text-ink",
        success:
          "bg-[var(--color-success)] text-white hover:opacity-90",
        danger:
          "bg-[var(--color-danger)] text-white hover:opacity-90",
        outline:
          "border border-default bg-transparent hover:bg-surface-2 text-ink",
        link:
          "text-[var(--color-brand)] underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-md",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";
