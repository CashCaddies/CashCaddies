import { requireUser } from "@/lib/auth/require-user";
import PageClient from "@/app/(protected)/patch-notes/page-client";

export default async function DashboardPatchNotesPage() {
  await requireUser();
  return <PageClient />;
}
