import Link from "next/link";
import { ContestLifecycleStatusBadge, ContestLockCountdown } from "@/components/contest-card";
import { resolveEffectiveContestLifecycle } from "@/lib/contest-state";
import { calculateSurplus, getOverlayAmount, getUnlockedTiers } from "@/lib/portal-logic";
import { createClientNoStore } from "@/lib/supabase/server";

type PortalFrequency = "weekly" | "biweekly" | "monthly";

type PortalContestRow = {
  id: string;
  name: string;
  starts_at: string | null;
  start_time: string | null;
  status: string | null;
  entries_open_at: string | null;
  created_at: string | null;
  prize_pool: number | string | null;
  overlay_amount: number | string | null;
  portal_frequency: PortalFrequency | null;
};

const FREQUENCY_SECTIONS: Array<{ key: PortalFrequency; title: string }> = [
  { key: "weekly", title: "WEEKLY PORTAL" },
  { key: "biweekly", title: "BI-WEEKLY PORTAL" },
  { key: "monthly", title: "MONTHLY PORTAL" },
];

const TIER_UNAVAILABLE: Record<PortalFrequency, string> = {
  weekly: "Weekly contests unavailable — fund threshold not met.",
  biweekly: "Bi-weekly contests unavailable — fund threshold not met.",
  monthly: "Monthly contests unavailable — fund threshold not met.",
};

const TIER_AVAILABLE: Record<PortalFrequency, string> = {
  weekly: "Weekly contests available",
  biweekly: "Bi-weekly contests available",
  monthly: "Monthly contests available",
};

function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function startIso(contest: PortalContestRow): string {
  return String(contest.starts_at ?? contest.start_time ?? contest.created_at ?? new Date().toISOString());
}

function formatStartDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Start date TBD";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const totalFund = 5000;
  const requiredBuffer = 3000;

  const surplus = calculateSurplus(totalFund, requiredBuffer);
  const unlocked = getUnlockedTiers(surplus);

  const supabase = await createClientNoStore();
  const { data, error } = await supabase
    .from("contests")
    .select("id,name,starts_at,start_time,status,entries_open_at,created_at,prize_pool,overlay_amount,portal_frequency")
    .eq("is_portal", true)
    .in("status", ["filling", "full", "locked", "live", "complete"])
    .order("start_time", { ascending: true });

  const contests = ((data ?? []) as PortalContestRow[]).filter((row) => row && row.id && row.name);
  const groups: Record<PortalFrequency, PortalContestRow[]> = {
    weekly: [],
    biweekly: [],
    monthly: [],
  };
  for (const contest of contests) {
    const key = contest.portal_frequency;
    if (key === "weekly" || key === "biweekly" || key === "monthly") {
      groups[key].push(contest);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-[#140b2a] via-[#141a33] to-[#0d1524] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200/90">Special Access</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Portal Contests</h1>
        <p className="mt-2 text-sm text-violet-100/80">
          Added prize overlays and premium contest drops, organized by cadence.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          {error.message}
        </div>
      ) : null}

      {surplus === 0 && (
        <p className="text-gray-400">
          No contests available — fund has not exceeded protection requirements yet.
        </p>
      )}

      {surplus > 0 && unlocked.length === 0 && (
        <p className="text-gray-400">
          Fund is growing. Portal contests unlock as surplus increases.
        </p>
      )}

      <div className="mb-6 rounded-lg border border-white/10 p-4">
        <p className="text-sm text-gray-400">
          Fund Surplus: <span className="text-white">{formatMoney(surplus)}</span>
        </p>
      </div>

      {FREQUENCY_SECTIONS.map((section) => (
        <section key={section.key} className="space-y-3">
          {section.key === "monthly" ? (
            <h2 className="mb-2 mt-8 text-sm tracking-widest text-gray-400">MONTHLY PORTAL</h2>
          ) : (
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-violet-200">{section.title}</h2>
          )}

          {unlocked.includes(section.key) ? (
            <div className="rounded-lg border border-white/10 p-4">
              <p className="text-emerald-400">
                Money Added: {formatMoney(getOverlayAmount(surplus, section.key))}
              </p>
            </div>
          ) : section.key === "monthly" ? (
            <p className="text-gray-400">
              Monthly contests unlock when fund surplus reaches premium levels.
            </p>
          ) : (
            <p className="text-gray-400">{TIER_UNAVAILABLE[section.key]}</p>
          )}

          {unlocked.includes(section.key) ? (
            groups[section.key].length === 0 ? (
              <div className="text-slate-300">{TIER_AVAILABLE[section.key]}</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {groups[section.key].map((contest) => {
                  const startsAt = startIso(contest);
                  const lifecycle = resolveEffectiveContestLifecycle({
                    status: contest.status,
                    starts_at: startsAt,
                    entries_open_at: contest.entries_open_at,
                    created_at: contest.created_at,
                  });
                  return (
                    <Link
                      key={contest.id}
                      href={`/lobby/${encodeURIComponent(contest.id)}`}
                      className="group rounded-2xl border border-violet-500/20 bg-[#0f1419] p-5 transition hover:border-violet-400/50 hover:bg-[#121a24]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-lg font-bold text-white">{contest.name}</p>
                        <ContestLifecycleStatusBadge status={contest.status} />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-slate-800 bg-[#101925] p-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">Prize Pool</p>
                          <p className="mt-1 text-base font-semibold text-slate-100">{formatMoney(contest.prize_pool)}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/25 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-emerald-300">Overlay</p>
                          <p className="mt-1 text-base font-extrabold text-emerald-300">
                            {formatMoney(contest.overlay_amount)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                        <span>{formatStartDate(startsAt)}</span>
                        <ContestLockCountdown lifecycle={lifecycle} startsAtIso={startsAt} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )
          ) : null}
        </section>
      ))}
    </div>
  );
}
