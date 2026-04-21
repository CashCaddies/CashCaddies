import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

/** Legacy URL — beta approval UI lives at `/dashboard/admin/beta-queue`. */
export default async function LegacyDashboardAdminBetaPage() {
  await requireUser();
  redirect("/dashboard/admin/beta-queue");
}
