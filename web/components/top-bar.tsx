import Link from "next/link";
import { Sparkles, LogOut, Building2 } from "lucide-react";
import type { Session } from "@/lib/session";
import { signOut } from "@/lib/auth-actions";
import { Avatar } from "./avatar";

export function TopBar({ session, nav }: { session: Session; nav?: { href: string; label: string; active?: boolean }[] }) {
  const ctx =
    session.kind === "employee" ? session.org_name :
    session.kind === "hr_admin" ? session.org_name :
    "Operations";

  return (
    <header className="sticky top-0 z-30 border-b border-default bg-surface/85 backdrop-blur-md">
      <div className="mx-auto max-w-[1440px] px-6 h-14 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-violet)] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight">Niural</span>
            <span className="text-xs text-muted hidden sm:inline">Benefits</span>
          </div>
          {ctx && (
            <>
              <span className="text-muted-2 mx-1">·</span>
              <span className="text-sm text-ink-2 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-muted-2" />
                {ctx}
              </span>
            </>
          )}
        </Link>

        <nav className="flex items-center gap-1 flex-1 justify-center">
          {nav?.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                "px-3 py-1.5 rounded-md text-sm transition-colors " +
                (item.active
                  ? "bg-surface-3 text-ink font-medium"
                  : "text-muted hover:text-ink hover:bg-surface-2")
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden md:block">
            <div className="text-sm font-medium leading-tight">{session.name}</div>
            <div className="text-xs text-muted-2">
              {session.kind === "employee" ? "Employee" :
               session.kind === "hr_admin" ? (session.title || "HR admin") :
               (session.title || "Operations")}
            </div>
          </div>
          <Avatar name={session.name} />
          <form action={signOut}>
            <button type="submit" className="text-muted-2 hover:text-ink p-1.5 rounded-md hover:bg-surface-2" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
