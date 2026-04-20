import { redirect } from "next/navigation";

export default function AdminUsersRedirectPage() {
  redirect("/dashboard/beta-management");
}
