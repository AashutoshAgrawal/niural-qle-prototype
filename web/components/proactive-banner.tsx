"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api, type ProactiveNotification } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Calendar, ArrowRight, X, Loader2 } from "lucide-react";
import { formatDate, daysBetween } from "@/lib/utils";

export function ProactiveBanner({ notifications }: { notifications: ProactiveNotification[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  if (notifications.length === 0) return null;

  async function act(id: number, action: "convert" | "dismiss") {
    setBusy(id);
    try {
      if (action === "convert") await api.proactiveConvert(id);
      else await api.proactiveDismiss(id);
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 mb-6">
      {notifications.map((n) => {
        const days = daysBetween(n.trigger_date);
        return (
          <Card key={n.id} className="border-[var(--color-violet-soft)]">
            <CardContent className="py-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-full bg-[var(--color-violet-soft)] text-[var(--color-violet)] flex items-center justify-center shrink-0">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tracking-tight">
                      Your dependent {n.dependent?.name} turns 26 in {days} days
                    </span>
                  </div>
                  <p className="text-sm text-muted mt-1 leading-relaxed">
                    On <strong>{formatDate(n.trigger_date)}</strong>, {n.dependent?.name} will no longer be eligible
                    for coverage under your plan{" "}
                    {n.state_rule_applied
                      ? <>— but your state offers continuation options. You can preview them now.</>
                      : <>— federal COBRA will be offered.</>}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="primary" size="sm" onClick={() => act(n.id, "convert")} disabled={busy === n.id}>
                      {busy === n.id ? <Loader2 className="animate-spin" /> : <Calendar />}
                      Preview options
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => act(n.id, "dismiss")} disabled={busy === n.id}>
                      <X /> Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
