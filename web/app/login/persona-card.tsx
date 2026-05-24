"use client";
import { useTransition } from "react";
import { ArrowRight, Loader2, Users, Building2, Wrench } from "lucide-react";
import { signIn } from "@/lib/auth-actions";
import type { DemoPersona } from "@/lib/identities";

const ICON: Record<DemoPersona["key"], React.ComponentType<{ className?: string }>> = {
  employee: Users,
  hr_admin: Building2,
  benops:   Wrench,
};

const ACCENT: Record<DemoPersona["accent"], {
  iconBg: string;
  iconColor: string;
  ringHover: string;
  buttonBg: string;
  buttonHover: string;
  indexBg: string;
  indexColor: string;
}> = {
  brand: {
    iconBg: "bg-brand-soft",
    iconColor: "text-[var(--color-brand)]",
    ringHover: "hover:border-[var(--color-brand)] hover:shadow-[0_12px_32px_-12px_rgba(113,77,255,0.25)]",
    buttonBg: "bg-[var(--color-brand)] text-white",
    buttonHover: "hover:bg-[var(--color-brand-2)]",
    indexBg: "bg-brand-soft",
    indexColor: "text-[var(--color-brand)]",
  },
  success: {
    iconBg: "bg-[var(--color-success-soft)]",
    iconColor: "text-[var(--color-success)]",
    ringHover: "hover:border-[var(--color-success)] hover:shadow-[0_12px_32px_-12px_rgba(16,185,129,0.22)]",
    buttonBg: "bg-[var(--color-success)] text-white",
    buttonHover: "hover:opacity-90",
    indexBg: "bg-[var(--color-success-soft)]",
    indexColor: "text-[var(--color-success)]",
  },
  violet: {
    iconBg: "bg-[var(--color-violet-soft)]",
    iconColor: "text-[var(--color-violet)]",
    ringHover: "hover:border-[var(--color-violet)] hover:shadow-[0_12px_32px_-12px_rgba(113,77,255,0.22)]",
    buttonBg: "bg-[var(--color-violet)] text-white",
    buttonHover: "hover:opacity-90",
    indexBg: "bg-[var(--color-violet-soft)]",
    indexColor: "text-[var(--color-violet)]",
  },
};

export function PersonaCard({ persona, index }: { persona: DemoPersona; index: number }) {
  const Icon = ICON[persona.key];
  const a = ACCENT[persona.accent];
  const [pending, startTransition] = useTransition();

  function enter() {
    startTransition(async () => {
      await signIn(persona.session);
    });
  }

  return (
    <button
      type="button"
      onClick={enter}
      disabled={pending}
      className={
        "card-elevated p-6 text-left transition-all flex flex-col h-full " +
        a.ringHover + " hover:-translate-y-1 " +
        "disabled:opacity-60 disabled:cursor-wait " +
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-brand)]"
      }
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`h-11 w-11 rounded-xl ${a.iconBg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${a.iconColor}`} />
        </div>
        <div className={`px-2 py-0.5 rounded-md ${a.indexBg} ${a.indexColor} text-[11px] font-bold tracking-wider`}>
          Workflow {index}
        </div>
      </div>

      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted font-semibold">
        {persona.title}
      </div>
      <div className="text-lg font-semibold tracking-tight text-ink mb-1.5">
        {persona.tagline}
      </div>
      <p className="text-sm text-ink-2 mb-5 leading-relaxed">{persona.pitch}</p>

      <ul className="space-y-2 mb-6 flex-1">
        {persona.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink-2 leading-snug">
            <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${a.iconColor.replace("text-", "bg-")}`} />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div
        className={
          `mt-auto inline-flex items-center justify-center gap-1.5 w-full px-4 h-10 rounded-lg font-medium text-sm transition-all ${a.buttonBg} ${a.buttonHover}`
        }
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Start workflow <ArrowRight className="h-4 w-4" />
          </>
        )}
      </div>
    </button>
  );
}
