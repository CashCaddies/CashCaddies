"use client";

import { useEffect, useMemo, useState } from "react";
import type { LobbyContestPayoutRow, LobbyContestRow } from "@/lib/contest-lobby-shared";
import { LobbyAdminActions } from "@/components/lobby-admin-actions";
import { LobbyEmptyState } from "@/components/lobby-empty-state";
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
    const entryFee = Number(r.entry_fee ?? r.entry_fee_usd ?? 0);
    const maxEntries = Math.max(1, Number(r.max_entries ?? 100));
    const startsAt = String(r.starts_at ?? r.start_time ?? r.created_at ?? new Date().toISOString());
    out.push({
      id,
      name: String(r.name ?? "Contest"),
      entry_fee_usd: Number.isFinite(entryFee) ? entryFee : 0,
      entry_fee: Number.isFinite(entryFee) ? entryFee : 0,
      max_entries: maxEntries,
      max_entries_per_user: r.max_entries_per_user != null ? Number(r.max_entries_per_user) : 1,
      entry_count: typeof r.entry_count === "number" ? r.entry_count : 0,
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
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<{ role: string | null } | null>(null);

  useEffect(() => {
    const fetchContests = async () => {
      setLoading(true);
      setError(null);

      if (!supabase) {
        console.error("Contest fetch error: Supabase client unavailable");
        setError("Failed to load contests");
        setContests([]);
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("contests")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Contest fetch error:", fetchError);
        setError("Failed to load contests");
        setContests([]);
      } else {
        setContests(normalizeLobbyRows(data ?? []));
      }

      setLoading(false);
    };

    void fetchContests();
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

  const safeContests = useMemo(() => {
    const list = contests ?? [];
    return list.filter(
      (c): c is LobbyContestRow =>
        c != null &&
        typeof c.id === "string" &&
        c.id.length > 0 &&
        typeof c.name === "string"
    );
  }, [contests]);

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
              className="rounded border border-amber-600/50 bg-[#1c2128] px-3 py-1 text-xs font-semibold text-amber-100 hover:bg-[#252b33]"
              onClick={() => window.location.reload()}
            >
              FORCE REFRESH
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
            {safeContests.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <LobbyEmptyState viewerIsAdmin={admin} />
                </td>
              </tr>
            )}
            {safeContests.map((contest, index) => (
              <LobbyContestTableRow
                key={contest.id}
                contest={contest}
                index={index}
                viewerRole={profile?.role ?? null}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-x border-b border-[#2a3039] bg-[#141920] px-5 py-3 text-center text-xs text-[#6b7684]">
        Contests load from Supabase · Entry counts are paid entries · Safety Pool = platform pool balance ·
        Protected % = entries with a protected golfer ÷ total entries · Prize pool = entry fee × entries
      </p>
    </div>
  );
}
