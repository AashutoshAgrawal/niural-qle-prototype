/**
 * Server-side session helpers. The "session" is a JSON cookie carrying the
 * identity of the signed-in user. In production this would be issued by a
 * real auth provider; for the prototype it's set when the user picks a
 * profile on /login.
 *
 * Three identity shapes correspond to the three personas in the PRD.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type Session =
  | { kind: "employee"; id: number; name: string; org_id?: number; org_name?: string }
  | { kind: "hr_admin"; org_id: number; org_name: string; name: string; title?: string }
  | { kind: "benops"; name: string; title?: string };

export const SESSION_COOKIE = "niural-session";

export async function getSession(): Promise<Session | null> {
  const c = await cookies();
  const raw = c.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole<T extends Session["kind"]>(
  kind: T
): Promise<Extract<Session, { kind: T }>> {
  const s = await requireSession();
  if (s.kind !== kind) {
    // Wrong role — bounce back to their home
    redirect(homeFor(s));
  }
  return s as Extract<Session, { kind: T }>;
}

export function homeFor(s: Session): string {
  if (s.kind === "employee") return "/me";
  if (s.kind === "hr_admin") return `/admin/${s.org_id}`;
  return "/ops";
}

export function roleLabel(s: Session): string {
  if (s.kind === "employee") return "Employee";
  if (s.kind === "hr_admin") return "HR admin";
  return "Benefits operations";
}

export function contextLabel(s: Session): string {
  if (s.kind === "employee") return s.org_name || "";
  if (s.kind === "hr_admin") return s.org_name;
  return "Niural Benefits";
}
