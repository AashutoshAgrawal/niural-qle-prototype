/**
 * Typed API client for the v2 backend.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

export type SlaHealth = "green" | "yellow" | "red";
export type QleStatus =
  | "submitted"
  | "documents_verified"
  | "election_pending"
  | "election_confirmed"
  | "carrier_in_progress"
  | "coverage_verifying"
  | "active"
  | "rejected"
  | "benops_review"
  | "disputed"
  | "proactive_notified";

export type VerificationStatus = "pending" | "verified" | "failed";

export interface Organization {
  id: number;
  name: string;
  employee_count?: number;
  qle_count?: number;
}

export interface Coverage {
  id: number;
  line: "medical" | "dental" | "vision";
  line_label: string;
  carrier: string;
  plan_type: string;
  active: boolean;
}

export interface Dependent {
  id: number;
  name: string;
  relationship: string;
  birthdate: string | null;
  age: number | null;
  is_on_coverage: boolean;
  unmarried: boolean;
  nj_resident: boolean;
  ny_resident: boolean;
  no_other_coverage: boolean;
}

export interface Employee {
  id: number;
  name: string;
  email: string;
  state: string;
  carrier: string;       // primary (medical) — convenience
  plan_type: string;
  coverages: Coverage[];
  dependents: Dependent[];
  organization_id: number;
  organization?: { id: number; name: string };
}

export interface Document {
  id: number;
  filename: string;
  declared_type: string;
  classified_type: string | null;
  confidence: number;
  quality_issue: string | null;
  routing_decision: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface ElectionOption {
  action: string;
  label: string;
  description?: string;
  citation?: string;
}

export interface CarrierTxn {
  id: number;
  qle_id: number;
  carrier: string;
  coverage_line: "medical" | "dental" | "vision";
  coverage_line_label: string;
  transaction_id: string | null;
  status: string;
  submitted_at: string | null;
  acked_at: string | null;
  retry_count: number;
  error: string | null;
  payload: Record<string, unknown>;
  verification_status: VerificationStatus;
  verified_at: string | null;
  verification_notes: string | null;
}

export interface TaskCard {
  id: number;
  qle_id: number;
  carrier: string;
  coverage_line: "medical" | "dental" | "vision";
  coverage_line_label: string;
  portal_url: string;
  checklist: string[];
  prefilled_data: Record<string, unknown>;
  drafted_email: string;
  status: string;
  created_at: string | null;
  completed_at: string | null;
  rescheduled_to: string | null;
  verification_status: VerificationStatus;
  verification_due: string | null;
  verified_at: string | null;
  verification_notes: string | null;
}

export interface AuditEntry {
  id: number;
  action: string;
  actor: string;
  details: string;
  timestamp: string | null;
}

export interface Dispute {
  id: number;
  qle_id: number;
  employee_reason: string;
  status: "open" | "resolved_upheld" | "resolved_overridden";
  resolution_notes: string | null;
  resolved_by: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

export interface QLE {
  id: number;
  employee_id: number;
  employee: Employee | null;
  event_type: string;
  event_type_label: string;
  event_date: string | null;
  status: QleStatus;
  status_label: string;
  confidence_score: number | null;
  intake_notes: string | null;
  election_deadline: string | null;
  election_selection: Record<string, unknown> | null;
  eligible_options: ElectionOption[] | null;
  flagged_late: boolean;
  is_system_triggered: boolean;
  dependent_info: Record<string, unknown> | null;
  created_at: string | null;
  sla_health: SlaHealth;
  documents: Document[];
  carrier_transactions: CarrierTxn[];
  task_cards: TaskCard[];
  disputes: Dispute[];
  all_lines_verified: boolean;
  audit?: AuditEntry[];
}

export interface ProactiveNotification {
  id: number;
  kind: "aging_off_60d" | "aging_off_30d";
  trigger_date: string | null;
  event_type: string;
  eligible_options: ElectionOption[] | null;
  state_rule_applied: Record<string, unknown> | null;
  acknowledged_at: string | null;
  converted_qle_id: number | null;
  employee_id: number;
  dependent_id: number;
  dependent: Dependent | null;
  created_at: string | null;
}

export interface StateRule {
  id: number;
  state: string;
  event_type: string;
  conditions: Record<string, unknown>;
  eligible_actions: string[];
  description: string | null;
  citation: string | null;
  active: boolean;
  updated_at: string | null;
}

export interface BenOpsQueue {
  review_queue: QLE[];
  disputes: Dispute[];
  escalations: CarrierTxn[];
  tasks: TaskCard[];
  verifications_due: TaskCard[];
  at_risk: Array<{ qle_id: number; employee: string; event_type: string; status: string; age_hours: number; health: SlaHealth }>;
  counts: { review: number; disputes: number; escalations: number; tasks: number; verifications_due: number; at_risk: number };
  all_qles: QLE[];
}

export interface OrgDetail extends Organization {
  employees: Employee[];
  qles: QLE[];
  sla_counts: { green: number; yellow: number; red: number };
  status_counts: Record<string, number>;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  status: () => http<{ seeded: boolean; qle_count: number; org_count: number; employee_count: number }>("/status"),
  seed: (reset: boolean = false) => http("/seed?reset=" + reset, { method: "POST" }),

  listOrgs: () => http<Organization[]>("/organizations"),
  getOrg: (id: number) => http<OrgDetail>(`/organizations/${id}`),
  listEmployees: () => http<Employee[]>("/employees"),
  getEmployee: (id: number) =>
    http<Employee & { qles: QLE[]; proactive_notifications: ProactiveNotification[] }>(`/employees/${id}`),

  getQLE: (id: number) => http<QLE>(`/qles/${id}`),
  listQLEs: () => http<QLE[]>("/qles"),
  submitQLE: (employeeId: number, body: { event_type: string; event_date: string; filename: string; dependent_info?: Record<string, unknown> | null }) =>
    http<QLE>(`/employees/${employeeId}/qles`, { method: "POST", body: JSON.stringify(body) }),
  elect: (qleId: number, choice: string) =>
    http<QLE>(`/qles/${qleId}/elect`, { method: "POST", body: JSON.stringify({ choice }) }),
  resubmit: (qleId: number, filename: string) =>
    http<QLE>(`/qles/${qleId}/resubmit`, { method: "POST", body: JSON.stringify({ filename }) }),

  // Disputes
  dispute: (qleId: number, reason: string) =>
    http<Dispute>(`/qles/${qleId}/dispute`, { method: "POST", body: JSON.stringify({ reason }) }),
  resolveDispute: (disputeId: number, actor: string, upheld: boolean, notes: string = "") =>
    http<Dispute>(`/disputes/${disputeId}/resolve`, { method: "POST", body: JSON.stringify({ actor, upheld, notes }) }),

  // Proactive notifications
  proactiveScan: () => http<{ created: number; details: unknown[] }>("/proactive/scan", { method: "POST" }),
  proactiveAll: () => http<ProactiveNotification[]>("/proactive/all"),
  proactiveConvert: (notifId: number) => http<QLE>(`/proactive/${notifId}/convert`, { method: "POST" }),
  proactiveDismiss: (notifId: number) => http<ProactiveNotification>(`/proactive/${notifId}/dismiss`, { method: "POST" }),

  // BenOps
  benopsQueue: () => http<BenOpsQueue>("/benops/queue"),
  review: (qleId: number, decision: "approve" | "reject", reviewer: string, notes: string = "") =>
    http<QLE>(`/benops/review/${qleId}`, { method: "POST", body: JSON.stringify({ decision, reviewer, notes }) }),
  reconcile: () => http<{ checked: number; drops_detected: number; details: unknown[] }>("/benops/reconcile", { method: "POST" }),
  sendReminders: () => http<{ reminders_sent: number; details: unknown[] }>("/benops/reminders", { method: "POST" }),
  getTask: (id: number) => http<TaskCard & { qle: QLE }>(`/tasks/${id}`),
  completeTask: (id: number, actor: string, confirmation_ref: string = "") =>
    http<TaskCard>(`/tasks/${id}/complete`, { method: "POST", body: JSON.stringify({ actor, confirmation_ref }) }),
  taskUnavailable: (id: number, actor: string) =>
    http<TaskCard>(`/tasks/${id}/unavailable?actor=${encodeURIComponent(actor)}`, { method: "POST" }),
  verifyTask: (id: number, actor: string, verified: boolean, notes: string = "") =>
    http<TaskCard>(`/tasks/${id}/verify`, { method: "POST", body: JSON.stringify({ actor, verified, notes }) }),
  getEscalation: (id: number) => http<CarrierTxn & { qle: QLE }>(`/escalations/${id}`),
  resolveEscalation: (id: number, actor: string, notes: string = "") =>
    http<CarrierTxn>(`/escalations/${id}/resolve`, { method: "POST", body: JSON.stringify({ actor, notes }) }),
  resendEscalation: (id: number) =>
    http<CarrierTxn>(`/escalations/${id}/resend`, { method: "POST" }),

  // HR actions
  hrEscalate: (qleId: number, actor: string, notes: string = "") =>
    http<{ ok: true }>(`/qles/${qleId}/hr/escalate`, { method: "POST", body: JSON.stringify({ actor, notes }) }),
  hrApproveLate: (qleId: number, actor: string, notes: string = "") =>
    http<{ ok: true }>(`/qles/${qleId}/hr/approve-late`, { method: "POST", body: JSON.stringify({ actor, notes }) }),
  hrResendCarrier: (qleId: number, actor: string, notes: string = "") =>
    http<{ ok: true; resent: number }>(`/qles/${qleId}/hr/resend-carrier`, { method: "POST", body: JSON.stringify({ actor, notes }) }),

  // State rules
  listRules: () => http<StateRule[]>("/rules"),
  addRule: (rule: Omit<StateRule, "id" | "active" | "updated_at">) =>
    http<StateRule>("/rules", { method: "POST", body: JSON.stringify(rule) }),
  toggleRule: (id: number) => http<StateRule>(`/rules/${id}/toggle`, { method: "POST" }),
};
