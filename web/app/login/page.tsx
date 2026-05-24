import Link from "next/link";
import { Sparkles, Shield, Users, Building2, Wrench } from "lucide-react";
import {
  EMPLOYEE_IDENTITIES,
  HR_IDENTITIES,
  BENOPS_IDENTITIES,
} from "@/lib/identities";
import { IdentityTiles } from "./identity-tiles";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Top brand */}
      <header className="px-8 py-6 flex items-center justify-between max-w-[1120px] w-full mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[var(--color-brand)] flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight text-[15px]">Niural</div>
            <div className="text-[11px] text-muted -mt-0.5">Benefits</div>
          </div>
        </Link>
        <div className="text-sm text-muted">
          New to Niural?{" "}
          <a href="#" className="text-brand font-medium hover:underline">
            Talk to us
          </a>
        </div>
      </header>

      {/* Page */}
      <main className="flex-1 px-6 pb-16">
        <div className="max-w-[1120px] mx-auto">
          {/* Hero */}
          <div className="text-center pt-6 pb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-soft text-[var(--color-brand)] text-xs font-medium mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand)]" />
              Demo workspace · QLE Automation
            </div>
            <h1 className="text-[32px] sm:text-[40px] font-semibold tracking-tight leading-[1.1]">
              Sign in as anyone.
            </h1>
            <p className="text-base text-muted mt-3 max-w-xl mx-auto">
              Pick a profile to explore the QLE workflow from that perspective.
              Every persona is wired to seeded data so you can walk the full
              story end-to-end.
            </p>
          </div>

          <IdentityTiles
            employees={EMPLOYEE_IDENTITIES}
            admins={HR_IDENTITIES}
            benops={BENOPS_IDENTITIES}
            icons={{
              employee: <Users className="h-3.5 w-3.5" />,
              hr_admin: <Building2 className="h-3.5 w-3.5" />,
              benops: <Wrench className="h-3.5 w-3.5" />,
            }}
          />
        </div>
      </main>

      <footer className="px-8 py-5 border-t border-default text-xs text-muted-2 flex items-center justify-between max-w-[1120px] w-full mx-auto">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3 w-3" />
          Demo only — no real auth. In production, SSO via Okta or Google.
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-ink">Privacy</a>
          <a href="#" className="hover:text-ink">Terms</a>
          <a href="#" className="hover:text-ink">Help</a>
        </div>
      </footer>
    </div>
  );
}
