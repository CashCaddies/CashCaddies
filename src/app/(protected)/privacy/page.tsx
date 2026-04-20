import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · CashCaddies",
  description:
    "CashCaddies Privacy Policy: what we collect, how we use it, and how we protect your information.",
};

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "Information we collect",
    body: "We collect information you provide when you create and use an account, such as email address and profile or account details needed to run the platform (for example, display name or handle where applicable). We may also collect technical data commonly sent by browsers, such as device type and general usage signals, as needed to operate and secure the service.",
  },
  {
    title: "How we use your information",
    body: "We use this information only to provide, maintain, and improve CashCaddies—authentication, contests, lineups, payments and credits where offered, support, security, and compliance. We do not use your personal information for unrelated marketing beyond what is necessary to operate the product unless we ask for separate consent where required.",
  },
  {
    title: "We do not sell your data",
    body: "We do not sell your personal information to third parties. We do not share your data for cross-site advertising sales. We may use service providers (such as hosting or authentication infrastructure) who process data only on our instructions and for the purposes described here.",
  },
  {
    title: "Security",
    body: "We use reasonable administrative, technical, and organizational measures designed to protect your information against unauthorized access, loss, or misuse. No method of transmission over the internet is completely secure; we cannot guarantee absolute security.",
  },
  {
    title: "Contact",
    body: "For privacy questions or requests, contact us at contact@cashcaddies.com. We will respond as required by applicable law.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-1 sm:px-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400/90">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-400 sm:text-lg">
          Last updated: March 2026. This policy describes how CashCaddies handles information when you use our website
          and services.
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

      <p className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-4 text-center text-sm text-slate-400 sm:px-5">
        <span className="font-medium text-slate-300">Email: </span>
        <a href="mailto:contact@cashcaddies.com" className="font-semibold text-emerald-400 hover:text-emerald-300">
          contact@cashcaddies.com
        </a>
      </p>

      <p className="text-center text-sm text-slate-500">
        <Link href="/terms" className="font-semibold text-emerald-400 hover:text-emerald-300">
          Terms of Service
        </Link>
        {" · "}
        <Link href="/lobby" className="font-semibold text-emerald-400 hover:text-emerald-300">
          Lobby
        </Link>
      </p>
    </div>
  );
}
