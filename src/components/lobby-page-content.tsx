"use client";

import { useEffect, useMemo, useState } from "react";
import type { LobbyContestRow } from "@/lib/contest-lobby-shared";
import { LobbyAdminActions } from "@/components/lobby-admin-actions";
import { LobbyEmptyState } from "@/components/lobby-empty-state";
import { LobbyContestTableRow } from "@/components/lobby-contest-table-row";
import { getProfile } from "@/lib/getProfile";
import { isAdmin } from "@/lib/permissions";

type Props = {
  contests: LobbyContestRow[];
  error: string | null;
};

export function LobbyPageContent({ contests, error }: Props) {
  const [profile, setProfile] = useState<{ role: string | null } | null>(null);

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
          <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
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

      {error && (
        <div className="border-x border-b border-amber-700/40 bg-amber-950/30 px-5 py-4 text-sm text-amber-100">
          {error}
        </div>
      )}

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
            {!error && safeContests.length === 0 && (
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
