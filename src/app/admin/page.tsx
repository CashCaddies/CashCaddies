import { requireAdmin } from "@/lib/auth/requireAdmin";
import AdminControlCenterClient from "./admin-control-center-client";

export default async function AdminPage() {
  await requireAdmin();
  return <AdminControlCenterClient />;
}
