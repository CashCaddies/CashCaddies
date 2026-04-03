import { redirect } from "next/navigation";

/** Legacy path — beta queue lives under the dashboard admin area. */
export default function AdminBetaQueuePage() {
  redirect("/dashboard/admin/beta-queue");
}
