"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, type Session, homeFor } from "./session";

export async function signIn(session: Session) {
  const c = await cookies();
  c.set(SESSION_COOKIE, JSON.stringify(session), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(homeFor(session));
}

export async function signOut() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  redirect("/login");
}
