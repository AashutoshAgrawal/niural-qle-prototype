/**
 * Niural-style left sidebar — Linear-inspired active state with a left
 * accent strip and gentle hover.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";

export type NavSection = {
  heading?: string;
  items: { href: string; label: string; icon?: React.ComponentType<{ className?: string }>; active?: boolean }[];
};

export function NiuralSidebar({ title, sections }: { title: string; sections: NavSection[] }) {
  return (
    <aside className="w-[224px] shrink-0 bg-sidebar border-r border-default min-h-[calc(100vh-3.5rem)]">
      <div className="px-4 py-4 border-b border-default">
        <div className="text-eyebrow text-muted mb-1">Workspace</div>
        <h2 className="text-h3">{title}</h2>
      </div>
      <nav className="px-2 py-4 space-y-5">
        {sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <div className="px-2 mb-1.5 text-eyebrow text-muted-2">
                {section.heading}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] leading-tight transition-colors",
                      item.active
                        ? "text-ink font-semibold bg-surface-2"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                    )}
                  >
                    {item.active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-[var(--color-brand)]" />
                    )}
                    {Icon && (
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          item.active ? "text-[var(--color-brand)]" : "text-muted-2"
                        )}
                      />
                    )}
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
