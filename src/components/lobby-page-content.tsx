"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LobbyContestPayoutRow, LobbyContestRow } from "@/lib/contest-lobby-shared";
import {
  CONTESTS_MINIMAL_SELECT,
  entryCountFromContestEntriesRelation,
  formatLobbyEntryFeeUsd,
} from "@/lib/contest-lobby-shared";
import { LobbyAdminActions } from "@/components/lobby-admin-actions";
import { LobbyContestTableRow } from "@/components/lobby-contest-table-row";
import { getProfile } from "@/lib/getProfile";
import { isAdmin } from "@/lib/permissions";
import { supabase } from "@/lib/supabase/client";

function normalizeLobbyRows(raw: unknown[]): LobbyContestRow[] {
  const emptyPayouts: LobbyContestPayoutRow[] = [];
  const out: LobbyContestRow[] = [];
  for (const row of raw) {
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? "").trim();
    if (!id) continue;

    const name = String(r.name ?? "").trim();
    if (!name) continue;

    const maxEntries = Number(r.max_entries);
    if (!Number.isFinite(maxEntries) || maxEntries < 1) continue;

    const startRaw = r.starts_at ?? r.start_time ?? r.created_at;
    if (startRaw == null || String(startRaw).trim() === "") continue;
    const startsAt = String(startRaw);

    const entryFee = Number(r.entry_fee ?? r.entry_fee_usd);
    if (!Number.isFinite(entryFee)) continue;

    const ecRaw = r.entry_count ?? r.current_entries;
    const entryCount =
      typeof ecRaw === "number" && Number.isFinite(ecRaw)
        ? ecRaw
        : typeof ecRaw === "string" && ecRaw.trim() !== ""
          ? Number(ecRaw)
          : NaN;
    const fromEmbed = entryCountFromContestEntriesRelation(r);
    const entry_count = Number.isFinite(entryCount)
      ? Math.max(0, Math.floor(entryCount))
      : fromEmbed;

    const curCol = r.current_entries;
    const current_entries =
      typeof curCol === "number" && Number.isFinite(curCol)
        ? curCol
        : typeof curCol === "string" && curCol.trim() !== ""
          ? Number(curCol)
          : undefined;

    const mpuRaw = r.max_entries_per_user;
    const max_entries_per_user =
      mpuRaw != null && Number.isFinite(Number(mpuRaw)) && Number(mpuRaw) > 0
        ? Math.floor(Number(mpuRaw))
        : 1;

    out.push({
      id,
      name,
      entry_fee_usd: entryFee,
      entry_fee: entryFee,
      max_entries: Math.floor(maxEntries),
      max_entries_per_user,
      entry_count,
      current_entries: Number.isFinite(current_entries ?? NaN) ? current_entries : undefined,
      starts_at: startsAt,
      start_time: r.start_time != null ? String(r.start_time) : null,
      status: r.status != null ? String(r.status) : null,
      entries_open_at: r.entries_open_at != null ? String(r.entries_open_at) : null,
      created_at: r.created_at != null ? String(r.created_at) : null,
      has_settlement: false,
      protected_entries_count: 0,
      safety_pool_usd: typeof r.safety_pool_usd === "number" ? r.safety_pool_usd : 0,
      late_swap_enabled:
        r.late_swap_enabled === undefined || r.late_swap_enabled === null ? true : Boolean(r.late_swap_enabled),
      payouts: emptyPayouts,
    });
  }
  return out;
}

type LobbyContestTableProps = {
  contests: LobbyContestRow[];
  indexOffset: number;
  profile: { role: string | null } | null;
  patchContest: (contestId: string, patch: Partial<LobbyContestRow>) => void;
  removeContest: (contestId: string) => void;
  loadContests: (opts?: { initial?: boolean }) => Promise<void>;
  setSelectedContest: (c: LobbyContestRow) => void;
};

