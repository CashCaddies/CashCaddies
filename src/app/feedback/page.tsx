import { redirect } from "next/navigation";

export default async function FeedbackPage() {
  redirect("/dashboard/feedback");
}
