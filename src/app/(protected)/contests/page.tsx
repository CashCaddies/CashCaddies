import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Canonical contest list lives under dashboard; keep /contests as a stable shortcut URL. */
export default function ContestsRedirectPage() {
  redirect("/dashboard/contests");
}
