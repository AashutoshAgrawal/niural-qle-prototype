import Link from "next/link";
import { Circle } from "lucide-react";
import type { FeedItem } from "@/lib/dashboard-mock";

const DOT: Record<NonNullable<FeedItem["tone"]>, string> = {
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  danger:  "text-[var(--color-danger)]",
  brand:   "text-[var(--color-brand)]",
};

export function ActivityFeed({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return <div className="text-sm text-muted py-3">No recent activity.</div>;
  }
  return (
    <ol className="relative -mx-2">
      {items.map((it, i) => {
        const inner = (
          <>
            {i < items.length - 1 && (
              <div className="absolute left-[15px] top-[24px] bottom-[-10px] w-px bg-[var(--color-border)] group-hover:bg-[var(--color-brand-soft)]" />
            )}
            <div className={`shrink-0 h-3.5 w-3.5 mt-1 ${DOT[it.tone || "brand"]}`}>
              <Circle className="h-3.5 w-3.5" fill="currentColor" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink-2 leading-snug group-hover:text-ink transition-colors">
                <span className="font-medium text-ink">{it.actor}</span>{" "}
                <span>{it.action}</span>
                {it.ref && (
                  <span className="text-[var(--color-brand)] font-medium ml-1">
                    {it.ref.label}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-2 mt-0.5">{it.when}</div>
            </div>
          </>
        );
        const liClasses =
          "group relative flex gap-3 px-2 py-2.5 rounded-md transition-colors " +
          (it.ref ? "cursor-pointer hover:bg-surface-2" : "");
        if (it.ref) {
          return (
            <li key={it.id}>
              <Link href={it.ref.href} className={liClasses}>
                {inner}
              </Link>
            </li>
          );
        }
        return (
          <li key={it.id} className={liClasses}>
            {inner}
          </li>
        );
      })}
    </ol>
  );
}
