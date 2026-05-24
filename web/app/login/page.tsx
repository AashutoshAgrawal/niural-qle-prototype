import Link from "next/link";
import { Sparkles, FileText, ArrowRight, Check, Workflow, ExternalLink } from "lucide-react";
import { ALL_PERSONAS, type DemoPersona } from "@/lib/identities";
import { PersonaCard } from "./persona-card";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <header className="px-8 py-5 flex items-center justify-between max-w-[1200px] w-full mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight text-[15px]">Niural Benefits</div>
            <div className="text-[11px] text-muted -mt-0.5">QLE Automation · Prototype</div>
          </div>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <a
            href="https://github.com/AashutoshAgrawal/niural-qle-prototype"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-default hover:bg-surface-2 text-ink-2 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> GitHub
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-default hover:bg-surface-2 text-ink-2 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" /> Case study
          </a>
        </div>
      </header>

      <main className="flex-1 px-6 pb-16">
        <div className="max-w-[1200px] mx-auto">
          {/* Hero */}
          <div className="text-center pt-10 pb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-soft text-[var(--color-brand)] text-xs font-medium mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
              Prototype · Designed to scale 10× with no added headcount
            </div>
            <h1 className="text-[34px] sm:text-[44px] font-semibold tracking-tight leading-[1.05] max-w-3xl mx-auto">
              The QLE workflow,
              <br className="hidden sm:block" />
              <span className="text-[var(--color-brand)]"> from every angle.</span>
            </h1>
            <p className="text-base text-muted mt-4 max-w-xl mx-auto leading-relaxed">
              Three personas. Three end-to-end workflows. Choose how you want to walk through it.
            </p>
          </div>

          {/* Three persona cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {ALL_PERSONAS.map((p, i) => (
              <PersonaCard key={p.key} persona={p} index={i + 1} />
            ))}
          </div>

          {/* Workflow proof strip */}
          <ProofStrip />
        </div>
      </main>

      <footer className="px-8 py-5 border-t border-default text-xs text-muted-2 max-w-[1200px] w-full mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <Workflow className="h-3 w-3" />
            Demo workspace — mocks Noyo, OCR, and carrier portals. No real PII.
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/AashutoshAgrawal/niural-qle-prototype"
              target="_blank"
              rel="noreferrer"
              className="hover:text-ink"
            >
              GitHub
            </a>
            <span>·</span>
            <span>Prototype v1 · May 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProofStrip() {
  const claims: Array<{ title: string; body: string }> = [
    { title: "Smart intake",      body: "Bad documents caught at upload, not at the deadline. Wedding invitations, blurry photos, date mismatches — all rejected before they hit the queue." },
    { title: "Rules engine",      body: "State continuation surfaced automatically. NJ, NY, CA, IL on launch — admins add rules without an engineering deploy." },
    { title: "Carrier resilience",body: "Noyo for Aetna/Guardian, task cards for Arlo/Angle. Daily reconciliation catches silent drops before employees do." },
    { title: "Visibility",        body: "HR and employees see every stage in real time. No more 'where is my QLE?' emails to BenOps." },
  ];
  return (
    <div className="border-t border-default pt-10">
      <div className="text-center mb-6">
        <div className="text-xs uppercase tracking-wider text-muted font-semibold">What this prototype demonstrates</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
        {claims.map((c) => (
          <div key={c.title} className="text-left">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="h-5 w-5 rounded-md bg-[var(--color-success-soft)] text-[var(--color-success)] flex items-center justify-center">
                <Check className="h-3 w-3" />
              </div>
              <div className="text-sm font-semibold text-ink">{c.title}</div>
            </div>
            <p className="text-xs text-muted leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Keep the unused-import suppressor minimal
type _refs = DemoPersona | typeof ArrowRight;
const _suppress: _refs | null = null;
void _suppress;
