import type { Session } from "@/lib/session";
import { NiuralTopBar } from "./niural-top-bar";
import { NiuralSidebar, type NavSection } from "./niural-sidebar";
import { DemoSwitcher } from "./demo-switcher";

export function AppShell({
  session,
  sidebarTitle,
  sidebarSections,
  children,
}: {
  session: Session;
  sidebarTitle?: string;
  sidebarSections: NavSection[];
  children: React.ReactNode;
}) {
  const title = sidebarTitle ?? (session.kind === "benops" ? "Operations" : "Benefits");
  const activeProduct = session.kind === "benops" ? "operations" : "benefits";
  return (
    <>
      <NiuralTopBar session={session} activeProduct={activeProduct} />
      <div className="flex">
        <NiuralSidebar title={title} sections={sidebarSections} />
        <main className="flex-1 px-6 lg:px-8 py-6 min-w-0">{children}</main>
      </div>
      <DemoSwitcher current={session} />
    </>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted mt-1 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: "brand" | "success" | "warning" | "danger" | "violet";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const accentColor = {
    brand: "var(--color-brand)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    danger: "var(--color-danger)",
    violet: "var(--color-violet)",
  }[accent || "brand"];
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted uppercase tracking-wider font-medium">{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-2" />}
      </div>
      <div className="text-2xl font-semibold tracking-tight tabular-nums" style={{ color: accent ? accentColor : undefined }}>
        {value}
      </div>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Helper to build sidebar nav for each persona. Centralised so the active
 * highlighting is consistent across pages.
 */
export function buildSidebarSections(
  session: Session,
  pathname: string,
): NavSection[] {
  if (session.kind === "employee") {
    return [
      {
        heading: "YOUR BENEFITS",
        items: [
          { href: "/me", label: "Overview", active: pathname === "/me" },
          { href: "/me/submit", label: "Report a life event", active: pathname.startsWith("/me/submit") },
        ],
      },
      {
        heading: "HISTORY",
        items: [
          { href: "/me?tab=history", label: "Past events", active: false },
          { href: "/me?tab=documents", label: "Documents", active: false },
        ],
      },
    ];
  }
  if (session.kind === "hr_admin") {
    const base = `/admin/${session.org_id}`;
    return [
      {
        heading: "BENEFITS",
        items: [
          { href: base, label: "Dashboard", active: pathname === base },
          { href: `${base}?tab=events`, label: "Life events", active: false },
          { href: `${base}?tab=employees`, label: "Employees", active: false },
        ],
      },
      {
        heading: "REPORTS",
        items: [
          { href: "#", label: "SLA report", active: false },
          { href: "#", label: "Audit export", active: false },
        ],
      },
    ];
  }
  return [
    {
      heading: "OPERATIONS",
      items: [
        { href: "/ops", label: "Queue", active: pathname === "/ops" },
        { href: "/ops?tab=verifications", label: "Verifications", active: false },
        { href: "/ops?tab=disputes", label: "Disputes", active: false },
      ],
    },
    {
      heading: "CONFIGURATION",
      items: [
        { href: "/ops/rules", label: "State rules", active: pathname.startsWith("/ops/rules") },
        { href: "#", label: "Carriers", active: false },
      ],
    },
    {
      heading: "HISTORY",
      items: [
        { href: "#", label: "Resolved cases", active: false },
        { href: "#", label: "Activity log", active: false },
      ],
    },
  ];
}
