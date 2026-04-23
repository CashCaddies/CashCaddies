import Link from "next/link";
import type { Metadata } from "next";
import { JoinWaitlistFlow } from "@/components/join-waitlist-flow";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Access not approved · CashCaddies",
  description: "Your CashCaddies account does not have beta access yet.",
};

async function userHasPendingWaitlistRequest(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return false;
  const admin = createServiceRoleClient();
  if (!admin) return false;
  const { data, error } = await admin
    .from("waitlist_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (error) return false;
  return Boolean(data);
}

export default async function NotApprovedPage() {
  const hasPendingRequest = await userHasPendingWaitlistRequest();

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16">
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 px-6 py-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Private beta</p>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">Access not approved yet</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
          Your account is signed in, but you don&apos;t have beta access yet. You can request access below — this is
          separate from any admin tools.
        </p>

        <div className="mt-8 border-t border-white/10 pt-6">
          {!hasPendingRequest ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">In-app access request</p>
          ) : null}
          <div className="mt-3">
            <JoinWaitlistFlow variant="card" hasPendingRequest={hasPendingRequest} />
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          <Link
            href="/"
            className="font-semibold text-emerald-400 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-300"
          >
            Back to home
          </Link>
          {" · "}
          <Link
            href="/faq"
            className="font-semibold text-emerald-400 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-300"
          >
            FAQ
          </Link>
        </p>
      </section>
    </div>
  );
}
