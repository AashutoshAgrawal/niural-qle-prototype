/**
 * The set of "demo accounts" presented on /login. In production this list
 * would not exist — auth would identify real users. Here we hardcode a
 * realistic mix: a few employees, two HR admins, three BenOps members.
 *
 * The employee identities are the same IDs the seed loads in seed.py.
 * HR admins are mapped to seeded organisations.
 */
import type { Session } from "./session";

export type Identity = Session & { tag: string; subtitle: string };

export const EMPLOYEE_IDENTITIES: Identity[] = [
  { kind: "employee", id: 1, name: "Marcus Chen", org_id: 1, org_name: "FoundrCo", tag: "marcus", subtitle: "FoundrCo · California" },
  { kind: "employee", id: 2, name: "Anita Sharma", org_id: 1, org_name: "FoundrCo", tag: "anita", subtitle: "FoundrCo · New Jersey" },
  { kind: "employee", id: 3, name: "Diego Park", org_id: 1, org_name: "FoundrCo", tag: "diego", subtitle: "FoundrCo · Illinois" },
  { kind: "employee", id: 4, name: "Priya Patel", org_id: 2, org_name: "LumenLabs", tag: "priya-e", subtitle: "LumenLabs · New York" },
  { kind: "employee", id: 5, name: "David Kim", org_id: 2, org_name: "LumenLabs", tag: "david", subtitle: "LumenLabs · Illinois" },
  { kind: "employee", id: 6, name: "Rachel Wong", org_id: 2, org_name: "LumenLabs", tag: "rachel", subtitle: "LumenLabs · Massachusetts" },
  { kind: "employee", id: 7, name: "Tom Rivera", org_id: 3, org_name: "Helios Industries", tag: "tom", subtitle: "Helios Industries · Texas" },
];

export const HR_IDENTITIES: Identity[] = [
  { kind: "hr_admin", org_id: 2, org_name: "LumenLabs", name: "Janet Liang", title: "People Ops Lead", tag: "janet", subtitle: "LumenLabs · 3 employees" },
  { kind: "hr_admin", org_id: 1, org_name: "FoundrCo", name: "Mike Okafor", title: "Head of People", tag: "mike", subtitle: "FoundrCo · 2 employees" },
  { kind: "hr_admin", org_id: 3, org_name: "Helios Industries", name: "Lin Tao", title: "HR Manager", tag: "lin", subtitle: "Helios · 1 employee" },
];

export const BENOPS_IDENTITIES: Identity[] = [
  { kind: "benops", name: "Sarah Chen", title: "Benefits Operations Lead", tag: "sarah", subtitle: "Operations team" },
  { kind: "benops", name: "Priya Mehta", title: "Senior Benefits Analyst", tag: "priya-b", subtitle: "Operations team" },
  { kind: "benops", name: "Ayush Singh", title: "Benefits Analyst", tag: "ayush", subtitle: "Operations team" },
];

export const ALL_IDENTITIES: Identity[] = [
  ...EMPLOYEE_IDENTITIES,
  ...HR_IDENTITIES,
  ...BENOPS_IDENTITIES,
];

export function findIdentity(tag: string): Identity | undefined {
  return ALL_IDENTITIES.find((i) => i.tag === tag);
}
