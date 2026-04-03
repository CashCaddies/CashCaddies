import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LineupBuilder } from "@/components/lineup-builder";
import { CASHCADDIE_PROTECTION_FEE_USD } from "@/lib/contest-lobby-data";
import { getPayEntryBlockedBannerForUser } from "@/lib/contest-entry-eligibility";
import { loadContestForLineupPage } from "@/lib/contest-resolve";
import { loadDraftLineupForEditor, loadLatestDraftLineupForContest } from "@/lib/lineup-draft-load";
import { createClient } from "@/lib/supabase/server";

type LineupPageProps = {
  searchParams: Promise<{ contest?: string; edit?: string; entryId?: string }>;
};

async function payEntryBannerForContest(resolvedId: string): Promise<string | null> {
  if (resolvedId === "default") {
    return null;
  }
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }
    return getPayEntryBlockedBannerForUser(supabase, {
      contestId: resolvedId,
      userId: user.id,
    });
  } catch {
    return null;
  }
}

export default async function LineupPage(props: LineupPageProps) {
  const { contest, edit, entryId } = await props.searchParams;
  const editTrim = edit?.trim();
  const entryTrim = entryId?.trim();

  if (editTrim) {
    const loaded = await loadDraftLineupForEditor(editTrim);
    if (loaded.status === "unauthorized") {
      redirect(`/login?next=${encodeURIComponent(`/lineup?edit=${encodeURIComponent(editTrim)}`)}`);
    }
    if (loaded.status === "locked") {
      return (
        <div className="space-y-0">
          <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
            <h1 className="text-2xl font-bold text-white">Lineup locked</h1>
            <p className="mt-2 text-sm text-[#c5cdd5]">
              This lineup is already entered in a contest. Rosters cannot be changed after entry.
            </p>
            <Link
              href="/dashboard/lineups"
              className="mt-4 inline-block text-sm font-semibold text-emerald-400 underline hover:text-emerald-300"
            >
              Back to My Lineups
            </Link>
          </div>
        </div>
      );
    }
    if (loaded.status === "not_found") {
      return (
        <div className="space-y-0">
          <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
            <h1 className="text-2xl font-bold text-white">Lineup not found</h1>
            <p className="mt-2 text-sm text-[#c5cdd5]">We couldn&apos;t load that lineup. It may have been removed.</p>
            <Link
              href="/dashboard/lineups"
              className="mt-4 inline-block text-sm font-semibold text-emerald-400 underline hover:text-emerald-300"
            >
              My Lineups
            </Link>
          </div>
        </div>
      );
    }

    const resolved = await loadContestForLineupPage(loaded.data.contestId ?? undefined);
    const payEntryBlockedBanner = await payEntryBannerForContest(resolved.id);
    return (
      <div className="space-y-0">
        <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
          <p className="text-base font-semibold text-slate-100 sm:text-lg">Daily Fantasy Golf</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Edit lineup</h1>
          <p className="mt-3 rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100">
            Automatic protection applies if any roster golfer WD/DNS/DQ — no manual pick.
          </p>
          <p className="mt-1">
            <Link
              href="/faq#fantasy-golf-basics"
              className="text-sm text-slate-400 transition-colors hover:text-emerald-400 hover:underline"
            >
              New to DFS Golf? Learn the basics
            </Link>
          </p>
          <p className="mt-1 text-sm text-[#c5cdd5]">
            Pick 6 golfers · $50,000 salary cap · Saving updates this draft
          </p>
        </div>
        <LineupBuilder
          editMode={loaded.data}
          contestId={resolved.id}
          contestName={resolved.name}
          entryFeeLabel={resolved.entryFeeLabel}
          entryFeeUsd={resolved.entryFeeUsd}
          protectionFeeUsd={CASHCADDIE_PROTECTION_FEE_USD}
          contestLineupLocked={resolved.lineupLocked}
          payEntryBlockedBanner={payEntryBlockedBanner}
        />
      </div>
    );
  }

  if (entryTrim) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect(`/login?next=${encodeURIComponent(`/lineup?entryId=${encodeURIComponent(entryTrim)}`)}`);
    }

    const {
      data: entryRow,
      error: entryErr,
    } = await supabase
      .from("contest_entries")
      .select("id, user_id, contest_id, lineup_id, entry_number")
      .eq("id", entryTrim)
      .maybeSingle();

    if (entryErr || !entryRow) {
      return notFound();
    }

    if (entryRow.user_id !== user.id || !entryRow.lineup_id) {
      redirect("/dashboard/lineups");
    }

    const entryNumber = Number(entryRow.entry_number ?? 0) || 0;
    const resolved = await loadContestForLineupPage(String(entryRow.contest_id ?? "default"));
    if (resolved.id === "default") {
      return notFound();
    }

    if (!resolved.allowEntryLineupEdit) {
      return (
        <div className="space-y-0">
          <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
            <h1 className="text-2xl font-bold text-white">Lineup locked</h1>
            <p className="mt-2 text-sm text-[#c5cdd5]">Editing this entry is closed for this contest.</p>
            <Link
              href="/dashboard/lineups"
              className="mt-4 inline-block text-sm font-semibold text-emerald-400 underline hover:text-emerald-300"
            >
              Back to My Lineups
            </Link>
          </div>
        </div>
      );
    }

    await supabase.rpc("sync_lineup_player_game_locks", { p_lineup_id: entryRow.lineup_id });

    const { data: lineupRow, error: lineupErr } = await supabase
      .from("lineups")
      .select("id,user_id,contest_id,protection_enabled")
      .eq("id", entryRow.lineup_id)
      .maybeSingle();

    if (lineupErr || !lineupRow || lineupRow.user_id !== user.id) {
      return notFound();
    }

    const { data: slotRows, error: slotsErr } = await supabase
      .from("lineup_players")
      .select("id, slot_index, golfer_id, game_start_time, is_locked")
      .eq("lineup_id", entryRow.lineup_id)
      .order("slot_index", { ascending: true });

    if (slotsErr || !slotRows || slotRows.length !== 6) {
      return notFound();
    }

    const golferIds = slotRows.map((r) => String(r.golfer_id));
    const rosterSlots = slotRows.map((r) => ({
      lineupPlayerId: String(r.id),
      slotIndex: Number(r.slot_index),
      golferId: String(r.golfer_id),
      gameStartTime: r.game_start_time != null ? String(r.game_start_time) : null,
      isLocked: Boolean(r.is_locked),
    }));
    const protectedGolferIds: string[] = [];

    const protectionEnabled = Boolean(lineupRow.protection_enabled);

    const editMode = {
      lineupId: String(lineupRow.id),
      contestId: String(entryRow.contest_id ?? resolved.id),
      golferIds,
      protectionEnabled,
      protectedGolferIds,
      editingContestEntryId: entryTrim,
      editingEntryNumber: entryNumber,
      rosterSlots,
      lateSwapWindowOpen: resolved.lateSwapWindowOpen,
      lateSwapEnabled: resolved.lateSwapEnabled,
    };

    const payEntryBlockedBanner = null;

    return (
      <div className="space-y-0">
        <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
          <p className="text-base font-semibold text-slate-100 sm:text-lg">Daily Fantasy Golf</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Lineup</h1>
          <p className="mt-3 rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100">
            Automatic protection applies if any roster golfer WD/DNS/DQ — no manual pick.
          </p>
          {entryNumber > 0 ? (
            <p className="mt-2 rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100">
              Editing Entry #{entryNumber}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-[#c5cdd5]">
            {resolved.name}
          </p>
        </div>
        <LineupBuilder
          editMode={editMode}
          contestId={resolved.id}
          contestName={resolved.name}
          entryFeeLabel={resolved.entryFeeLabel}
          entryFeeUsd={resolved.entryFeeUsd}
          protectionFeeUsd={CASHCADDIE_PROTECTION_FEE_USD}
          contestLineupLocked={resolved.lineupLocked}
          payEntryBlockedBanner={payEntryBlockedBanner}
        />
      </div>
    );
  }

  const resolved = await loadContestForLineupPage(contest);
  const payEntryBlockedBanner = await payEntryBannerForContest(resolved.id);
  const latestDraft =
    resolved.id !== "default" ? await loadLatestDraftLineupForContest(resolved.id) : { status: "not_found" as const };
  const editMode = latestDraft.status === "ok" ? latestDraft.data : null;

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-base font-semibold text-slate-100 sm:text-lg">Daily Fantasy Golf</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Lineup</h1>
        <p className="mt-3 rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100">
          Automatic protection applies if any roster golfer WD/DNS/DQ — no manual pick.
        </p>
        <p className="mt-1">
          <Link
            href="/faq#fantasy-golf-basics"
            className="text-sm text-slate-400 transition-colors hover:text-emerald-400 hover:underline"
          >
            New to DFS Golf? Learn the basics
          </Link>
        </p>
        <p className="mt-1 text-sm text-[#c5cdd5]">
          Pick 6 golfers · $50,000 salary cap · Your roster saves to Supabase
        </p>
      </div>
      <LineupBuilder
        editMode={editMode}
        contestId={resolved.id}
        contestName={resolved.name}
        entryFeeLabel={resolved.entryFeeLabel}
        entryFeeUsd={resolved.entryFeeUsd}
        protectionFeeUsd={CASHCADDIE_PROTECTION_FEE_USD}
        contestLineupLocked={resolved.lineupLocked}
        payEntryBlockedBanner={payEntryBlockedBanner}
      />
    </div>
  );
}
