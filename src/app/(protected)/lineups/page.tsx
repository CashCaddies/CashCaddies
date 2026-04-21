import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Saved lineups UI lives under dashboard; keep /lineups as a stable shortcut URL. */
export default async function LineupsRedirectPage() {
  await requireUser();
  redirect("/dashboard/lineups");
}
