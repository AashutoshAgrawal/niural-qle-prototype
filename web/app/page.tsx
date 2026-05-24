import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Root() {
  const s = await getSession();
  if (!s) redirect("/login");
  redirect(homeFor(s));
}
