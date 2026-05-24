"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Bell, CheckCircle2, Radar } from "lucide-react";

export function ReconcileButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function run() {
    setLoading(true);
    try {
      const r = await api.reconcile();
      setResult(`Reconciliation ran — ${r.drops_detected} drop(s) detected out of ${r.checked} checked.`);
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        Run reconciliation
      </Button>
      {result && (
        <span className="text-xs text-[var(--color-success)] flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> {result}
        </span>
      )}
    </div>
  );
}

export function ProactiveScanButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function run() {
    setLoading(true);
    try {
      const r = await api.proactiveScan();
      setResult(`Scan complete — ${r.created} new notification(s).`);
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <Radar />}
        Scan for aging-off
      </Button>
      {result && (
        <span className="text-xs text-[var(--color-success)] flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> {result}
        </span>
      )}
    </div>
  );
}

export function ReminderButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function run() {
    setLoading(true);
    try {
      const r = await api.sendReminders();
      setResult(`Sent ${r.reminders_sent} reminder(s).`);
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <Bell />}
        Send reminders
      </Button>
      {result && (
        <span className="text-xs text-[var(--color-success)] flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> {result}
        </span>
      )}
    </div>
  );
}
