import { redirect } from "next/navigation";

/** Legacy URL — beta approval UI lives at `/dashboard/admin/beta-queue`. */
export default function LegacyDashboardAdminBetaPage() {
  redirect("/dashboard/admin/beta-queue");
}
