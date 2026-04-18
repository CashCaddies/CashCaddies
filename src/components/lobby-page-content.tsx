"use client";

import { useCallback, useEffect, useState } from "react";
import type { LobbyContestPayoutRow, LobbyContestRow } from "@/lib/contest-lobby-shared";
import { formatLobbyEntryFeeUsd } from "@/lib/contest-lobby-shared";
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
    const entry_count = Number.isFinite(entryCount) ? Math.max(0, Math.floor(entryCount)) : 0;

    const curCol = r.current_entries;
    const current_entries =
      typeof curCol === "number" && Number.isFinite(curCol)
        ? curCol
        : typeof curCol === "string" && curCol.trim() !== ""
          ? Number(curCol)
          : undefined;

    out.push({
      id,
      name,
      entry_fee_usd: entryFee,
      entry_fee: entryFee,
      max_entries: Math.floor(maxEntries),
      max_entries_per_user: r.max_entries_per_user != null ? Number(r.max_entries_per_user) : 1,
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
      .select("*")
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
    return <div className="p-4">Loading contests...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  if (contests.length === 0) {
    return <div className="p-4">No contests available</div>;
  }

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-100 sm:text-lg">Daily Fantasy Golf</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Lobby</h1>
            <p className="mt-1 text-sm text-[#c5cdd5]">
              Guaranteed prize pools · Pick 6 · $50K salary cap
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
            <button
              type="button"
              className="rounded border border-amber-600/50 bg-[#1c2128] px-3 py-1 text-xs font-semibold text-amber-100 hover:bg-[#252b33] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void loadContests({ initial: false })}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing…" : "FORCE REFRESH"}
            </button>
            <span className="rounded border border-[#2f3640] bg-[#1c2128] px-3 py-1 text-xs font-semibold text-[#c5cdd5]">
              Classic
            </span>
            <span className="rounded border border-[#2f3640] bg-[#1c2128] px-3 py-1 text-xs font-semibold text-[#6b7684]">
              Showdown
            </span>
            <LobbyAdminActions viewerIsAdmin={admin} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border-x border-b border-[#2a3039] bg-[#0f1419]">
        <table className="w-full min-w-[920px] table-fixed border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#2a3039] bg-[#1a1f26] text-[11px] font-bold uppercase tracking-wider text-[#8b98a5]">
              <th className="w-[26%] px-4 py-3 pl-5 sm:px-5">Contest name</th>
              <th className="w-[16%] px-3 py-3">Entry fee</th>
              <th className="w-[12%] px-3 py-3 text-right">Max entries</th>
              <th className="w-[14%] px-3 py-3 text-right">Current entries</th>
              <th className="w-[16%] px-3 py-3">Start date</th>
              <th className="w-[16%] px-4 py-3 pr-5 text-right sm:px-5" />
            </tr>
          </thead>
          <tbody className="text-[#e8ecf0]">
            {contests?.map((contest, index) => (
              <LobbyContestTableRow
                key={contest.id}
                contest={contest}
                index={index}
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

      <p className="border-x border-b border-[#2a3039] bg-[#141920] px-5 py-3 text-center text-xs text-[#6b7684]">
        Contests load from Supabase · Entry counts are paid entries · Safety Pool = platform pool balance ·
        Protected % = entries with a protected golfer ÷ total entries · Prize pool = entry fee × entries
      </p>

      {modalContest ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setSelectedContest(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 text-slate-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contest-details-title"
          >
            <h2 id="contest-details-title" className="mb-4 text-xl font-bold">
              {modalContest.name}
            </h2>

            <div className="space-y-2 text-sm">
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
                <div className="mt-2 text-sm text-gray-500">
                  Payouts will be shown before contest starts.
                </div>
              )}

              <div>Status: {modalContest.status ?? "—"}</div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedContest(null)}
              className="mt-4 w-full rounded bg-gray-800 py-2 text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
