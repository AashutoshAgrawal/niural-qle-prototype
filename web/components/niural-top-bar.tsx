/**
 * Niural's product-level top bar — role-aware.
 *
 * The set of product tabs depends on who's signed in:
 *   - Employees: their own surfaces (Home, Benefits, Pay, Documents, Time off)
 *   - HR admins: full Niural HR product (People, Payments, Benefits, etc.)
 *   - BenOps team: this is the Niural *internal* operations console, not
 *     the customer product. Completely different chrome.
 *
 * Only "Benefits" / "Operations" actually link anywhere in this prototype.
 */
import Link from "next/link";
import type { Session } from "@/lib/session";
import { signOut } from "@/lib/auth-actions";
import { Avatar } from "./avatar";
import {
  Home, Users, Wallet, ShieldCheck, Building, BarChart3, Cable,
  Sparkles, Search, HelpCircle, LogOut, CircleDollarSign, Clock,
  FileText, Layers, Inbox, Scale, ServerCog, BookOpen,
} from "lucide-react";

type Tab = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; href: string; enabled?: boolean };

const EMPLOYEE_TABS: Tab[] = [
  { key: "home",      label: "Home",      icon: Home,       href: "#",  enabled: false },
  { key: "pay",       label: "Pay",       icon: Wallet,     href: "#",  enabled: false },
  { key: "benefits",  label: "Benefits",  icon: ShieldCheck,href: "/",  enabled: true  },
  { key: "time",      label: "Time off",  icon: Clock,      href: "#",  enabled: false },
  { key: "documents", label: "Documents", icon: FileText,   href: "#",  enabled: false },
];

const HR_ADMIN_TABS: Tab[] = [
  { key: "people",       label: "People",          icon: Users,       href: "#", enabled: false },
  { key: "payments",     label: "Payments",        icon: Wallet,      href: "#", enabled: false },
  { key: "benefits",     label: "Benefits",        icon: ShieldCheck, href: "/", enabled: true  },
  { key: "org",          label: "Organization",    icon: Building,    href: "#", enabled: false },
  { key: "insights",     label: "Niural Insights", icon: BarChart3,   href: "#", enabled: false },
  { key: "integrations", label: "Integrations",    icon: Cable,       href: "#", enabled: false },
];

const BENOPS_TABS: Tab[] = [
  { key: "operations", label: "Operations", icon: Inbox,     href: "/",          enabled: true  },
  { key: "compliance", label: "Compliance", icon: Scale,     href: "#",          enabled: false },
  { key: "carriers",   label: "Carriers",   icon: Layers,    href: "#",          enabled: false },
  { key: "kb",         label: "Knowledge",  icon: BookOpen,  href: "#",          enabled: false },
];


export function NiuralTopBar({ session, activeProduct = "benefits" }: { session: Session | null; activeProduct?: string }) {
  // Pick the right tab set for this user.
  let tabs: Tab[];
  let isInternal = false;
  if (!session) {
    tabs = HR_ADMIN_TABS;
  } else if (session.kind === "employee") {
    tabs = EMPLOYEE_TABS;
  } else if (session.kind === "hr_admin") {
    tabs = HR_ADMIN_TABS;
  } else {
    tabs = BENOPS_TABS;
    isInternal = true;
    activeProduct = "operations";
  }

  return (
    <header className="sticky top-0 z-30 bg-topbar border-b border-default">
      <div className="px-4 h-12 flex items-center gap-2">
        <Link href={session ? "/" : "/login"} className="flex items-center gap-2 mr-4 shrink-0">
          <div className={
            "h-6 w-6 rounded-md flex items-center justify-center " +
            (isInternal ? "bg-[var(--color-brand)]" : "bg-ink")
          }>
            {isInternal
              ? <ServerCog className="h-3.5 w-3.5 text-white" />
              : <Sparkles className="h-3 w-3 text-white" />}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-[15px] tracking-tight">Niural AI</span>
            {isInternal && (
              <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-brand)] text-white">
                Internal
              </span>
            )}
          </div>
        </Link>

        <nav className="flex items-center gap-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeProduct === tab.key;
            const content = (
              <span
                className={
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors " +
                  (isActive
                    ? "text-[var(--color-brand)] font-medium"
                    : "text-ink-2 hover:bg-surface-2") +
                  (tab.enabled ? "" : " opacity-60 cursor-not-allowed")
                }
                aria-disabled={!tab.enabled}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </span>
            );
            return tab.enabled ? (
              <Link key={tab.key} href={tab.href}>{content}</Link>
            ) : (
              <span key={tab.key} title="Not part of this prototype demo">{content}</span>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Wallet pill — only for HR admins (who handle org-level finance) */}
          {session?.kind === "hr_admin" && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface text-xs">
              <CircleDollarSign className="h-3.5 w-3.5 text-[var(--color-success)]" />
              <span className="font-medium">USD 0.00</span>
            </span>
          )}

          {/* Niural AI assistant — customer-facing only, not for internal ops */}
          {!isInternal && (
            <button className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-violet)] text-white text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Niural AI
            </button>
          )}

          <button className="p-1.5 rounded-md hover:bg-surface-2 text-muted">
            <Search className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded-md hover:bg-surface-2 text-muted">
            <HelpCircle className="h-4 w-4" />
          </button>
          {session ? (
            <>
              <div className="px-2 hidden md:block text-right">
                <div className="text-xs font-medium leading-tight">{session.name}</div>
                <div className="text-[10px] text-muted-2 leading-tight">
                  {session.kind === "employee" ? session.org_name :
                   session.kind === "hr_admin" ? (session.title || "HR admin") :
                   (session.title || "Operations")}
                </div>
              </div>
              <Avatar name={session.name} size="sm" />
              <form action={signOut}>
                <button type="submit" className="p-1.5 rounded-md hover:bg-surface-2 text-muted" title="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="px-3 py-1 rounded-md bg-ink text-white text-xs font-medium">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
