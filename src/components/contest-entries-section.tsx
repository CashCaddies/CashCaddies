"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/hooks/use-wallet";
import { ContestEntryCard } from "@/components/contest-entry";
import { getContestEntries, type ContestEntryRow } from "@/lib/getContestEntries";
import { isAdmin as isAdminRole } from "@/lib/permissions";

function formatEntryDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

type Props = {
  contestId: string;
  maxEntries: number;
  entryCount?: number | null;
};

export function ContestEntriesSection({ contestId, maxEntries, entryCount }: Props) {
  const { user, isReady } = useAuth();
  const { wallet, fullUser } = useWallet();
  const [entries, setEntries] = useState<ContestEntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = useMemo(() => isAdminRole(fullUser?.role), [fullUser?.role]);
  const safeEntries = useMemo(() => (Array.isArray(entries) ? entries : []), [entries]);
  const displayEntryCount = useMemo(() => {
    const n = Number(entryCount);
    return Number.isFinite(n) && n >= 0 ? n : safeEntries.length;
  }, [entryCount, safeEntries.length]);

  function resolveDisplayUser(entry: ContestEntryRow, index: number): string {
    const p = Array.isArray(entry.profiles) ? entry.profiles[0] : entry.profiles;
    const username = String(p?.username ?? "").trim();
    if (username) return username;
    const email = String(p?.email ?? "").trim();
    if (email) return email;
    return `Entry #${index + 1}`;
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await getContestEntries(contestId, {
        userId: user?.id ?? null,
        isAdmin,
      });
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    }
    if (!isReady) return;
    void load();
    return () => {
      cancelled = true;
    };
  }, [contestId, isAdmin, isReady, user?.id]);

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <h2 className="text-lg font-semibold text-white">Contest Entries</h2>
      <p className="mt-1 text-sm text-slate-300">
        Total Entries: {displayEntryCount} / {maxEntries}
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-slate-400">Loading entries...</p>
      ) : safeEntries.length === 0 ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-3 text-sm text-slate-400">
          No entries yet
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {safeEntries.map((entry, index) => (
            <ContestEntryCard
              key={entry.id}
              id={entry.id}
              contestId={contestId}
              index={index}
              userLabel={resolveDisplayUser(entry, index)}
              createdAtLabel={formatEntryDate(entry.created_at)}
              isAdmin={isAdmin}
              entry_protected={entry.entry_protected}
              lineup_edited={entry.lineup_edited}
              entry_protection_forced={entry.entry_protection_forced}
              lock_timestamp={entry.lock_timestamp}
            />
          ))}
        </div>
      )}
    </section>
  );
}
