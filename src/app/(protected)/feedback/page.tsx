import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  await requireUser();
  redirect("/dashboard/feedback");
}
