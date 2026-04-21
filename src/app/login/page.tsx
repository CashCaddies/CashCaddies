import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { BETA_STATUS_DENIED_QUERY, CLOSED_BETA_ACCESS_MESSAGE } from "@/lib/supabase/beta-access";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to your CashCaddie account.",
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ reason?: string }>;
};

export default async function LoginPage(props: Props) {
  const { reason } = await props.searchParams;
  const betaDenied = reason === BETA_STATUS_DENIED_QUERY;

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center">
      <section className="space-y-4">
        {betaDenied && (
          <p className="rounded-lg border border-amber-700/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-100" role="alert">
            {CLOSED_BETA_ACCESS_MESSAGE} You have been signed out because this account is not on the beta allowlist.
          </p>
        )}
        <Suspense
          fallback={
            <div className="mx-auto w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
              <p className="text-sm text-slate-400">Loading…</p>
            </div>
          }
        >
          <AuthForm mode="login" />
        </Suspense>
        <p className="text-center text-sm text-slate-300">
          Need an account?{" "}
          <Link href="/signup" className="text-emerald-300 underline hover:text-emerald-200">
            Sign up
          </Link>
        </p>
      </section>
    </div>
  );
}
