import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = {
  title: "Contact · CashCaddies",
  description: "Reach the CashCaddies team for support and inquiries.",
};

export default async function ContactPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-0">
      <h1 className="text-2xl font-bold text-white">Contact</h1>
      <p className="text-slate-300">
        For questions, feedback, or support during beta, email{" "}
        <a href="mailto:contact@cashcaddies.com" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
          contact@cashcaddies.com
        </a>
        .
      </p>
    </div>
  );
}
