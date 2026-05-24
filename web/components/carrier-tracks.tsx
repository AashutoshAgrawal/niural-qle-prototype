/**
 * Parallel carrier tracks display — one column per coverage line.
 * Each column shows the carrier, line, transit status, and verification status.
 */
import type { CarrierTxn, TaskCard, VerificationStatus } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import {
  ShieldCheck, AlertTriangle, Loader2, ArrowRight, Network, Clipboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Track = {
  key: string;
  carrier: string;
  line: string;
  line_label: string;
  is_api: boolean;
  status: string;
  verification_status: VerificationStatus;
  verification_notes: string | null;
  acked_at: string | null;
  verified_at: string | null;
  detail_href?: string;
};

export function CarrierTracks({
  transactions, tasks, role,
}: {
  transactions: CarrierTxn[];
  tasks: TaskCard[];
  role: "employee" | "hr_admin" | "benops";
}) {
  const tracks: Track[] = [
    ...transactions.map((t): Track => ({
      key: `txn-${t.id}`,
      carrier: t.carrier,
      line: t.coverage_line,
      line_label: t.coverage_line_label,
      is_api: true,
      status: t.status,
      verification_status: t.verification_status,
      verification_notes: t.verification_notes,
      acked_at: t.acked_at,
      verified_at: t.verified_at,
      detail_href: role === "benops" && (t.status === "escalated" || t.status === "drop_detected")
        ? `/ops/escalation/${t.id}` : undefined,
    })),
    ...tasks.map((t): Track => ({
      key: `task-${t.id}`,
      carrier: t.carrier,
      line: t.coverage_line,
      line_label: t.coverage_line_label,
      is_api: false,
      status: t.status,
      verification_status: t.verification_status,
      verification_notes: t.verification_notes,
      acked_at: t.completed_at,
      verified_at: t.verified_at,
      detail_href: role === "benops" ? `/ops/task/${t.id}` : undefined,
    })),
  ];

  if (tracks.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {tracks.map((t) => (
        <TrackCard key={t.key} track={t} role={role} />
      ))}
    </div>
  );
}

function TrackCard({ track, role }: { track: Track; role: "employee" | "hr_admin" | "benops" }) {
  const verifColor =
    track.verification_status === "verified" ? "var(--color-success)" :
    track.verification_status === "failed" ? "var(--color-danger)" :
    "var(--color-warning)";
  const VerifIcon =
    track.verification_status === "verified" ? ShieldCheck :
    track.verification_status === "failed" ? AlertTriangle :
    Loader2;

  return (
    <div className="card-elevated p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs text-muted-2 uppercase tracking-wider font-medium">{track.line_label}</div>
          <div className="font-semibold tracking-tight">{track.carrier}</div>
        </div>
        <div
          className={cn(
            "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
            track.verification_status === "verified" && "bg-[var(--color-success-soft)]",
            track.verification_status === "failed" && "bg-[var(--color-danger-soft)]",
            track.verification_status === "pending" && "bg-[var(--color-warning-soft)]"
          )}
          title={track.verification_notes || ""}
        >
          <VerifIcon
            className={cn("h-3.5 w-3.5", track.verification_status === "pending" && "animate-spin")}
            style={{ color: verifColor }}
          />
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <Stage
          label={track.is_api ? "Submitted to Noyo" : "Portal updated"}
          done={track.status !== "submitted" || !!track.acked_at}
          subtle={track.is_api ? "Idempotent submission" : "BenOps logged in"}
        />
        <Stage
          label={track.is_api ? "Carrier acknowledged" : "Manual task done"}
          done={!!track.acked_at || track.status === "completed"}
          subtle={track.acked_at ? formatDateTime(track.acked_at) : "Awaiting"}
        />
        <Stage
          label="Coverage verified"
          done={track.verification_status === "verified"}
          failed={track.verification_status === "failed"}
          subtle={
            track.verification_status === "verified" ? formatDateTime(track.verified_at) :
            track.verification_status === "failed" ? "Failed — see audit" :
            "Pending"
          }
        />
      </div>

      {track.verification_status === "failed" && track.verification_notes && (
        <div className="mt-3 p-2.5 rounded-md bg-[var(--color-danger-soft)] text-xs text-[var(--color-danger)]">
          <strong className="block">Coverage not verified</strong>
          {track.verification_notes}
        </div>
      )}

      {track.detail_href && (
        <a
          href={track.detail_href}
          className="mt-3 text-xs text-brand inline-flex items-center gap-1 hover:gap-1.5 transition-all"
        >
          {role === "benops" && track.status === "drop_detected" ? "Investigate drop" :
           role === "benops" && !track.is_api ? "Open task card" : "Details"}
          <ArrowRight className="h-3 w-3" />
        </a>
      )}

      <div className="mt-2 text-[10px] text-muted-2 flex items-center gap-1">
        {track.is_api ? <Network className="h-2.5 w-2.5" /> : <Clipboard className="h-2.5 w-2.5" />}
        {track.is_api ? "API · Noyo" : "Manual portal"}
      </div>
    </div>
  );
}

function Stage({ label, done, failed, subtle }: { label: string; done: boolean; failed?: boolean; subtle?: string }) {
  return (
    <div className="flex items-start gap-2">
      <div
        className={cn(
          "h-3.5 w-3.5 rounded-full mt-0.5 shrink-0",
          done && !failed && "bg-[var(--color-success)]",
          failed && "bg-[var(--color-danger)]",
          !done && !failed && "border border-[var(--color-border-strong)] bg-surface"
        )}
      />
      <div className="min-w-0">
        <div className={cn("font-medium text-ink", !done && !failed && "text-muted")}>{label}</div>
        {subtle && <div className="text-[11px] text-muted-2">{subtle}</div>}
      </div>
    </div>
  );
}
