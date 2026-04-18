import type { Metadata } from "next";
import Link from "next/link";
import { FaqAccordion } from "@/components/faq-accordion";

export const metadata: Metadata = {
  title: "FAQ · CashCaddies",
  description: "CashCaddies FAQ for beta users, contest rules, payments, legal basics, and support.",
};

const GETTING_STARTED_ITEMS = [
  {
    id: "what-makes-cashcaddies-different",
    anchorId: "safety-coverage",
    question: "What makes CashCaddies different from other DFS platforms?",
    answer: (
      <>
        <p>
          CashCaddies focuses on fairness, transparency, and player protection. Unlike many DFS platforms, we
          prioritize smaller contests, better odds, and innovative protection features designed specifically for golf
          contests.
        </p>
        <p className="mt-3">Key differences:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-emerald-500/80">
          <li>
            Safety Coverage Fund – Every entry is automatically protected. If a golfer withdraws before Round 1
            late-swap closes, you receive a full Protection Credit equal to your entry fee.
          </li>
          <li>Better Odds - Smaller fields mean better chances to win compared to massive tournaments.</li>
          <li>Community Focused - Built during beta with direct player feedback shaping features.</li>
          <li>Transparent Structure - Clear contest payouts and simple rules.</li>
          <li>Founder Built - Developed by a DFS player focused on improving the player experience.</li>
        </ul>
      </>
    ),
  },
  {
    id: "what-is-cashcaddies",
    question: "What is CashCaddies?",
    answer: (
      <>
        <p>
          CashCaddies is a skill-based fantasy sports contest platform where users can create or join contests for real
          cash prizes. Players compete based on real athlete performance and contest rules.
        </p>
        <p className="mt-3">CashCaddies is currently in beta as we continue improving features and platform stability.</p>
      </>
    ),
  },
  {
    id: "what-does-beta-mean",
    question: "What does beta mean?",
    answer: (
      <>
        <p>During beta:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-emerald-500/80">
          <li>Features may improve or change</li>
          <li>Minor bugs may occur</li>
          <li>New functionality may be added</li>
          <li>User feedback helps shape development</li>
        </ul>
        <p className="mt-3">Our goal is building the safest and easiest DFS contest experience possible.</p>
      </>
    ),
  },
  {
    id: "how-do-contests-work",
    question: "How do contests work?",
    answer: (
      <>
        <p>Users can:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-emerald-500/80">
          <li>Create contests</li>
          <li>Join contests</li>
          <li>Select players</li>
          <li>Compete based on performance</li>
          <li>Win prizes based on standings</li>
        </ul>
        <p className="mt-3">Contest details and rules are always shown before entry.</p>
      </>
    ),
  },
  {
    id: "what-is-the-portal",
    question: "What exactly is the golf ball on the homepage?",
    answer: (
      <>
        <p>The golf ball on the homepage is your personal entry point into qualified contests.</p>

        <p className="mt-3">
          When you click it, it takes you into contests that you are mathematically qualified to enter based on your
          contribution to the protection fund.
        </p>

        <p className="mt-3">
          The more you contribute to the protection fund, the more contests you can unlock and access.
        </p>
      </>
    ),
  },
];

const PAYMENTS_ITEMS = [
  {
    id: "are-funds-safe",
    question: "Are funds safe?",
    answer: (
      <>
        <p>
          User security and fairness are top priorities. CashCaddies uses secure payment providers and platform
          protections designed to keep contests fair and user funds protected.
        </p>
        <p className="mt-3">During beta we may continue optimizing some financial processes.</p>
      </>
    ),
  },
  {
    id: "how-do-deposits-work",
    question: "How do deposits work?",
    answer: (
      <p>
        Users can add funds using available payment options inside their account dashboard. Deposits are typically
        available shortly after processing.
      </p>
    ),
  },
  {
    id: "how-do-withdrawals-work",
    question: "How do withdrawals work?",
    answer: (
      <>
        <p>Users can request withdrawals from their available account balance.</p>
        <p className="mt-3">Typical processing time: 24-72 hours.</p>
        <p>During beta, processing may occasionally take longer while we continue improving systems.</p>
      </>
    ),
  },
];

