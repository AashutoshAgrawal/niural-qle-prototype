/**
 * Three demo personas — one per persona type. The prototype demonstrates
 * the QLE workflow end-to-end from each perspective.
 *
 * The IDs match the demo identities seeded in seed.py.
 */
import type { Session } from "./session";

export interface DemoPersona {
  key: "employee" | "hr_admin" | "benops";
  session: Session;
  title: string;
  tagline: string;
  pitch: string;
  bullets: string[];
  landingHref: string;
  accent: "brand" | "success" | "violet";
}

export const EMPLOYEE_PERSONA: DemoPersona = {
  key: "employee",
  session: {
    kind: "employee",
    id: 3,
    name: "Diego Park",
    org_id: 1,
    org_name: "FoundrCo",
  },
  title: "Employee",
  tagline: "Diego Park · FoundrCo · Illinois",
  pitch: "Submit a life event, fix bad documents in seconds, and watch coverage activate.",
  bullets: [
    "Proactive: see options before a denied claim happens",
    "Smart intake: bad docs caught before they enter any queue",
    "State rules: continuation options surfaced automatically",
    "Live status: track every step from submit to active",
  ],
  landingHref: "/me",
  accent: "brand",
};

export const HR_PERSONA: DemoPersona = {
  key: "hr_admin",
  session: {
    kind: "hr_admin",
    org_id: 1,
    org_name: "FoundrCo",
    name: "Mike Okafor",
    title: "Head of People",
  },
  title: "HR admin",
  tagline: "Mike Okafor · FoundrCo · Head of People",
  pitch: "Real-time visibility on every life event. Act without emailing Niural.",
  bullets: [
    "Dashboard: KPIs, deltas, sparklines, carrier health",
    "Risk callouts: who needs attention this week",
    "HR actions: escalate, approve late, resend to carrier",
    "Audit log: every decision exportable",
  ],
  landingHref: "/admin/1",
  accent: "success",
};

export const BENOPS_PERSONA: DemoPersona = {
  key: "benops",
  session: {
    kind: "benops",
    name: "Tom Reyes",
    title: "Benefits Operations Lead",
  },
  title: "BenOps",
  tagline: "Tom Reyes · Benefits Operations",
  pitch: "A queue that pre-does 90% of the review work. Hit P0 first.",
  bullets: [
    "Prioritized queue sorted by SLA urgency",
    "Review with doc preview + field-match table + AI recommendation",
    "Manual carrier tasks: pre-filled data + drafted email",
    "Reconciliation: catch silent carrier drops before claims arrive",
  ],
  landingHref: "/ops",
  accent: "violet",
};

export const ALL_PERSONAS: DemoPersona[] = [EMPLOYEE_PERSONA, HR_PERSONA, BENOPS_PERSONA];
