import { requireUser } from "@/lib/auth/require-user";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import AdminBetaApprovalPageClient from "./admin-beta-client";

export default async function AdminBetaApprovalPage() {
  await requireUser();
  await requireAdmin();
  return <AdminBetaApprovalPageClient />;
}
