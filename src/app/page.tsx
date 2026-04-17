import Link from "next/link";
import { ClosedBetaClient } from "@/app/closed-beta/closed-beta-client";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <ClosedBetaClient />

      <div className="mx-auto mb-24 mt-20 w-full max-w-4xl px-6">
        <div className="rounded-2xl border border-white/10 bg-[#0b1220]/80 p-8 text-center shadow-lg">
          <h2 className="mb-3 text-2xl font-bold text-white">Questions?</h2>

          <p className="mb-6 text-gray-400">
            Learn how CashCaddies works, including the Portal, tiers, and protection system.
          </p>

          <Link
            href="/faq"
            className="inline-block rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 font-medium text-emerald-400 transition hover:border-emerald-400 hover:bg-emerald-500/20"
          >
            View FAQs
          </Link>
        </div>
      </div>
    </main>
  );
}
