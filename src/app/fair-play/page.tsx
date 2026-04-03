import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Fair Play Principles · CashCaddies",
  description:
    "CashCaddies Fair Play Principles: integrity, transparency, and respect for every player in the community.",
};

export default function FairPlayPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">CashCaddies</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Fair Play Principles</h1>
        <p className="mt-3 text-base text-slate-400 sm:text-lg">
          Our rules of the road—so contests stay fair, protection stays meaningful, and the community stays first.
        </p>
      </div>

      <ul className="space-y-5 text-slate-300">
        <li className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-white">Integrity</h2>
          <p className="mt-2 text-sm leading-relaxed sm:text-base">
            Play under your own account. No collusion, no scripting play, and no attempts to exploit bugs or gaps in
            contest or protection rules.
          </p>
        </li>
        <li className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-white">Transparency</h2>
          <p className="mt-2 text-sm leading-relaxed sm:text-base">
            We show the Safety Coverage fund balance in the open because your trust matters. Fees, protection, and
            fund use are described honestly—no fine-print surprises about what protection can and can&apos;t do.
          </p>
        </li>
        <li className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-white">Respect</h2>
          <p className="mt-2 text-sm leading-relaxed sm:text-base">
            Treat other players and support staff with respect. Disputes go through the proper channels; harassment
            and abuse have no place here.
          </p>
        </li>
        <li className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-white">CashCaddies Safety Coverage in good faith</h2>
          <p className="mt-2 text-sm leading-relaxed sm:text-base">
            CashCaddies Safety Coverage exists for real golf outcomes—WD, DNS, DQ, and covered scenarios as defined at entry.
            Claims should reflect what actually happened in the tournament; abuse of protection undermines everyone.
          </p>
        </li>
      </ul>

      <p className="text-center text-sm text-slate-500">
        <Link href="/faq" className="font-semibold text-emerald-400 hover:text-emerald-300">
          Back to FAQ
        </Link>
        {" · "}
        <Link href="/lobby" className="font-semibold text-emerald-400 hover:text-emerald-300">
          Lobby
        </Link>
      </p>
    </div>
  );
}
