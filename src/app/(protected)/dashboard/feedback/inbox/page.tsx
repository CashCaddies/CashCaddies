import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

/** Legacy / sidebar path — hub is at /dashboard/feedback */
export default async function FeedbackInboxPage() {
  await requireUser();
  redirect("/dashboard/feedback");
}
