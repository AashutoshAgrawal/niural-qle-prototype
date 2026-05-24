/**
 * Frontend-only enrichment of QLE data for the BenOps review screen.
 *
 * The backend captures only the bare minimum (event_type, event_date,
 * filename). A real review needs much more: extracted facts from the
 * document, the elections the employee is requesting, dependent details,
 * eligibility checks, premium impact. This helper fabricates those values
 * deterministically from the QLE id so the demo screens look complete.
 *
 * Everything here is mock data. Swap to API-sourced data when the model
 * is extended.
 */
import type { QLE } from "./api";

export interface DocFact {
  label: string;
  documentValue: string;
  declaredValue: string;
  match: "match" | "warn" | "fail";
  note?: string;
}

export interface RequestedElection {
  line: "medical" | "dental" | "vision";
  carrier: string;
  plan: string;
  action: "add_dependent" | "remove_dependent" | "tier_change" | "no_change" | "self_enrol";
  actionLabel: string;
  tierFrom: string;
  tierTo: string;
  effectiveDate: string;
  premiumDelta: number;
}

export interface DependentClaim {
  name: string;
  dob: string;
  age: number;
  relationship: string;
  ssnLast4: string;
  state: string;
  otherCoverage: boolean;
}

export interface ReviewEnrichment {
  doc: {
    previewKind: "marriage_certificate" | "birth_certificate" | "divorce_decree" | "death_certificate" | "coverage_loss_letter" | "rejected" | "unknown";
    previewTitle: string;
    previewIssuer: string;
    previewSubject: string;
    previewDate: string;
    sizeKb: number;
    pages: number;
  };
  factMatches: DocFact[];
  overallMatch: "match" | "warn" | "fail";
  elections: RequestedElection[];
  totalPremiumDelta: number;
  employeeSharePremiumDelta: number;
  dependentClaim: DependentClaim | null;
  eligibility: {
    employeeOnCoverage: boolean;
    currentTier: string;
    withinWindow: boolean;
    daysFromEvent: number;
    priorQleCount: number;
    priorQleSummary: string;
  };
  sla: {
    benopsHoursRemaining: number;
    employeeDaysRemaining: number;
  };
  recommendation: {
    action: "approve" | "request_reupload" | "reject" | "escalate";
    label: string;
    reasoning: string;
  };
}

