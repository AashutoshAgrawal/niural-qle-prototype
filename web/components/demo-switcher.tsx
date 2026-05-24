"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-actions";
import {
  EMPLOYEE_IDENTITIES, HR_IDENTITIES, BENOPS_IDENTITIES, type Identity,
} from "@/lib/identities";
import type { Session } from "@/lib/session";
import { Avatar } from "./avatar";
import { Code2, X, ChevronRight, RotateCw } from "lucide-react";
import { api } from "@/lib/api";

export function DemoSwitcher({ current }: { current: Session | null }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function isCurrent(i: Identity): boolean {
    if (!current) return false;
    if (i.kind !== current.kind) return false;
    if (i.kind === "employee" && current.kind === "employee") return i.id === current.id;
    if (i.kind === "hr_admin" && current.kind === "hr_admin") return i.org_id === current.org_id;
    return i.name === current.name;
  }

  async function switchTo(i: Identity) {
    const { tag, subtitle, ...session } = i;
    void tag; void subtitle;
    await signIn(session);
  }

  async function reseed() {
    await api.seed(true);
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-ink text-white text-xs font-medium shadow-lg hover:shadow-xl transition-all"
      >
        <Code2 className="h-3.5 w-3.5" />
        {current ? "Demo controls" : "Demo sign-in"}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-5 right-5 z-50 w-[380px] max-h-[80vh] overflow-y-auto card-elevated p-5 animate-slide-in">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-semibold tracking-tight">
                  {current ? "Demo controls" : "Demo sign-in"}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {current
                    ? "Switch between demo profiles. Not visible in production."
                    : "Pick a profile to sign in as. Not visible in production."}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-2 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            {current && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-muted font-medium mt-4 mb-1.5">Signed in as</div>
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-2 border border-default mb-3">
                  <Avatar name={current.name} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{current.name}</div>
                    <div className="text-xs text-muted truncate">
                      {current.kind === "employee" ? `Employee · ${current.org_name}` :
                       current.kind === "hr_admin" ? `${current.title || "HR admin"} · ${current.org_name}` :
                       `${current.title || "Operations"}`}
                    </div>
                  </div>
                </div>
              </>
            )}

            <Group title="Employees">
              {EMPLOYEE_IDENTITIES.map((i) => (
                <SwitcherRow key={i.tag} identity={i} active={isCurrent(i)} onClick={() => switchTo(i)} />
              ))}
            </Group>
            <Group title="HR admins">
              {HR_IDENTITIES.map((i) => (
                <SwitcherRow key={i.tag} identity={i} active={isCurrent(i)} onClick={() => switchTo(i)} />
              ))}
            </Group>
            <Group title="Benefits operations">
              {BENOPS_IDENTITIES.map((i) => (
                <SwitcherRow key={i.tag} identity={i} active={isCurrent(i)} onClick={() => switchTo(i)} />
              ))}
            </Group>

            <div className="border-t border-default pt-3 mt-4">
              <button
                onClick={reseed}
                disabled={pending}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted hover:text-ink py-1.5"
              >
                <RotateCw className={"h-3 w-3 " + (pending ? "animate-spin" : "")} />
                Reset &amp; reseed PRD scenarios
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SwitcherRow({ identity, active, onClick }: { identity: Identity; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={
        "w-full flex items-center justify-between gap-2 p-2 rounded-md text-left transition-colors " +
        (active ? "bg-brand-soft text-[var(--color-brand)] cursor-default" : "hover:bg-surface-2")
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        <Avatar name={identity.name} size="sm" />
        <div className="min-w-0">
          <div className="text-xs font-medium truncate">{identity.name}</div>
          <div className="text-[11px] text-muted truncate">{identity.subtitle}</div>
        </div>
      </div>
      {!active && <ChevronRight className="h-3.5 w-3.5 text-muted-2 shrink-0" />}
    </button>
  );
}
