import Link from "next/link";
import { notFound } from "next/navigation";
import { ContestEntriesSection } from "@/components/contest-entries-section";
import { ContestLifecycleBadge } from "@/components/contest-card";
import { ensureContestEntryProtection } from "@/lib/entry-protection-server";
import { fetchLobbyContestById, formatLobbyEntryFeeUsd } from "@/lib/contest-lobby-fetch";
import { formatContestStartDate } from "@/lib/contest-lobby-shared";
import { resolveEffectiveContestLifecycle } from "@/lib/contest-state";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ contestId: string }>;
};

export default async function ContestDetailPage({ params }: Props) {
  const { contestId } = await params;
  const id = contestId?.trim() ?? "";
  if (!id) {
    notFound();
  }

  const row = await fetchLobbyContestById(id);
  if (!row) {
    notFound();
  }

  try {
    const supabase = await createClient();
    await ensureContestEntryProtection(supabase, id);
  } catch {
    /* no-op */
  }

  const maxEntries = Math.max(1, Number(row.max_entries ?? 100));
  const entryCount = Math.max(0, Number(row.entry_count ?? 0));
  const lifecycle = resolveEffectiveContestLifecycle({
    status: row.status,
    starts_at: row.starts_at,
    entries_open_at: row.entries_open_at,
    created_at: row.created_at,
    has_settlement: row.has_settlement,
  });

  return (
    <div className="pageWrap">
      <div className="goldCard p-6">
        <h1 className="text-2xl font-semibold text-white">{row.name}</h1>
        <div className="mt-4 space-y-2 text-sm text-slate-300">
          <p>
            <span className="text-slate-400">Entry fee:</span>{" "}
            {formatLobbyEntryFeeUsd(row.entry_fee ?? row.entry_fee_usd)}
          </p>
          <p>
            <span className="text-slate-400">Entry count:</span> {entryCount} / {maxEntries}
          </p>
          <p>
            <span className="text-slate-400">Start time:</span>{" "}
            {formatContestStartDate(row.start_time ?? row.starts_at)}
          </p>
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400">Status:</span>
            <ContestLifecycleBadge lifecycle={lifecycle} />
          </p>
        </div>
        <ContestEntriesSection contestId={id} maxEntries={maxEntries} entryCount={entryCount} />
        <Link href="/lobby" className="mt-4 inline-flex text-sm font-semibold text-emerald-300 hover:underline">
          Back to Lobby
        </Link>
      </div>
    </div>
  );
}
