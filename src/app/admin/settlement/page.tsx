import Link from "next/link";
import { Suspense } from "react";
import { AdminInsuranceForm } from "@/components/admin-insurance-form";
import { AdminPayoutHistoryTable } from "@/components/admin-payout-history";
import { AdminProtectionEngineForm } from "@/components/admin-protection-engine-form";
import { AdminSettlementForm } from "@/components/admin-settlement-form";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{ payout?: string }>;
};

export default async function AdminSettlementPage({ searchParams }: PageProps) {
  let contests: { id: string; name: string }[] = [];
  let loadError: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("contests").select("id, name").order("starts_at", { ascending: false });
    if (error) {
      loadError = error.message;
    } else {
      contests = (data ?? []).map((c) => ({ id: c.id, name: c.name }));
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load contests.";
  }

  const sp = await searchParams;
  const payoutContestId = typeof sp.payout === "string" ? sp.payout.trim() : "";

  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasAdminSecret = Boolean(process.env.ADMIN_SCORING_SECRET);

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Contest settlement</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8b98a5]">
          Accounting step only: <span className="font-mono text-[#c5cdd5]">settle_contest_prizes</span> writes one row to{" "}
          <span className="text-[#c5cdd5]">contest_settlements</span> (prize pool ={" "}
          <span className="text-[#c5cdd5]">90%</span> of sum of entry fees on{" "}
          <span className="text-[#c5cdd5]">contest_entries</span>). No per-user payouts or wallet credits in this phase.
          Each contest can be settled at most once.{" "}
          <Link href="/admin/scoring" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            Scoring input
          </Link>
          {" · "}
          <Link
            href={
              payoutContestId
                ? `/admin/payout-history?contestId=${encodeURIComponent(payoutContestId)}`
                : "/admin/payout-history"
            }
            className="font-medium text-emerald-400/90 underline hover:text-emerald-300"
          >
            View Payouts
          </Link>
        </p>
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-6 sm:px-8">
        {!hasServiceKey && (
          <p className="mb-4 rounded border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Set <code className="rounded bg-black/30 px-1">SUPABASE_SERVICE_ROLE_KEY</code> so the settlement RPC can run
            and contests can be marked settled.
          </p>
        )}
        {!hasAdminSecret && (
          <p className="mb-4 rounded border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Set <code className="rounded bg-black/30 px-1">ADMIN_SCORING_SECRET</code> and enter it below to authorize
            settlement.
          </p>
        )}
        {loadError && (
          <p className="mb-4 rounded border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {loadError}
          </p>
        )}
        {contests.length > 0 ? (
          <>
            <h2 className="text-lg font-semibold text-white">Contest settlement</h2>
            <p className="mb-4 text-sm text-[#8b98a5]">
              Records <span className="font-mono text-[#c5cdd5]">contest_settlements</span> via{" "}
              <span className="font-mono text-[#c5cdd5]">settle_contest_prizes</span> (contest status should be{" "}
              <span className="text-[#c5cdd5]">complete</span>).
            </p>
            <AdminSettlementForm contests={contests} />
            <hr className="my-10 border-[#2a3039]" />
            <h2 className="text-lg font-semibold text-white">Payout history</h2>
            <p className="mb-4 max-w-2xl text-sm text-[#8b98a5]">
              Read-only rows from <span className="font-mono text-[#c5cdd5]">contest_entry_results</span> (written by{" "}
              <span className="font-mono text-[#c5cdd5]">run_contest_payouts</span>). Choose a contest and submit to load.
            </p>
            <form method="get" className="mb-6 flex max-w-lg flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <label htmlFor="payout" className="block text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">
                  Contest
                </label>
                <select
                  id="payout"
                  name="payout"
                  defaultValue={payoutContestId || ""}
                  className="mt-1 w-full rounded-lg border border-[#2a3039] bg-[#0f1419] px-3 py-2 text-sm text-white"
                >
                  <option value="">Choose contest…</option>
                  {contests.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-lg border border-[#2a3039] bg-[#141920] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a222c]"
              >
                Show history
              </button>
            </form>
            {payoutContestId ? (
              <Suspense
                fallback={
                  <p className="text-sm text-[#8b98a5]">Loading payout history…</p>
                }
              >
                <AdminPayoutHistoryTable contestId={payoutContestId} />
              </Suspense>
            ) : (
              <p className="text-sm text-[#6b7684]">Select a contest to view payout lines.</p>
            )}
            <hr className="my-10 border-[#2a3039]" />
            <h2 className="text-lg font-semibold text-white">Contest insurance</h2>
            <p className="mb-4 max-w-2xl text-sm text-[#8b98a5]">
              Automatic credits from <span className="text-[#c5cdd5]">contest_insurance</span>:{" "}
              <span className="text-[#c5cdd5]">WD protection</span> (protected golfer{" "}
              <span className="font-mono text-[#c5cdd5]">withdrawn</span>),{" "}
              <span className="text-[#c5cdd5]">missed cut</span> (
              <span className="font-mono text-[#c5cdd5]">golfer_scores.missed_cut</span>),{" "}
              <span className="text-[#c5cdd5]">overlay</span> (pool shortfall vs guarantee). Eligible when{" "}
              <span className="font-mono text-[#c5cdd5]">now() &gt;= starts_at + 1 day</span>. Configure per contest in
              Supabase; one run per contest (<span className="text-[#c5cdd5]">contest_insurance_runs</span>).
            </p>
            <AdminInsuranceForm contests={contests} />
            <hr className="my-10 border-[#2a3039]" />
            <AdminProtectionEngineForm contests={contests} />
          </>
        ) : !loadError ? (
          <p className="text-[#6b7684]">No contests in the database.</p>
        ) : null}
        <p className="mt-8 text-xs text-[#6b7684]">
          Ensure latest Supabase migrations are applied (settlement RPC + insurance engine as needed).
        </p>
      </div>
    </div>
  );
}