function LobbyContestTable({
  contests,
  indexOffset,
  profile,
  patchContest,
  removeContest,
  loadContests,
  setSelectedContest,
}: LobbyContestTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800/90 bg-slate-950/40">
      <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800/90 bg-slate-900/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <th className="w-[26%] px-4 py-3 pl-5 sm:px-5">Contest name</th>
            <th className="w-[16%] px-3 py-3">Entry fee</th>
            <th className="w-[12%] px-3 py-3 text-right">Max entries</th>
            <th className="w-[14%] px-3 py-3 text-right">Current entries</th>
            <th className="w-[16%] px-3 py-3">Start date</th>
            <th className="w-[16%] px-4 py-3 pr-5 text-right sm:px-5" />
          </tr>
        </thead>
        <tbody className="text-slate-100">
          {contests.map((contest, i) => (
            <LobbyContestTableRow
              key={contest.id}
              contest={contest}
              index={indexOffset + i}
              viewerRole={profile?.role ?? null}
              onContestPatched={patchContest}
              onContestRemoved={removeContest}
              onRefresh={loadContests}
              onRowClick={() => setSelectedContest(contest)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LobbyPageContent() {
  const [contests, setContests] = useState<LobbyContestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<{ role: string | null } | null>(null);
  const [selectedContest, setSelectedContest] = useState<LobbyContestRow | null>(null);

  const loadContests = useCallback(async (opts?: { initial?: boolean }) => {
    const initial = opts?.initial === true;
    if (initial) {
      setLoading(true);
      setError(null);
    } else {
      setRefreshing(true);
    }

    if (!supabase) {
      console.error("Contest fetch error: Supabase client unavailable");
      if (initial) {
        setError("Failed to load contests");
        setContests([]);
        setLoading(false);
      }
      setRefreshing(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("contests")
      .select(CONTESTS_MINIMAL_SELECT)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Contest fetch error:", fetchError);
      if (initial) {
        setError("Failed to load contests");
        setContests([]);
      }
    } else {
      setContests(normalizeLobbyRows(data ?? []));
    }

    if (initial) {
      setLoading(false);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadContests({ initial: true });
  }, [loadContests]);

  const patchContest = useCallback((contestId: string, patch: Partial<LobbyContestRow>) => {
    setContests((prev) => prev.map((c) => (c.id === contestId ? { ...c, ...patch } : c)));
  }, []);

  const removeContest = useCallback((contestId: string) => {
    setContests((prev) => prev.filter((c) => c.id !== contestId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await getProfile();
      if (!cancelled) {
        setProfile(p ? { role: p.role } : { role: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const admin = isAdmin(profile?.role);

  const modalContest =
    selectedContest != null
      ? (contests.find((c) => c.id === selectedContest.id) ?? selectedContest)
      : null;

  if (loading) {
    return (
      <div className="pageWrap py-16">
        <p className="text-center text-sm text-slate-400">Loading contests…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pageWrap py-16">
        <p className="mx-auto max-w-md rounded-lg border border-red-500/35 bg-red-950/30 px-4 py-3 text-center text-sm text-red-100">
          {error}
        </p>
      </div>
    );
  }

  if (contests.length === 0) {
    return (
      <div className="pageWrap py-16">
        <p className="text-center text-sm text-slate-400">No contests are open right now.</p>
      </div>
    );
  }

  return (
    <div className="pageWrap pb-14 pt-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="goldCard goldCardStatic p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/90">Lobby</p>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Contests</h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
                Open contests from the database. Your{" "}
                <Link href="/portal" className="font-semibold text-emerald-400 underline-offset-2 hover:underline">
                  Portal Access Tier
                </Link>{" "}
                (season contribution) is separate from lobby contests. Loyalty rewards (Bronze–Platinum) are on your{" "}
                <Link href="/wallet" className="font-semibold text-emerald-400 underline-offset-2 hover:underline">
                  wallet
                </Link>
                .
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void loadContests({ initial: false })}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              <LobbyAdminActions viewerIsAdmin={admin} />
            </div>
          </div>
        </header>

        <section className="space-y-3" aria-labelledby="lobby-contests-heading">
          <div className="flex flex-col gap-1 border-b border-slate-800 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="lobby-contests-heading" className="text-lg font-bold text-white">
                Contests
              </h2>
              <p className="mt-1 text-xs text-slate-500">All open contests in the lobby.</p>
            </div>
          </div>
          <LobbyContestTable
            contests={contests}
            indexOffset={0}
            profile={profile}
            patchContest={patchContest}
            removeContest={removeContest}
            loadContests={loadContests}
            setSelectedContest={setSelectedContest}
          />
        </section>

        <p className="text-center text-xs leading-relaxed text-slate-600">
          Data from Supabase · Current entries and caps are shown per contest · Safety pool and protected % come from
          contest stats when available.
        </p>

        <p className="text-center text-xs text-slate-600">
          Loyalty tier and perks are tracked on your{" "}
          <Link href="/wallet" className="text-emerald-500/90 underline-offset-2 hover:text-emerald-400 hover:underline">
            wallet
          </Link>{" "}
          — separate from Portal Access Tier.
        </p>
      </div>

      {modalContest ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setSelectedContest(null)}
          role="presentation"
        >
          <div
            className="goldCard goldCardStatic w-full max-w-md p-6 text-slate-100 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contest-details-title"
          >
            <h2 id="contest-details-title" className="mb-1 text-xl font-bold text-white">
              {modalContest.name}
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              See{" "}
              <Link href="/portal" className="font-semibold text-emerald-400 underline-offset-2 hover:underline">
                /portal
              </Link>{" "}
              for your Portal Access Tier (separate from this contest list).
            </p>

            <div className="space-y-2 text-sm text-slate-300">
              <div>
                Entry Fee:{" "}
                {formatLobbyEntryFeeUsd(modalContest.entry_fee ?? modalContest.entry_fee_usd)}
              </div>
              <div>
                Entries: {modalContest.current_entries ?? modalContest.entry_count} /{" "}
                {modalContest.max_entries}
              </div>
              <div>
                Prize Pool:{" "}
                {modalContest.prize_pool != null && String(modalContest.prize_pool).trim() !== ""
                  ? formatLobbyEntryFeeUsd(modalContest.prize_pool)
                  : "—"}
              </div>

              {modalContest.payouts && modalContest.payouts.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-2 font-semibold">Payouts</div>

                  <div className="space-y-1 text-sm">
                    {modalContest.payouts.map((p) => {
                      const poolRaw = modalContest.prize_pool;
                      const poolNum =
                        poolRaw != null && String(poolRaw).trim() !== ""
                          ? typeof poolRaw === "string"
                            ? Number.parseFloat(poolRaw)
                            : Number(poolRaw)
                          : NaN;
                      const pct = Number(p.payout_pct);
                      const shareUsd =
                        Number.isFinite(poolNum) && Number.isFinite(pct)
                          ? formatLobbyEntryFeeUsd((poolNum * pct) / 100)
                          : null;

                      return (
                        <div key={p.rank_place} className="flex justify-between gap-4">
                          <span>#{p.rank_place}</span>
                          <span className="tabular-nums text-right">
                            {shareUsd != null ? (
                              <>
                                {shareUsd}{" "}
                                <span className="text-slate-500">({pct.toFixed(0)}%)</span>
                              </>
                            ) : (
                              `${pct.toFixed(0)}%`
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-500">No payout rows loaded for this contest.</div>
              )}

              <div>Status: {modalContest.status ?? "—"}</div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedContest(null)}
              className="mt-5 w-full rounded-lg border border-slate-600 bg-slate-900 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
