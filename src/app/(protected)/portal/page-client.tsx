"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CONTESTS_MINIMAL_SELECT } from "@/lib/contest-lobby-shared";
import { getPortalTierProgress, getTierFromContribution } from "@/lib/tiers";
import { supabase } from "@/lib/supabase/client";

function formatUsd(value: number): string {
  const n = Math.max(0, Number(value) || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

type ProfileRow = {
  season_contribution?: number | string | null;
};

type ContestRow = Record<string, unknown>;

export default function PortalPage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [contests, setContests] = useState<ContestRow[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingContests, setLoadingContests] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [contestsError, setContestsError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("season_contribution")
        .eq("id", session.user.id)
        .maybeSingle();
      setProfile(data ?? null);
      setLoadingProfile(false);
    };
    void loadProfile();
  }, []);

  useEffect(() => {
    const loadContests = async () => {
      setContestsError(null);
      const { data, error } = await supabase
        .from("contests")
        .select(CONTESTS_MINIMAL_SELECT)
        .order("created_at", { ascending: false });
      if (error) {
        setContestsError(error.message);
        setContests([]);
      } else {
        setContests((data ?? []) as unknown as ContestRow[]);
      }
      setLoadingContests(false);
    };
    void loadContests();
  }, []);

  const contribution = Number(profile?.season_contribution ?? 0);
  const tier = getTierFromContribution(contribution);
  const progress = useMemo(() => getPortalTierProgress(contribution), [contribution]);

  return (
    <div className="pageWrap">
      <div className="mx-auto max-w-3xl space-y-8 pb-16 pt-8">
        <header>
          <h1 className="text-3xl font-black tracking-tight text-white">Portal</h1>
          <p className="mt-2 text-sm text-slate-400">
            Portal contests and your Portal Access Tier — separate from loyalty rewards on your wallet.
          </p>
        </header>

        {/* 1 — User status */}
        <section className="goldCard p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Portal Access Tier</p>
          {loadingProfile ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Your Portal Access Tier comes from season contribution. It only controls access to portal contests — not
                lobby contests in general.
              </p>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Current tier</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-200">{tier}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Season contribution</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">{formatUsd(contribution)}</p>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-2 flex justify-between text-xs text-slate-500">
                  <span>
                    {progress.nextThreshold != null
                      ? `${formatUsd(progress.amountToNext)} to Portal Access Tier ${tier + 1}`
                      : "Maximum Portal Access Tier"}
                  </span>
                  <span className="tabular-nums">{formatUsd(contribution)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {/* 2 — How it works */}
        <section className="goldCard p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How it works</p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-sm leading-relaxed text-slate-300">
            <li>Enter contests in the Lobby.</li>
            <li>Season contribution raises your Portal Access Tier.</li>
            <li>Higher Portal Access Tiers unlock stronger portal contests when they run.</li>
          </ul>
          <Link
            href="/lobby"
            className="mt-5 inline-flex rounded-lg border border-emerald-500/45 bg-emerald-950/40 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-950/55"
          >
            Go to Lobby →
          </Link>
        </section>

        {/* 3 — Open contests (same safe columns as lobby; portal-only filtering disabled until DB supports it) */}
        <section className="goldCard p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Open contests</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Shown with the same fields as the lobby. Dedicated portal contest filters return when those columns exist in
            production.
          </p>
          {loadingContests ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : contestsError ? (
            <p className="mt-4 text-sm text-amber-200/95">{contestsError}</p>
          ) : contests.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No contests to show right now.</p>
          ) : (
            <ul className="mt-6 space-y-3">
              {contests.map((c) => {
                const id = String(c.id ?? "");
                const name = typeof c.name === "string" ? c.name : "Contest";
                const status = typeof c.status === "string" ? c.status : "—";
                const fee =
                  typeof c.entry_fee_usd === "number"
                    ? c.entry_fee_usd
                    : typeof c.entry_fee === "number"
                      ? c.entry_fee
                      : null;
                return (
                  <li key={id || name}>
                    <Link
                      href={id ? `/contest/${encodeURIComponent(id)}` : "/lobby"}
                      className="block rounded-lg border border-white/[0.08] bg-slate-950/50 px-4 py-3 transition hover:border-emerald-500/35 hover:bg-slate-900/80"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-white">{name}</span>
                        {fee != null ? (
                          <span className="text-sm tabular-nums text-slate-400">{formatUsd(fee)} entry</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs capitalize text-slate-500">{status}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 4 — Rules */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-5 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-950/50"
          >
            View Portal Rules
          </button>
        </div>

        <p className="text-center text-xs leading-relaxed text-slate-600">
          Loyalty status (Bronze / Silver / Gold / Platinum) is tracked separately — see your{" "}
          <Link href="/wallet" className="text-emerald-500/90 underline-offset-2 hover:text-emerald-400 hover:underline">
            wallet
          </Link>{" "}
          or dashboard wallet summary.
        </p>
      </div>

      {showRules ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="goldCard max-h-[85vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-white">Portal Rules</h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-300">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access</p>
                <p className="mt-1">
                  Portal contests are tied to your activity and platform rules. Enter contests in the Lobby to build your
                  season contribution.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portal Access Tier</p>
                <p className="mt-1">
                  Your Portal Access Tier is based on season contribution and only affects portal contests. Loyalty
                  tier (rewards on entry fees) is separate — check your wallet.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contribution</p>
                <p className="mt-1">A portion of eligible contest entry flows into your contribution track.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Protection fund</p>
                <p className="mt-1">
                  The protection fund supports fair outcomes around withdrawals, disqualifications, and unexpected
                  player events (WD, DQ, DNS). See the FAQ for Safety Coverage details.
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
              >
                Close
              </button>
              <Link
                href="/faq#what-is-portal"
                onClick={() => setShowRules(false)}
                className="rounded-lg border border-emerald-500/45 bg-emerald-950/40 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-950/60"
              >
                FAQ — Portal
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
