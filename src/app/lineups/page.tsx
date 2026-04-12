import { redirect } from "next/navigation";

/** Saved lineups UI lives under dashboard; keep /lineups as a stable shortcut URL. */
export default function LineupsRedirectPage() {
  redirect("/dashboard/lineups");
}
