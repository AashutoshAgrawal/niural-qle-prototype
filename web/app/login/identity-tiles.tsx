"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { signIn } from "@/lib/auth-actions";
import type { Identity } from "@/lib/identities";

type Group = "employee" | "hr_admin" | "benops";

const GROUP_META: Record<Group, { title: string; subtitle: string; accent: string; chip: string }> = {
  employee: {
    title: "Employees",
    subtitle: "Submit a QLE, track status, make elections",
    accent: "bg-pastel-lavender",
    chip: "Employee",
  },
  hr_admin: {
    title: "HR admins",
    subtitle: "Org dashboard, SLA visibility, escalations",
    accent: "bg-pastel-mint",
    chip: "HR admin",
  },
  benops: {
    title: "Benefits operations",
    subtitle: "Prioritised queue, manual carrier tasks, rules",
    accent: "bg-pastel-peach",
    chip: "BenOps",
  },
};

export function IdentityTiles({
  employees,
  admins,
  benops,
  icons,
}: {
  employees: Identity[];
  admins: Identity[];
  benops: Identity[];
  icons: Record<Group, React.ReactNode>;
}) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function chooseIdentity(i: Identity) {
    setActiveTag(i.tag);
    startTransition(async () => {
      const { tag, subtitle, ...session } = i;
      void tag;
      void subtitle;
      await signIn(session);
    });
  }

  return (
    <div className="space-y-6">
      <Section group="employee" identities={employees} icon={icons.employee} activeTag={activeTag} onPick={chooseIdentity} />
      <Section group="hr_admin" identities={admins} icon={icons.hr_admin} activeTag={activeTag} onPick={chooseIdentity} />
      <Section group="benops" identities={benops} icon={icons.benops} activeTag={activeTag} onPick={chooseIdentity} />
    </div>
  );
}

function Section({
  group,
  identities,
  icon,
  activeTag,
  onPick,
}: {
  group: Group;
  identities: Identity[];
  icon: React.ReactNode;
  activeTag: string | null;
  onPick: (i: Identity) => void;
}) {
  const meta = GROUP_META[group];
  return (
    <section>
      <div className="flex items-end justify-between mb-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${meta.accent} text-ink text-[11px] font-semibold`}>
              {icon}
              {meta.chip}
            </span>
            <h2 className="text-base font-semibold tracking-tight">{meta.title}</h2>
          </div>
          <p className="text-sm text-muted mt-1">{meta.subtitle}</p>
        </div>
        <div className="text-xs text-muted-2">{identities.length} profiles</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {identities.map((i) => (
          <Tile
            key={i.tag}
            identity={i}
            loading={activeTag === i.tag}
            disabled={activeTag !== null && activeTag !== i.tag}
            onClick={() => onPick(i)}
          />
        ))}
      </div>
    </section>
  );
}

function Tile({
  identity,
  loading,
  disabled,
  onClick,
}: {
  identity: Identity;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "group relative text-left card-elevated p-4 transition-all " +
        "hover:border-strong hover:shadow-[0_4px_14px_rgba(16,16,24,0.06)] " +
        "disabled:opacity-50 disabled:cursor-not-allowed " +
        "focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:ring-offset-2"
      }
    >
      <div className="flex items-center gap-3">
        <Avatar name={identity.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink truncate">{identity.name}</div>
          <div className="text-xs text-muted truncate mt-0.5">
            {detailLine(identity)}
          </div>
        </div>
        <div className="text-muted-2 group-hover:text-[var(--color-brand)] transition-colors">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4 -translate-x-1 group-hover:translate-x-0 transition-transform" />
          )}
        </div>
      </div>
    </button>
  );
}

function detailLine(i: Identity): string {
  if (i.kind === "employee") return `${i.org_name ?? "—"} · Employee`;
  if (i.kind === "hr_admin") return `${i.title ?? "HR admin"} · ${i.org_name}`;
  return i.title ?? "Benefits operations";
}
