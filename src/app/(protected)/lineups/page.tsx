import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Saved lineups UI lives under dashboard; keep /lineups as a stable shortcut URL. */
export default function LineupsRedirectPage() {
  redirect("/dashboard/lineups");
}
