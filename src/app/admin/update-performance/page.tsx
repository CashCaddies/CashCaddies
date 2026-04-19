import Link from "next/link";
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

export default async function UpdatePerformancePage() {
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

  type Row = {
    id: string;
    title: string;
    createdAt: string | null;
    clicks: number;
    signups: number;
    rate: number;
  };

  const rows: Row[] = (updates ?? []).map((u) => {
    const row = u as { id: string; message?: string | null; created_at?: string | null };
    const id = String(row.id);
    const clicks = clicksMap.get(id) ?? 0;
    const signups = conversionsMap.get(id) ?? 0;
    const rate = clicks > 0 ? signups / clicks : 0;
    return {
      id,
      title: titleFromMessage(row.message),
      createdAt: row.created_at ?? null,
      clicks,
      signups,
      rate,
    };
  });

  let bestId: string | null = null;
  let bestRate = -1;
  for (const r of rows) {
    if (r.clicks > 0 && r.rate > bestRate) {
      bestRate = r.rate;
      bestId = r.id;
    }
  }

  return (
    <div className="space-y-0">
      <div className="border-b border-[#2a3039] bg-[#141920] px-4 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8b98a5]">Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Update performance</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#8b98a5]">
          CTA clicks and signup conversions per founder update.{" "}
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
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a3039] text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">
                  <th className="pb-3 pr-4">Title</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">Clicks</th>
                  <th className="pb-3 pr-4 text-right tabular-nums">Signups</th>
                  <th className="pb-3 text-right tabular-nums">Conversion</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {rows.map((r) => {
                  const isBest = bestId != null && r.id === bestId && r.clicks > 0;
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
                            Best
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
                      <td className="py-3 pr-4 text-right tabular-nums">{r.clicks}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.signups}</td>
                      <td className="py-3 text-right tabular-nums text-slate-300">{formatPct(r.clicks, r.rate)}</td>
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
