import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

/** Legacy path — beta queue lives under the dashboard admin area. */
export default async function AdminBetaQueuePage() {
  await requireUser();
  redirect("/dashboard/admin/beta-queue");
}
