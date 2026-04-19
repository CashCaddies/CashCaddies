import { requireAdmin } from "@/lib/auth/requireAdmin";
import AdminContestsPageClient from "./admin-contests-client";

export default async function AdminContestsPage() {
  await requireAdmin();
  return <AdminContestsPageClient />;
}
