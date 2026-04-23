import Link from "next/link";
import type { Metadata } from "next";
import { JoinWaitlistFlow } from "@/components/join-waitlist-flow";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = {
  title: "Beta access pending · CashCaddies",
  description: "Your CashCaddies account is pending private beta approval.",
};

export default async function BetaPendingPage() {
  await requireUser();
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16">
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 px-6 py-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Private beta</p>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">Access pending</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
          CashCaddies is currently in private beta. Your account is pending approval.
        </p>
        <div className="mt-8 border-t border-white/10 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">In-app access request</p>
          <div className="mt-3">
            <JoinWaitlistFlow variant="card" hasPendingRequest />
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          <Link href="/" className="font-semibold text-emerald-400 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-300">
            Back to home
          </Link>
          {" · "}
          <Link href="/faq" className="font-semibold text-emerald-400 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-300">
            FAQ
          </Link>
        </p>
      </section>
    </div>
  );
}
