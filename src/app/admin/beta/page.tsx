import { requireAdmin } from "@/lib/auth/requireAdmin";
import AdminBetaApprovalPageClient from "./admin-beta-client";

export default async function AdminBetaApprovalPage() {
  await requireAdmin();
  return <AdminBetaApprovalPageClient />;
}
