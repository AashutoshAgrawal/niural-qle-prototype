/**
 * Niural-style left sidebar — lighter lavender background with sectioned
 * navigation. Section headers in ALL CAPS, items below.
 *
 * The "Benefits" product surfaces different sections per role.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";

export type NavSection = {
  heading?: string;
  items: { href: string; label: string; icon?: React.ComponentType<{ className?: string }>; active?: boolean }[];
};

export function NiuralSidebar({ title, sections }: { title: string; sections: NavSection[] }) {
  return (
    <aside className="w-[220px] shrink-0 bg-sidebar border-r border-default min-h-[calc(100vh-3rem)]">
      <div className="px-4 py-4 border-b border-default">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      </div>
      <nav className="px-2 py-3 space-y-4">
        {sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <div className="px-2 mb-1 text-[10px] uppercase tracking-wider text-muted font-medium">
                {section.heading}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors",
                      item.active
                        ? "bg-brand-soft text-[var(--color-brand)] font-medium"
                        : "text-ink-2 hover:bg-surface-2"
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
