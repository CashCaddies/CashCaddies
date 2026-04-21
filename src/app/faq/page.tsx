import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/faq-accordion";

export const metadata: Metadata = {
  title: "FAQ · CashCaddies",
  description:
    "CashCaddies FAQ — Safety Coverage Fund, beta access, the portal, contests, and how to get started.",
};

const CORE_ITEMS = [
  {
    id: "what-is-cashcaddies",
    question: "What is CashCaddies?",
    answer: (
      <p>
        CashCaddies is a premium daily fantasy golf platform built for clearer rules, fair contests, and a focused
        player experience. You draft lineups, join contests, and compete for prizes based on real tournament
        performance.
      </p>
    ),
  },
  {
    id: "what-is-safety-coverage",
    anchorId: "safety-coverage",
    question: "What is the Safety Coverage Fund?",
    answer: (
      <p>
        The Safety Coverage Fund protects your entry when eligible golfers withdraw before the contest&apos;s stated
        late-swap or lock window. Covered situations return value as Protection Credit according to published contest
        rules — so you are not left exposed by last-minute WD noise.
      </p>
    ),
  },
  {
    id: "golfer-withdraws",
    question: "What happens if a golfer withdraws?",
    answer: (
      <p>
        If a golfer withdraws before the protection window closes, eligible entries receive Protection Credit per
        contest rules. After lock, standard scoring and settlement apply. Always check the contest card for the exact
        timeline for that event.
      </p>
    ),
  },
  {
    id: "is-live",
    question: "Is CashCaddies live yet?",
    answer: (
      <p>
        The platform is in active beta: core contests, wallet, lobby, and lineups are live for approved users. Some
        features and edge cases are still being refined as we scale responsibly.
      </p>
    ),
  },
  {
    id: "beta-access",
    question: "How does beta access work?",
    answer: (
      <p>
        Beta is invite- and approval-based. Create an account, request access, and once approved you can use the full
        beta experience. We may adjust capacity as we stabilize performance and payouts.
      </p>
    ),
  },
  {
    id: "what-is-portal",
    question: "What is the portal?",
    answer: (
      <p>
        The portal is your progression hub — unlocked from the homepage golf ball once you qualify. It tracks your
        standing, unlocks, and path into contests tied to platform rules and your activity.
      </p>
    ),
  },
];

const MORE_ITEMS = [
  {
    id: "fantasy-golf-basics",
    anchorId: "fantasy-golf-basics",
    question: "How do contests and lineups work?",
    answer: (
      <p>
        You build a lineup within salary or rules shown on the contest card, join before lock, and score based on live
        results. Rules, payouts, and tiebreakers are displayed before you enter.
      </p>
    ),
  },
  {
    id: "payments-safe",
    question: "Are deposits and withdrawals safe?",
    answer: (
      <p>
        We use established payment flows and separate operational practices designed to protect user balances. During
        beta, processing times may vary slightly as we tune systems.
      </p>
    ),
  },
  {
    id: "support",
    question: "How do I get help?",
    answer: (
      <p>
        Use in-app feedback or reach out via the contact options listed on the site. We prioritize clear, fair outcomes
        for beta players.
      </p>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#020617] px-4 py-10 text-white sm:px-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <p className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-emerald-500/35 hover:bg-slate-900/80 hover:text-emerald-200"
          >
            ← Back to Home
          </Link>
        </p>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-950/40 p-6 shadow-[0_0_40px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Help</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">CashCaddies FAQ</h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Short answers on how CashCaddies works, what the Safety Coverage Fund does, beta access, and the portal —
            written for a premium, trustworthy DFS experience.
          </p>

          <div className="mt-10 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">Essentials</h2>
            <FaqAccordion items={CORE_ITEMS} />
          </div>

          <div className="mt-10 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/90">More</h2>
            <FaqAccordion items={MORE_ITEMS} />
          </div>

          <p className="mt-10 text-center text-sm text-slate-500">
            <Link href="/lobby" className="font-semibold text-emerald-400 hover:text-emerald-300">
              Go to Lobby
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
