import Link from "next/link";
import { AdminInsuranceForm } from "@/components/admin-insurance-form";
import { AdminProtectionEngineForm } from "@/components/admin-protection-engine-form";
import { AdminSettlementForm } from "@/components/admin-settlement-form";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSettlementPage() {
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

  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasAdminSecret = Boolean(process.env.ADMIN_SCORING_SECRET);

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Contest settlement</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8b98a5]">
          After the contest window ends, distributes the prize pool from{" "}
          <span className="text-[#c5cdd5]">contest_payouts</span> (rank → % of pool) to finishers. The distributable pool
          is <span className="text-[#c5cdd5]">90%</span> of collected entry fees (
          <span className="font-mono text-[#c5cdd5]">settle_contest_prizes</span>). Finishers are ordered by entry time (
          <span className="text-[#c5cdd5]">contest_entries.created_at</span> asc, then id), matching the public contest
          leaderboard. Eligible when{" "}
          <span className="font-mono text-[#c5cdd5]">now() &gt;= starts_at + 3 days</span>. Each contest settles at
          most once (<span className="text-[#c5cdd5]">contest_settlements</span>).{" "}
          <Link href="/admin/scoring" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            Scoring input
          </Link>
        </p>
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-6 sm:px-8">
        {!hasServiceKey && (
          <p className="mb-4 rounded border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Set <code className="rounded bg-black/30 px-1">SUPABASE_SERVICE_ROLE_KEY</code> so settlement can credit
            wallets and write the ledger.
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
            <h2 className="text-lg font-semibold text-white">Prize settlement</h2>
            <p className="mb-4 text-sm text-[#8b98a5]">
              Leaderboard prizes (<span className="text-[#c5cdd5]">settle_contest_prizes</span>). Run after the 3-day
              window.
            </p>
            <AdminSettlementForm contests={contests} />
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
          Apply migrations{" "}
          <code className="rounded bg-black/30 px-1">047_contest_payout_settlement.sql</code> (prizes) and{" "}
          <code className="rounded bg-black/30 px-1">048_contest_insurance_engine.sql</code> (insurance RPC).
        </p>
      </div>
    </div>
  );
}
