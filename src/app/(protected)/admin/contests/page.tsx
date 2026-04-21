import { requireUser } from "@/lib/auth/require-user";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import AdminContestsPageClient from "./admin-contests-client";

export default async function AdminContestsPage() {
  await requireUser();
  await requireAdmin();
  return <AdminContestsPageClient />;
}
