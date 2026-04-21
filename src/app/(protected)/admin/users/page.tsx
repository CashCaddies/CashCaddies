import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

export default async function AdminUsersRedirectPage() {
  await requireUser();
  redirect("/dashboard/beta-management");
}
