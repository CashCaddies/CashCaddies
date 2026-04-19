import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <section className="space-y-4">
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <p className="text-sm text-slate-400">Loading…</p>
          </div>
        }
      >
        <AuthForm mode="signup" />
      </Suspense>
      <p className="text-center text-sm text-slate-300">
        Already have an account?{" "}
        <Link href="/login" className="text-emerald-300 underline">
          Login
        </Link>
      </p>
    </section>
  );
}
