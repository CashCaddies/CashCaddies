import Link from "next/link";
import { ClosedBetaClient } from "@/app/closed-beta/closed-beta-client";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl overflow-visible px-4 py-6 sm:px-6">
      <ClosedBetaClient />

      <div className="mx-auto mb-24 mt-20 w-full max-w-4xl px-6">
        <div className="rounded-xl border border-white/10 bg-[#0b1220] p-8 text-center">
          <h2 className="mb-2 text-2xl font-bold text-white">Frequently Asked Questions</h2>

          <p className="mb-6 text-gray-400">
            Learn how the Portal, contests, and protection system work.
          </p>

          <Link
            href="/faq"
            className="inline-block rounded-lg border border-emerald-500/30 px-6 py-3 font-medium text-emerald-400 transition hover:bg-emerald-500/10"
          >
            View FAQs
          </Link>
        </div>
      </div>
    </main>
  );
}
