import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function titleFromMessage(message: string | null | undefined): string {
  if (!message?.trim()) return "Update";
  const line = message.split("\n")[0]?.trim() ?? "";
  if (!line) return "Update";
  return line.length > 80 ? `${line.slice(0, 77)}…` : line;
}

function formatPct(clicks: number, rate: number): string {
  if (clicks <= 0 || !Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCtr(impressions: number, clicks: number): string {
  if (impressions <= 0 || !Number.isFinite(clicks)) return "—";
  return `${((clicks / impressions) * 100).toFixed(1)}%`;
}

export default async function UpdatePerformancePage() {
  await requireUser();
  await requireAdmin();

  const admin = createServiceRoleClient();
  if (!admin) {
    return (
      <div className="border border-[#2a3039] bg-[#0f1419] px-4 py-8 text-sm text-amber-200 sm:px-6">
        Server configuration error (missing service role client).
      </div>
    );
  }

  const { data: updates, error: updatesError } = await admin
    .from("founder_updates")
    .select("id, message, created_at")
    .order("created_at", { ascending: false });

  // Aggregates run in Postgres (views); supabase-js has no .group() on .from().select().
  const { data: clickCounts } = await admin.from("update_cta_click_counts").select("update_id, click_count");
  const { data: conversionCounts } = await admin.from("update_conversion_counts").select("update_id, conversion_count");
  const { data: impressionCounts } = await admin.from("update_impression_counts").select("update_id, impression_count");

  const { data: clickCounts7d } = await admin.from("update_cta_click_counts_7d").select("update_id, click_count_7d");
  const { data: conversionCounts7d } = await admin.from("update_conversion_counts_7d").select("update_id, conversion_count_7d");
  const { data: impressionCounts7d } = await admin.from("update_impression_counts_7d").select("update_id, impression_count_7d");

  const clicksMap = new Map<string, number>();
  clickCounts?.forEach((row) => {
    const id = row.update_id as string | null | undefined;
    if (!id) return;
    clicksMap.set(id, Number(row.click_count ?? 0));
  });

  const conversionsMap = new Map<string, number>();
  conversionCounts?.forEach((row) => {
    const id = row.update_id as string | null | undefined;
    if (!id) return;
    conversionsMap.set(id, Number(row.conversion_count ?? 0));
  });

  const impressionsMap = new Map<string, number>();
  impressionCounts?.forEach((row) => {
    const id = row.update_id as string | null | undefined;
    if (!id) return;
    impressionsMap.set(id, Number(row.impression_count ?? 0));
  });

  const clicks7dMap = new Map<string, number>();
  clickCounts7d?.forEach((row) => {
    const id = row.update_id as string | null | undefined;
    if (!id) return;
    clicks7dMap.set(id, Number(row.click_count_7d ?? 0));
  });

  const conversions7dMap = new Map<string, number>();
  conversionCounts7d?.forEach((row) => {
    const id = row.update_id as string | null | undefined;
    if (!id) return;
    conversions7dMap.set(id, Number(row.conversion_count_7d ?? 0));
  });

  const impressions7dMap = new Map<string, number>();
  impressionCounts7d?.forEach((row) => {
    const id = row.update_id as string | null | undefined;
    if (!id) return;
    impressions7dMap.set(id, Number(row.impression_count_7d ?? 0));
  });

  type Row = {
    id: string;
    title: string;
    createdAt: string | null;
    impressions: number;
    clicks: number;
    signups: number;
    rate: number;
    score: number;
    impressions7d: number;
    clicks7d: number;
    signups7d: number;
    score7d: number;
    trend: number;
  };

  const rows: Row[] = (updates ?? []).map((u) => {
    const row = u as { id: string; message?: string | null; created_at?: string | null };
    const id = String(row.id);
    const impressions = impressionsMap.get(id) ?? 0;
    const clicks = clicksMap.get(id) ?? 0;
    const signups = conversionsMap.get(id) ?? 0;
    const rate = clicks > 0 ? signups / clicks : 0;
    const score = impressions > 0 ? (signups / impressions) * 1000 : 0;

    const impressions7d = impressions7dMap.get(id) ?? 0;
    const clicks7d = clicks7dMap.get(id) ?? 0;
    const signups7d = conversions7dMap.get(id) ?? 0;
    const score7d = impressions7d > 0 ? (signups7d / impressions7d) * 1000 : 0;

    const trend = score > 0 ? (score7d - score) / score : 0;

    return {
      id,
      title: titleFromMessage(row.message),
      createdAt: row.created_at ?? null,
      impressions,
      clicks,
      signups,
      rate,
      score,
      impressions7d,
      clicks7d,
      signups7d,
      score7d,
      trend,
    };
  });

  let bestId: string | null = null;
  let bestScore7d = -1;
  for (const r of rows) {
    if (r.impressions7d <= 0) continue;
    if (r.score7d > bestScore7d) {
      bestScore7d = r.score7d;
      bestId = r.id;
    }
  }
  if (bestScore7d <= 0) {
    bestId = null;
  }

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Update performance</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8b98a5]">
          Lifetime and rolling 7-day impressions, clicks, conversions, and scores per founder update.{" "}
          <Link href="/admin/stats" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            Back to Stats
          </Link>
          {" · "}
          <Link href="/admin" className="font-medium text-emerald-400/90 underline hover:text-emerald-300">
            Admin home
          </Link>
        </p>
      </div>

      <div className="border-x border-b border-[#2a3039] bg-[#0f1419] px-4 py-6 sm:px-8">
        {updatesError ? (
          <p className="text-sm text-amber-200">Could not load updates: {updatesError.message}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#8b98a5]">No founder updates yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a3039] text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">
                  <th className="pb-3 pr-4">Title</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">Impressions</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">Clicks</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">CTR</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">Signups</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">Conversion</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">Score</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">7D Impressions</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">7D Clicks</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">7D Signups</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">7D Score</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">Trend</th>
                  <th className="pb-3 pl-2">Actions</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {rows.map((r) => {
                  const isBest = bestId != null && r.id === bestId;
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-[#2a3039]/80 ${
                        isBest ? "bg-emerald-950/35 ring-1 ring-inset ring-emerald-500/25" : ""
                      }`}
                    >
                      <td className="py-3 pr-4 font-medium text-white">
                        {r.title}
                        {isBest ? (
                          <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                            Top Performing (7D)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-[#8b98a5]">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.impressions}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.clicks}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-300">
                        {formatCtr(r.impressions, r.clicks)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.signups}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-300">{formatPct(r.clicks, r.rate)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-300">{r.score.toFixed(2)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.impressions7d}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.clicks7d}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.signups7d}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-300">{r.score7d.toFixed(2)}</td>
                      <td
                        className={`py-3 pr-4 text-right tabular-nums ${
                          r.trend > 0 ? "text-green-400" : r.trend < 0 ? "text-red-400" : "text-gray-400"
                        }`}
                      >
                        {r.trend > 0 ? "+" : ""}
                        {(r.trend * 100).toFixed(1)}%
                      </td>
                      <td className="flex gap-2 py-3 pl-2">
                        <a
                          href={`/admin/update-performance?focus=${encodeURIComponent(r.id)}`}
                          className="text-blue-400 hover:underline"
                        >
                          View
                        </a>
                        <a
                          href={`/admin/update-performance?focus=${encodeURIComponent(r.id)}&edit=1`}
                          className="text-yellow-400 hover:underline"
                        >
                          Edit
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
