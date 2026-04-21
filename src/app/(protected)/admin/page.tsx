import { requireUser } from "@/lib/auth/require-user";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import AdminControlCenterClient from "./admin-control-center-client";

export default async function AdminPage() {
  await requireUser();
  await requireAdmin();
  return <AdminControlCenterClient />;
}
