import { redirect } from "next/navigation";

/** Legacy / sidebar path — hub is at /dashboard/feedback */
export default function FeedbackInboxPage() {
  redirect("/dashboard/feedback");
}