const CONTESTS_AND_RULES_ITEMS = [
  {
    id: "contest-does-not-fill",
    question: "What happens if a contest doesn't fill?",
    answer: (
      <p>
        If a contest does not meet entry requirements it may be cancelled and entries refunded according to contest
        rules shown before joining.
      </p>
    ),
  },
  {
    id: "ensure-fairness",
    question: "How do you ensure fairness?",
    answer: (
      <>
        <p>
          CashCaddies actively monitors contests and activity to maintain fair competition. Accounts violating rules may
          be reviewed or restricted.
        </p>
        <p className="mt-3">We continuously improve protections during beta.</p>
      </>
    ),
  },
  {
    id: "multiple-accounts",
    question: "Can I have multiple accounts?",
    answer: (
      <p>No. Each user is limited to one account to maintain fair competition and platform integrity.</p>
    ),
  },
];

const LEGAL_ITEMS = [
  {
    id: "who-can-use-cashcaddies",
    question: "Who can use CashCaddies?",
    answer: (
      <p>
        Users must meet age requirements, follow applicable laws, and agree to platform terms. Availability may vary
        depending on location.
      </p>
    ),
  },
];

const BETA_TRANSPARENCY_ITEMS = [
  {
    id: "why-join-beta",
    question: "Why join during beta?",
    answer: (
      <p>
        Beta users help shape the future of CashCaddies. Early users help improve the platform and may receive early
        access to new features and improvements as we grow.
      </p>
    ),
  },
  {
    id: "beta-changes",
    question: "Can rules or features change during beta?",
    answer: (
      <p>
        Yes. During beta we may adjust features, contest structures, or settings to improve fairness, security, and
        performance. Major changes will always be communicated when possible.
      </p>
    ),
  },
];

const SUPPORT_ITEMS = [
  {
    id: "bugs-feedback",
    question: "How can I report bugs or feedback?",
    answer: (
      <p>
        Users can submit feedback through the feedback section or support contact areas. We actively review beta
        feedback to improve the platform.
      </p>
    ),
  },
  {
    id: "support-or-donate",
    highlightQuestion: true,
    question: "How can I support or donate to CashCaddies?",
    answer: (
      <>
        <p>
          CashCaddies is currently self-funded during beta. If you are interested in supporting development,
          partnerships, or contributing to the project, please contact:{" "}
          <a
            href="mailto:contact@cashcaddies.com"
            className="font-medium text-emerald-400 underline decoration-emerald-500/40 underline-offset-2 hover:text-emerald-300"
          >
            contact@cashcaddies.com
          </a>
        </p>
        <p className="mt-3">We are especially interested in:</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-emerald-500/80">
          <li>Early supporters</li>
          <li>Strategic partners</li>
          <li>Fantasy sports players who want to help shape the platform</li>
          <li>Investors interested in the long-term vision</li>
        </ul>
        <p className="mt-3">
          Support helps accelerate feature development, security improvements, and prize pool growth.
        </p>
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#020617] px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="space-y-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">FAQ</p>
            <h1 className="mt-2 flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Frequently asked questions
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">
                Beta
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-base text-slate-400 sm:text-lg">
              Trusted beta guidance for getting started, payments, contest rules, legal basics, and support.
            </p>
          </div>

          <div className="space-y-4">
            <aside
              className="rounded-xl border border-[#D4AF37]/35 bg-slate-900/40 px-4 py-4 shadow-[0_0_10px_rgba(212,175,55,0.18)] sm:px-5 sm:py-5"
              aria-label="CashCaddies beta notice"
            >
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">CashCaddies Beta</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                CashCaddies is currently in beta testing. Features, contests, and functionality may evolve as we improve
                stability, fairness, and user experience. We appreciate early users helping us build the future of the
                platform.
              </p>
            </aside>
          </div>

          <div className="space-y-4">
            <h2
              id="getting-started"
              className="scroll-mt-36 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90"
            >
              Getting Started
            </h2>
            <FaqAccordion items={GETTING_STARTED_ITEMS} />
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Payments</h2>
            <FaqAccordion items={PAYMENTS_ITEMS} />
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Contests &amp; Rules</h2>
            <FaqAccordion items={CONTESTS_AND_RULES_ITEMS} />
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Legal</h2>
            <FaqAccordion items={LEGAL_ITEMS} />
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Beta Transparency</h2>
            <FaqAccordion items={BETA_TRANSPARENCY_ITEMS} />
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Support</h2>
            <FaqAccordion items={SUPPORT_ITEMS} />
          </div>

          <p className="text-center text-sm text-slate-500">
            <Link href="/lobby" className="font-semibold text-emerald-400 hover:text-emerald-300">
              Back to Lobby
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
