import Link from "next/link";
import { notFound } from "next/navigation";
import { EnterContestWithSavedLineup } from "@/components/enter-contest-saved";
import { fetchDraftLineupsForContest } from "@/lib/contest-enter";
import { getPayEntryBlockedBannerForUser } from "@/lib/contest-entry-eligibility";
import { loadContestForLineupPage } from "@/lib/contest-resolve";
import { tierFromPoints, type TierName } from "@/lib/loyalty";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ contestId: string }>;
};

export default async function EnterContestPage(props: PageProps) {
  const { contestId: raw } = await props.params;
  const contestId = raw?.trim() ?? "";
  if (!contestId || contestId === "default") {
    notFound();
  }

  const contest = await loadContestForLineupPage(contestId);
  const { lineups: drafts, error: draftsError } = await fetchDraftLineupsForContest(contestId);

  let tier: TierName = "Bronze";
  let payEntryBlockedBanner: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("loyalty_points")
        .eq("id", user.id)
        .maybeSingle();
      tier = tierFromPoints(Number(prof?.loyalty_points ?? 0));
      if (!contest.lineupLocked) {
        payEntryBlockedBanner = await getPayEntryBlockedBannerForUser(supabase, {
          contestId,
          userId: user.id,
        });
      }
    }
  } catch {
    tier = "Bronze";
    payEntryBlockedBanner = null;
  }

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Enter contest</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            <Link
              href={`/contest/${encodeURIComponent(contestId)}`}
              className="text-white hover:text-[#7ab8ff] hover:underline"
            >
              {contest.name}
            </Link>
          </h1>
          {contest.lineupLocked ? (
            <span className="rounded border border-red-500/50 bg-red-950/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200">
              LIVE
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-[#c5cdd5]">
          Entry fee {contest.entryFeeLabel} · Required: select one Safety Coverage golfer (WD/DNS/DQ)
          {!contest.lineupLocked ? (
            <>
              {" "}
              · Or{" "}
              <Link href={`/lineup?contest=${encodeURIComponent(contestId)}`} className="text-[#53d769] underline">
                build a new lineup
              </Link>
            </>
          ) : null}
        </p>
        {contest.lineupLocked ? (
          <p className="mt-3 rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100">
            Contest started — lineups locked
          </p>
        ) : null}
        {payEntryBlockedBanner && !contest.lineupLocked ? (
          <p
            className="mt-3 rounded border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-100"
            role="alert"
          >
            {payEntryBlockedBanner}
          </p>
        ) : null}
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-6 sm:px-8">
        {draftsError && (
          <p className="mb-4 rounded border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            {draftsError}
          </p>
        )}

        {drafts.length === 0 && !draftsError && (
          <div className="rounded-lg border border-[#2a3039] bg-[#141920] px-5 py-8 text-center">
            <p className="text-[#c5cdd5]">No saved lineups for this contest yet.</p>
            <p className="mt-2 text-sm text-[#6b7684]">
              {contest.lineupLocked
                ? "This contest has started; new lineups cannot be built."
                : (
                    <>
                      Build a roster on the lineup page, click <span className="text-[#8b98a5]">Save draft</span>, then
                      return here to enter.
                    </>
                  )}
            </p>
            {contest.lineupLocked ? (
              <p className="mt-5 text-sm font-medium text-amber-100">Contest started — lineups locked</p>
            ) : (
              <Link
                href={`/lineup?contest=${encodeURIComponent(contestId)}`}
                className="mt-5 inline-flex items-center justify-center rounded border border-[#2d7a3a] bg-[#1f8a3b] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-[#249544]"
              >
                Build lineup
              </Link>
            )}
          </div>
        )}

        {drafts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#8b98a5]">Saved lineups</h2>
            <ul className="divide-y divide-[#232a33] rounded-lg border border-[#2a3039] bg-[#141920]">
              {drafts.map((d) => (
                <li key={d.id} className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-[#8b98a5]">
                      Saved{" "}
                      {new Date(d.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <p className="mt-1 text-sm text-[#c5cdd5]">
                      Salary ${d.total_salary.toLocaleString()}
                      {d.protection_enabled ? (
                        <span className="ml-2 text-[#6b7684]">· Draft had protection flags (you can change below)</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-[#6b7684]">{d.golfer_names.join(", ")}</p>
                  </div>
                  <EnterContestWithSavedLineup
                    contestId={contestId}
                    lineupId={d.id}
                    players={d.players}
                    tier={tier}
                    entryFeeUsd={contest.entryFeeUsd}
                    lineupLocked={contest.lineupLocked}
                    payEntryBlockedBanner={payEntryBlockedBanner}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#141920] px-5 py-3 text-center text-xs text-[#6b7684]">
        <Link href={`/contest/${encodeURIComponent(contestId)}`} className="text-[#8b98a5] underline hover:text-[#c5cdd5]">
          Contest leaderboard
        </Link>
        {" · "}
        <Link href="/lobby" className="text-[#8b98a5] underline hover:text-[#c5cdd5]">
          Lobby
        </Link>
      </div>
    </div>
  );
}
