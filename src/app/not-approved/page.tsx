import Link from "next/link";
import { JoinWaitlistFlow } from "@/components/join-waitlist-flow";

export default function NotApprovedPage() {
  return (
    <div className="mx-auto flex min-h-[75vh] max-w-lg flex-col justify-center px-4 py-16">
      <section className="rounded-2xl border border-amber-500/25 bg-slate-950/70 px-6 py-8 shadow-xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">Beta access</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-white">Access not approved yet</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          Your account is signed in, but you don&apos;t have beta access yet. You can request access below — this is
          separate from any admin tools.
        </p>

        <div className="mt-6">
          <JoinWaitlistFlow variant="card" />
        </div>

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/" className="font-semibold text-emerald-400 underline-offset-2 hover:text-emerald-300 hover:underline">
            Home
          </Link>
          {" · "}
          <Link href="/faq" className="font-semibold text-emerald-400 underline-offset-2 hover:text-emerald-300 hover:underline">
            FAQ
          </Link>
        </p>
      </section>
    </div>
  );
}
