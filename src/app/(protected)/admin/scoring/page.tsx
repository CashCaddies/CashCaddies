import Link from "next/link";
import { AdminScoringForm } from "@/components/admin-scoring-form";
import { requireUser } from "@/lib/auth/require-user";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export default async function AdminScoringPage() {
  await requireUser();
  await requireAdmin();

  let golfers: { id: string; name: string; fantasy_points: number }[] = [];
  let loadError: string | null = null;

  const admin = createServiceRoleClient();

  try {
    const { data, error } = admin
      ? await admin.from("golfers").select("id,name,fantasy_points").order("name")
      : { data: null, error: { message: "Server role is not configured." } as { message: string } };
    if (error) {
      loadError = error.message;
    } else {
      golfers = (data ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        fantasy_points: Number(g.fantasy_points ?? 0),
      }));
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load golfers.";
  }

  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasAdminSecret = Boolean(process.env.ADMIN_SCORING_SECRET);
  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Scoring input</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8b98a5]">
          Enter birdie / par / bogey counts per golfer. We compute DFS fantasy points (see{" "}
          <span className="text-[#c5cdd5]">src/lib/scoring.ts</span>) and store the total on{" "}
          <span className="text-[#c5cdd5]">golfers.fantasy_points</span>. Contest scoring uses{" "}
          <span className="text-[#c5cdd5]">golfer_scores</span> per contest; use contest leaderboard simulate for testing.
          {" "}
          <Link href="/admin/settlement" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            Contest settlement
          </Link>{" "}
          distributes prizes after the contest window.{" "}
          <Link href="/admin/payout-history" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            View Payouts
          </Link>{" "}
          for per-entry payout history.
        </p>
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-6 sm:px-8">
        {!hasServiceKey && (
          <p className="mb-4 rounded border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Set <code className="rounded bg-black/30 px-1">SUPABASE_SERVICE_ROLE_KEY</code> on the server so saves can
            update golfer scores (RLS-safe).
          </p>
        )}
        {!hasAdminSecret && (
          <p className="mb-4 rounded border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            Set <code className="rounded bg-black/30 px-1">ADMIN_SCORING_SECRET</code> and enter it below to authorize
            saves.
          </p>
        )}
        {loadError && (
          <p className="mb-4 rounded border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {loadError}
            {loadError.includes("fantasy_points") ? (
              <>
                {" "}
                Run migration <code className="rounded bg-black/30 px-1">004_golfers_fantasy_points_and_leaderboard.sql</code>.
              </>
            ) : null}
          </p>
        )}
        {golfers.length > 0 ? (
          <AdminScoringForm golfers={golfers} />
        ) : !loadError ? (
          <p className="text-[#6b7684]">No golfers in the database.</p>
        ) : null}
      </div>
    </div>
  );
}