// Deterministic PRNG so the same QLE id always produces the same demo values.
function seeded(id: number): () => number {
  let s = id * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const FIRST_NAMES = ["Raj", "Aarav", "Ishaan", "Aditi", "Maya", "Diego", "Sofia", "Lucas", "Emma", "Noah"];
const LAST_NAMES_FALLBACK = ["Patel", "Sharma", "Kim", "Ortiz", "Nguyen", "Tanaka", "Cohen", "Wong"];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function lastNameOf(employeeName: string | undefined): string {
  if (!employeeName) return "Patel";
  const parts = employeeName.split(/\s+/);
  return parts[parts.length - 1] || "Patel";
}

function fmtDateUS(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function maskedSsn(rng: () => number): string {
  const last4 = Math.floor(1000 + rng() * 9000);
  return `•••• ${last4}`;
}

function previewKindFor(eventType: string, routing: string | null | undefined):
  ReviewEnrichment["doc"]["previewKind"] {
  if (routing === "reject") return "rejected";
  switch (eventType) {
    case "marriage": return "marriage_certificate";
    case "divorce": return "divorce_decree";
    case "birth_adoption": return "birth_certificate";
    case "death_of_dependent": return "death_certificate";
    case "loss_of_other_coverage": return "coverage_loss_letter";
    default: return "unknown";
  }
}

export function enrichReview(qle: QLE): ReviewEnrichment {
  const rng = seeded(qle.id || 1);
  const employee = qle.employee;
  const employeeName = employee?.name ?? "Employee";
  const familyLast = lastNameOf(employeeName);
  const depFirst = pick(FIRST_NAMES, rng);
  const depName = `${depFirst} ${familyLast}`;
  const altLast = pick(LAST_NAMES_FALLBACK, rng);

  const document = qle.documents?.[0];
  const declaredDate = qle.event_date ? new Date(qle.event_date) : new Date();
  // Sometimes the document's extracted date drifts by 1d (deterministic flag)
  const dateDriftDays = rng() < 0.35 ? Math.floor(rng() * 3) : 0;
  const docDate = new Date(declaredDate);
  docDate.setDate(docDate.getDate() - dateDriftDays);

  // Sometimes the doc has a slightly different name (catches typos / fraud)
  const nameMismatch = rng() < 0.15;
  const docDepName = nameMismatch ? `${depFirst} ${altLast}` : depName;

  // Build fact-match rows
  const factMatches: DocFact[] = [
    {
      label: "Employee name",
      documentValue: employeeName,
      declaredValue: employeeName,
      match: "match",
    },
    {
      label: "Dependent name",
      documentValue: docDepName,
      declaredValue: depName,
      match: nameMismatch ? "fail" : "match",
      note: nameMismatch ? "Last name on document differs from declared dependent." : undefined,
    },
    {
      label: "Event date",
      documentValue: fmtDateUS(docDate.toISOString()),
      declaredValue: fmtDateUS(declaredDate.toISOString()),
      match: dateDriftDays > 7 ? "fail" : dateDriftDays > 0 ? "warn" : "match",
      note: dateDriftDays > 0 ? `${dateDriftDays} day gap (tolerance 7 days)` : undefined,
    },
    {
      label: "Event type",
      documentValue: qle.event_type_label,
      declaredValue: qle.event_type_label,
      match: document?.classified_type === "wedding_invitation" ? "fail" : "match",
      note: document?.classified_type === "wedding_invitation"
        ? "Document classified as wedding invitation, not certificate."
        : undefined,
    },
    {
      label: "State",
      documentValue: stateName(employee?.state),
      declaredValue: stateName(employee?.state),
      match: "match",
    },
    {
      label: "Document quality",
      documentValue: document?.quality_issue || "Legible",
      declaredValue: "—",
      match: document?.quality_issue ? "fail" : "match",
      note: document?.quality_issue ? `Quality issue: ${document.quality_issue}` : undefined,
    },
  ];

  const overallMatch: "match" | "warn" | "fail" = factMatches.some((f) => f.match === "fail")
    ? "fail"
    : factMatches.some((f) => f.match === "warn")
      ? "warn"
      : "match";

  // Requested elections — varies by event type
  const elections = buildElections(qle, depName);
  const totalPremiumDelta = elections.reduce((s, e) => s + e.premiumDelta, 0);
  const employeeSharePremiumDelta = Math.round(totalPremiumDelta * 0.4);

  // Dependent claim — only for events that add a dependent
  const eventAddsDependent = ["marriage", "birth_adoption", "loss_of_other_coverage"].includes(qle.event_type);
  const depAge = qle.event_type === "birth_adoption"
    ? 0
    : qle.event_type === "marriage"
      ? 28 + Math.floor(rng() * 12)
      : Math.floor(rng() * 25);
  const depDob = new Date();
  depDob.setFullYear(depDob.getFullYear() - depAge);
  depDob.setMonth(Math.floor(rng() * 12));
  depDob.setDate(1 + Math.floor(rng() * 27));

  const dependentClaim: DependentClaim | null = eventAddsDependent
    ? {
        name: depName,
        dob: fmtDateUS(depDob.toISOString()),
        age: depAge,
        relationship:
          qle.event_type === "marriage" ? "Spouse" :
          qle.event_type === "birth_adoption" ? "Child" :
          "Dependent",
        ssnLast4: qle.event_type === "birth_adoption" ? "Pending (applied at birth)" : maskedSsn(rng),
        state: stateName(employee?.state),
        otherCoverage: false,
      }
    : null;

  // Eligibility
  const now = Date.now();
  const eventTime = declaredDate.getTime();
  const daysFromEvent = Math.floor((now - eventTime) / (1000 * 60 * 60 * 24));
  const withinWindow = daysFromEvent <= 30;
  const priorQleCount = Math.floor(rng() * 3);

  const sla = {
    benopsHoursRemaining: 1 + Math.floor(rng() * 4),
    employeeDaysRemaining: Math.max(0, 30 - daysFromEvent),
  };

  // Recommendation logic
  let recommendation: ReviewEnrichment["recommendation"];
  if (overallMatch === "fail" || document?.routing_decision === "reject") {
    if (document?.classified_type === "wedding_invitation") {
      recommendation = {
        action: "request_reupload",
        label: "Request reupload",
        reasoning: "Document is a wedding invitation, not a certificate. Employee can resubmit with the correct document.",
      };
    } else if (factMatches[1].match === "fail") {
      recommendation = {
        action: "request_reupload",
        label: "Request reupload or clarification",
        reasoning: "Name on document doesn't match declared dependent. Ask employee to clarify before approving.",
      };
    } else {
      recommendation = {
        action: "reject",
        label: "Reject",
        reasoning: "Document fails validation on multiple fields and cannot reasonably be used as proof.",
      };
    }
  } else if (overallMatch === "warn") {
    recommendation = {
      action: "approve",
      label: "Approve with note",
      reasoning: "Minor field discrepancies but within tolerance. Approve and log the discrepancy in audit notes.",
    };
  } else {
    recommendation = {
      action: "approve",
      label: "Approve",
      reasoning: "Document is the right type, fields match the declared values, within the 30-day window. Safe to approve.",
    };
  }

  return {
    doc: {
      previewKind: previewKindFor(qle.event_type, document?.routing_decision),
      previewTitle: previewTitleFor(qle.event_type, employee?.state),
      previewIssuer: previewIssuerFor(qle.event_type, employee?.state),
      previewSubject: `${employeeName} and ${docDepName}`,
      previewDate: fmtDateUS(docDate.toISOString()),
      sizeKb: 800 + Math.floor(rng() * 1800),
      pages: 1 + (rng() < 0.3 ? 1 : 0),
    },
    factMatches,
    overallMatch,
    elections,
    totalPremiumDelta,
    employeeSharePremiumDelta,
    dependentClaim,
    eligibility: {
      employeeOnCoverage: true,
      currentTier: priorQleCount > 0 ? "Employee + 1" : "Employee-only",
      withinWindow,
      daysFromEvent,
      priorQleCount,
      priorQleSummary: priorQleCount === 0
        ? "No prior life events."
        : `${priorQleCount} prior life event${priorQleCount > 1 ? "s" : ""} on file.`,
    },
    sla,
    recommendation,
  };
}

function stateName(abbr: string | undefined): string {
  if (!abbr) return "—";
  const map: Record<string, string> = {
    NY: "New York", NJ: "New Jersey", CA: "California", IL: "Illinois",
    TX: "Texas", MA: "Massachusetts", FL: "Florida", WA: "Washington",
  };
  return map[abbr] || abbr;
}

function previewTitleFor(eventType: string, state: string | undefined): string {
  const st = stateName(state);
  switch (eventType) {
    case "marriage": return `${st} — Certificate of Marriage`;
    case "divorce": return `${st} Superior Court — Final Judgment of Divorce`;
    case "birth_adoption": return `${st} Department of Health — Certificate of Live Birth`;
    case "death_of_dependent": return `${st} Department of Health — Certificate of Death`;
    case "loss_of_other_coverage": return "Prior Carrier — Notice of Coverage Termination";
    default: return "Supporting Document";
  }
}

function previewIssuerFor(eventType: string, state: string | undefined): string {
  const st = stateName(state);
  switch (eventType) {
    case "marriage":
    case "birth_adoption":
    case "death_of_dependent":
      return `${st} Department of Health — Vital Records`;
    case "divorce":
      return `${st} Superior Court, Family Division`;
    case "loss_of_other_coverage":
      return "Prior employer's benefits administrator";
    default:
      return "Unspecified issuer";
  }
}

function buildElections(qle: QLE, depName: string): RequestedElection[] {
  const employee = qle.employee;
  const coverages = employee?.coverages?.filter((c) => c.active) || [];
  const effective = qle.event_date ? fmtDateUS(qle.event_date) : "—";

  if (coverages.length === 0) return [];

  switch (qle.event_type) {
    case "marriage":
    case "birth_adoption":
    case "loss_of_other_coverage": {
      const out: RequestedElection[] = [];
      coverages.forEach((c, idx) => {
        if (c.line === "vision" && idx > 0) {
          out.push({
            line: c.line,
            carrier: c.carrier,
            plan: c.plan_type,
            action: "no_change",
            actionLabel: "No change",
            tierFrom: "Employee-only",
            tierTo: "Employee-only",
            effectiveDate: effective,
            premiumDelta: 0,
          });
          return;
        }
        out.push({
          line: c.line,
          carrier: c.carrier,
          plan: c.plan_type,
          action: "add_dependent",
          actionLabel: `Add ${depName}`,
          tierFrom: "Employee-only",
          tierTo: qle.event_type === "birth_adoption" ? "Family" : "Employee + spouse",
          effectiveDate: effective,
          premiumDelta: c.line === "medical" ? 312 : c.line === "dental" ? 38 : 16,
        });
      });
      return out;
    }
    case "divorce":
    case "death_of_dependent":
      return coverages.map((c) => ({
        line: c.line,
        carrier: c.carrier,
        plan: c.plan_type,
        action: "remove_dependent" as const,
        actionLabel: `Remove ${depName}`,
        tierFrom: "Family",
        tierTo: "Employee-only",
        effectiveDate: effective,
        premiumDelta: c.line === "medical" ? -312 : c.line === "dental" ? -38 : -16,
      }));
    case "dependent_aging_off":
      return coverages.map((c) => ({
        line: c.line,
        carrier: c.carrier,
        plan: c.plan_type,
        action: "remove_dependent" as const,
        actionLabel: "Remove aging-off dependent",
        tierFrom: "Employee + 1",
        tierTo: "Employee-only",
        effectiveDate: effective,
        premiumDelta: c.line === "medical" ? -180 : c.line === "dental" ? -22 : -10,
      }));
    default:
      return coverages.map((c) => ({
        line: c.line,
        carrier: c.carrier,
        plan: c.plan_type,
        action: "no_change" as const,
        actionLabel: "No change",
        tierFrom: "Employee-only",
        tierTo: "Employee-only",
        effectiveDate: effective,
        premiumDelta: 0,
      }));
  }
}
