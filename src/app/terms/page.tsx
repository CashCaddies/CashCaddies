import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · CashCaddies",
  description:
    "CashCaddies Terms of Service: beta product terms, contest participation, liability, and account policies.",
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Beta product",
    body: "CashCaddies is offered in beta. The platform may contain bugs, downtime, or incomplete features. We may update, change, or discontinue functionality with or without notice. Your use of the service during beta is at your own risk. Scores, projections, simulations, and contest results may be inaccurate during beta testing and are provided for testing purposes only.",
  },
  {
    title: "Age requirement",
    body: "Users must be 21 years or older to use CashCaddies. By creating an account, you confirm you meet this age requirement and are legally allowed to participate in fantasy contests in your jurisdiction.",
  },
  {
    title: "No financial advice",
    body: "Nothing on CashCaddies constitutes financial, investment, tax, or legal advice. Information about contests, fees, protection, or payouts is descriptive only and is not a recommendation to spend money or enter any contest. CashCaddies is provided for entertainment and informational purposes only.",
  },
  {
    title: "No guarantee of winnings",
    body: "Fantasy contests involve skill and chance. Past or hypothetical results do not guarantee future outcomes. CashCaddies does not promise that you will win prizes or recover entry fees.",
  },
  {
    title: "Your responsibility for entries",
    body: "You are solely responsible for your account, lineups, entries, fees, and compliance with applicable laws where you play. You must provide accurate registration information and keep your credentials secure.",
  },
  {
    title: "Contests subject to change",
    body: "Contest formats, rules, schedules, prize structures, entry limits, protection terms, and eligibility may change. Each contest is governed by the rules and copy presented at the time you enter, except where we must make changes for integrity, compliance, or operational reasons.",
  },
  {
    title: "Limitation of liability",
    body: "To the fullest extent permitted by law, CashCaddies and its operators are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill, arising from your use of the service. Our total liability for any claim related to the service is limited to the amount you paid us in fees for the specific transaction giving rise to the claim during the twelve months before the claim, or one hundred U.S. dollars (USD $100), whichever is greater, except where liability cannot be limited by law.",
  },
  {
    title: "Suspension and termination",
    body: "We may suspend or terminate accounts that violate these terms, our Fair Play Principles, or applicable law, or that present fraud, abuse, or risk to the platform or other users. We may also refuse service to anyone at our discretion where permitted by law.",
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-1 sm:px-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Terms of Service</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-400 sm:text-lg">
          Last updated: March 2026. By using CashCaddies, you agree to these terms. If you do not agree, do not use the
          platform.
        </p>
      </div>

      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <section
            key={s.title}
            className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-4 sm:px-5 sm:py-5"
          >
            <h2 className="text-lg font-semibold text-white">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">{s.body}</p>
          </section>
        ))}
      </div>

      <p className="text-center text-sm text-slate-500">
        Questions?{" "}
        <a href="mailto:contact@cashcaddies.com" className="font-semibold text-emerald-400 hover:text-emerald-300">
          contact@cashcaddies.com
        </a>
      </p>

      <p className="text-center text-sm text-slate-500">
        <Link href="/privacy" className="font-semibold text-emerald-400 hover:text-emerald-300">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/lobby" className="font-semibold text-emerald-400 hover:text-emerald-300">
          Lobby
        </Link>
      </p>
    </div>
  );
}
