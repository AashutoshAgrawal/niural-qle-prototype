/**
 * Frontend-only enrichment of dashboard data: deterministic sparkline
 * series, deltas, trigger-reason chips for the queue, and synthetic
 * activity feed entries.
 *
 * Numbers are seeded from the current real counts so the same dashboard
 * state always produces the same demo values.
 */
import type { QLE, CarrierTxn, TaskCard, BenOpsQueue, OrgDetail } from "./api";

function seeded(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function sparkSeries(seed: number, target: number, length = 14): number[] {
  const rng = seeded(seed + target * 17 + 3);
  const out: number[] = [];
  let v = Math.max(0, target - Math.floor(rng() * 5));
  for (let i = 0; i < length; i++) {
    v += Math.floor((rng() - 0.5) * 3);
    if (v < 0) v = 0;
    out.push(v);
  }
  // make the final point land on the real value
  out[out.length - 1] = target;
  return out;
}

export function deltaVsLastWeek(seed: number, current: number): number {
  const rng = seeded(seed + current * 31);
  const delta = Math.round((rng() - 0.45) * Math.max(2, current * 0.4));
  return delta;
}

// Trigger reason for a queue item — picked deterministically from the QLE's
// underlying state (document type, confidence, age).
export function triggerReason(qle: QLE): { label: string; tone: "danger" | "warning" | "brand" | "neutral" } {
  const d = qle.documents?.[0];
  if (d?.classified_type === "wedding_invitation") return { label: "Wrong document type", tone: "danger" };
  if (d?.quality_issue === "blurry") return { label: "Image blurry", tone: "danger" };
  if (d?.quality_issue === "cropped") return { label: "Document cropped", tone: "danger" };
  if (d && d.confidence < 0.7) return { label: "Low OCR confidence", tone: "danger" };
  if (d && d.confidence < 0.9) return { label: "Medium confidence", tone: "warning" };
  if (qle.flagged_late) return { label: "Past 30-day window", tone: "warning" };
  return { label: "Manual queue", tone: "neutral" };
}

export function escalationReason(t: CarrierTxn): string {
  if (t.verification_status === "failed") return "Coverage not in carrier claims system";
  if (t.status === "escalated") return `No ack after ${t.retry_count + 1} attempts`;
  return t.error || "Silent drop detected";
}

export function manualTaskReason(t: TaskCard): { label: string; tone: "warning" | "brand" | "danger" } {
  if (t.status === "portal_unavailable") return { label: "Portal down — rescheduled", tone: "danger" };
  if (t.verification_due) return { label: "Verification due", tone: "brand" };
  return { label: "Portal update pending", tone: "warning" };
}

// Age-based priority promotion: items closer to SLA breach get bumped.
export function priority(qle: QLE): { rank: number; label: string; tone: "danger" | "warning" | "brand" | "neutral" | "success" } {
  if (qle.sla_health === "red") return { rank: 0, label: "P0 · SLA", tone: "danger" };
  if (qle.sla_health === "yellow") return { rank: 1, label: "P1 · At risk", tone: "warning" };
  if (qle.flagged_late) return { rank: 1, label: "P1 · Late", tone: "warning" };
  return { rank: 2, label: "P2 · OK", tone: "success" };
}

export interface QueueStats {
  reviewSpark: number[];
  escSpark: number[];
  taskSpark: number[];
  verifSpark: number[];
  reviewDelta: number;
  escDelta: number;
  taskDelta: number;
  verifDelta: number;
  medianResolutionHours: number;
  slaBreachRatePct: number;
  itemsClosedToday: number;
}

export function benopsStats(q: BenOpsQueue): QueueStats {
  const seed = q.counts.review + q.counts.escalations * 7 + q.counts.tasks * 13 + q.counts.verifications_due * 19;
  return {
    reviewSpark:  sparkSeries(seed,     q.counts.review),
    escSpark:    sparkSeries(seed + 1, q.counts.escalations),
    taskSpark:   sparkSeries(seed + 2, q.counts.tasks),
    verifSpark:  sparkSeries(seed + 3, q.counts.verifications_due),
    reviewDelta: deltaVsLastWeek(seed,     q.counts.review),
    escDelta:    deltaVsLastWeek(seed + 1, q.counts.escalations),
    taskDelta:   deltaVsLastWeek(seed + 2, q.counts.tasks),
    verifDelta:  deltaVsLastWeek(seed + 3, q.counts.verifications_due),
    medianResolutionHours: 4 + (seed % 5),
    slaBreachRatePct: 2 + (seed % 4),
    itemsClosedToday: 6 + (seed % 8),
  };
}

export interface AdminStats {
  totalDelta: number;
  greenDelta: number;
  yellowDelta: number;
  redDelta: number;
  totalSpark: number[];
  redSpark: number[];
  activeCoverageEmployees: number;
  avgResolutionDays: number;
  approvalRatePct: number;
}

export function adminStats(o: OrgDetail): AdminStats {
  const seed = (o.id ?? 1) + o.qles.length + (o.sla_counts.green + o.sla_counts.yellow + o.sla_counts.red);
  return {
    totalDelta:  deltaVsLastWeek(seed,     o.qles.length),
    greenDelta:  deltaVsLastWeek(seed + 1, o.sla_counts.green),
    yellowDelta: deltaVsLastWeek(seed + 2, o.sla_counts.yellow),
    redDelta:    deltaVsLastWeek(seed + 3, o.sla_counts.red),
    totalSpark:  sparkSeries(seed,     o.qles.length),
    redSpark:    sparkSeries(seed + 3, o.sla_counts.red),
    activeCoverageEmployees: o.employees.length,
    avgResolutionDays: 2 + (seed % 3),
    approvalRatePct: 88 + (seed % 9),
  };
}

// Simulated activity feed — derived from real QLEs so it reflects current state
export interface FeedItem {
  id: string;
  when: string;       // e.g. "2m ago"
  actor: string;
  action: string;
  ref?: { label: string; href: string };
  tone?: "success" | "warning" | "danger" | "brand";
}

export function activityFeed(q: BenOpsQueue, limit = 8): FeedItem[] {
  const items: FeedItem[] = [];
  q.review_queue.slice(0, 3).forEach((qle) => {
    items.push({
      id: `r${qle.id}`,
      when: timeAgoShort(qle.created_at),
      actor: qle.employee?.name ?? "Employee",
      action: `submitted a ${qle.event_type_label.toLowerCase()} event`,
      ref: { label: `#${qle.id}`, href: `/ops/review/${qle.id}` },
      tone: "brand",
    });
  });
  q.escalations.slice(0, 2).forEach((t) => {
    items.push({
      id: `e${t.id}`,
      when: timeAgoShort(t.submitted_at),
      actor: "Reconciliation job",
      action: `flagged a ${t.carrier} drop on ${t.coverage_line_label.toLowerCase()}`,
      ref: { label: `Escalation`, href: `/ops/escalation/${t.id}` },
      tone: "danger",
    });
  });
  q.tasks.slice(0, 2).forEach((t) => {
    items.push({
      id: `t${t.id}`,
      when: timeAgoShort(t.created_at),
      actor: "System",
      action: `created a ${t.carrier} portal task for ${t.coverage_line_label.toLowerCase()}`,
      ref: { label: `Task #${t.id}`, href: `/ops/task/${t.id}` },
      tone: "warning",
    });
  });
  q.disputes.slice(0, 1).forEach((d) => {
    items.push({
      id: `d${d.id}`,
      when: timeAgoShort(d.created_at),
      actor: "Employee",
      action: `disputed an election decision`,
      tone: "warning",
    });
  });
  return items.slice(0, limit);
}

function timeAgoShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "now";
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
