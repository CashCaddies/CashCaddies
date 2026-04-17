"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { getUserRole } from "@/lib/getUserRole";
import { isAdmin as isAdminRole } from "@/lib/permissions";
import { contestStatusBadgeClassName, contestStatusBadgeLabel } from "@/lib/contest-admin-state";
import { entryCountFromContestEntriesRelation } from "@/lib/contest-lobby-shared";
import { supabase } from "@/lib/supabase/client";
import { isMissingColumnOrSchemaError } from "@/lib/supabase-missing-column";

type ContestRow = {
  id: string;
  name: string;
  entry_fee_usd: number | string | null;
  entry_count: number | null;
  starts_at: string | null;
  start_time: string | null;
  status: string | null;
  created_by?: string | null;
};

/** Show Publish when contest is `locked` (not yet open for lobby entries). */
function canShowPublishForRow(row: ContestRow): boolean {
  const cs = String(row.status ?? "").trim().toLowerCase();
  return cs === "locked";
}

function formatMoney(n: number | string | null): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "â€”";
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function AdminContestsPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const [profileAdmin, setProfileAdmin] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [rows, setRows] = useState<ContestRow[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [listNotice, setListNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState("5");
  const [maxEntries, setMaxEntries] = useState("100");
  const [startDate, setStartDate] = useState("");
  const [contestType, setContestType] = useState("Classic");
  const [isPortal, setIsPortal] = useState(false);
  const [portalFrequency, setPortalFrequency] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [overlayAmount, setOverlayAmount] = useState("0");

  const isAdmin = profileAdmin;

  async function fetchContestsSafe(): Promise<ContestRow[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("contests")
      .select("id,name,entry_fee_usd,starts_at,start_time,status,created_at,created_by, contest_entries ( id )")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Contest fetch error:", error);
      return [];
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      entry_fee_usd: (row.entry_fee_usd as number | string | null) ?? null,
      entry_count: entryCountFromContestEntriesRelation(row),
      starts_at: typeof row.starts_at === "string" ? row.starts_at : null,
      start_time: typeof row.start_time === "string" ? row.start_time : null,
      status: row.status != null ? String(row.status) : null,
      created_by: typeof row.created_by === "string" ? row.created_by : null,
    }));
  }

  useEffect(() => {
    if (!isReady) return;
    if (!supabase || !user) {
      setLoadingPage(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const rolePromise = getUserRole(user.id);
      const contestsPromise = fetchContestsSafe();
      const [role, contests] = await Promise.all([rolePromise, contestsPromise]);

      if (cancelled) return;
      console.log("User role:", role || null);
      setProfileAdmin(isAdminRole(role));
      setRows(contests);
      setLoadingPage(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, user]);

  useEffect(() => {
    if (!listNotice) return;
    const t = window.setTimeout(() => setListNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [listNotice]);

  if (!isReady || loadingPage) {
    return <p className="text-slate-400">Loadingâ€¦</p>;
  }

  if (!user) {
    return (
      <p className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-300">
        <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
          Sign in
        </Link>{" "}
        to access admin contests.
      </p>
    );
  }

  if (!isAdmin) {
    return (
      <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-200">
        Admin access required.
      </p>
    );
  }

  const handlePublish = async (row: ContestRow) => {
    if (!supabase || !canShowPublishForRow(row)) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("contests").update({ status: "filling" }).eq("id", row.id);

      if (error) {
        console.error(error);
        alert("Publish failed");
        return;
      }

      const contests = await fetchContestsSafe();
      setRows(contests);
      setListNotice({ text: "Contest published", ok: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {listNotice ? (
        <div
          role="status"
          className={
            listNotice.ok
              ? "rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-100"
              : "rounded-lg border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
          }
        >
          {listNotice.text}
        </div>
      ) : null}
      <div className="goldCard p-6">
        <h1 className="text-2xl font-bold text-white">Create Contest</h1>
        <p className="mt-1 text-sm text-slate-400">Simple admin tool for creating lobby contests.</p>

        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage("");
            setIsError(false);
            startTransition(async () => {
              try {
                if (!supabase) {
                  setIsError(true);
                  setMessage("Supabase client is not available.");
                  return;
                }
                const {
                  data: { user: authUser },
                } = await supabase.auth.getUser();
                if (!authUser) {
                  alert("You must be logged in");
                  setIsError(true);
                  setMessage("You must be logged in.");
                  return;
                }
                const role = await getUserRole(authUser.id);
                console.log("ROLE:", role);
                if (!isAdminRole(role)) {
                  setIsError(true);
                  setMessage("Admin access required.");
                  return;
                }
                const parsedOverlayAmount = Number(overlayAmount || 0);
                if (!Number.isFinite(parsedOverlayAmount) || parsedOverlayAmount < 0) {
                  setIsError(true);
                  setMessage("Overlay amount must be 0 or greater.");
                  return;
                }

                const createdAt = new Date().toISOString();
                const payload = {
                  id: crypto.randomUUID(),
                  name,
                  start_time: new Date(startDate).toISOString(),
                  status: "locked",
                  entries_open_at: createdAt,
                  entry_count: 0,
                  created_by: authUser.id,
                  entry_fee: Number(entryFee),
                  entry_fee_usd: Number(entryFee),
                  max_entries: Number(maxEntries),
                  starts_at: new Date(startDate).toISOString(),
                  max_entries_per_user: 1,
                  created_at: createdAt,
                  is_portal: isPortal,
                  portal_frequency: isPortal ? portalFrequency : null,
                  overlay_amount: Math.round(parsedOverlayAmount * 100) / 100,
                  is_featured: isPortal,
                };

                const firstInsert = await supabase.from("contests").insert(payload).select("id").single();
                let createdContestId: string | null = null;
                if (firstInsert.error && isMissingColumnOrSchemaError(firstInsert.error)) {
                  const { created_by: _createdBy, ...fallbackPayload } = payload;
                  const fallbackInsert = await supabase
                    .from("contests")
                    .insert(fallbackPayload)
                    .select("id")
                    .single();
                  if (fallbackInsert.error) {
                    setIsError(true);
                    setMessage(fallbackInsert.error.message);
                    return;
                  }
                  createdContestId = String(fallbackInsert.data?.id ?? "");
                } else if (firstInsert.error) {
                  setIsError(true);
                  setMessage(firstInsert.error.message);
                  return;
                } else {
                  createdContestId = String(firstInsert.data?.id ?? "");
                }

                const contests = await fetchContestsSafe();
                setRows(contests);
                setIsError(false);
                setMessage("Contest created successfully.");
                if (createdContestId) {
                  router.push(`/lobby?created=${encodeURIComponent(createdContestId)}`);
                }
              } catch (e) {
                console.error(e);
                setIsError(true);
                setMessage("Failed to create contest.");
              }
            });
          }}
        >
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Contest name</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-300">Entry fee</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-300">Max entries</span>
            <input
              type="number"
              min="1"
              step="1"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={maxEntries}
              onChange={(e) => setMaxEntries(e.target.value)}
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-300">Start date</span>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-300">Contest type</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={contestType}
              onChange={(e) => setContestType(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500"
              checked={isPortal}
              onChange={(e) => setIsPortal(e.target.checked)}
            />
            <span className="text-sm text-slate-300">Portal-only contest</span>
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-300">Overlay amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              value={overlayAmount}
              onChange={(e) => setOverlayAmount(e.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm text-slate-300">Portal frequency</span>
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-50"
              value={portalFrequency}
              onChange={(e) => setPortalFrequency(e.target.value as "weekly" | "biweekly" | "monthly")}
              disabled={!isPortal}
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex rounded-md bg-emerald-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60"
            >
              {pending ? "Creating..." : "Create Contest"}
            </button>
            {message ? (
              <p className={`mt-3 text-sm ${isError ? "text-amber-200" : "text-emerald-300"}`}>{message}</p>
            ) : null}
          </div>
        </form>
      </div>

      <div className="goldCard p-6">
        <h2 className="text-lg font-bold text-white">Existing contests</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Entry fee</th>
                <th className="px-3 py-2.5">Entries</th>
                <th className="px-3 py-2.5">Start date</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(rows || []).map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 text-slate-100">{row.name}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide ${contestStatusBadgeClassName(row.status)}`}
                    >
                      {contestStatusBadgeLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-200">{formatMoney(row.entry_fee_usd)}</td>
                  <td className="px-3 py-3 text-slate-200">{Number(row.entry_count ?? 0)}</td>
                  <td className="px-3 py-3 text-slate-300">
                    {row.starts_at
                      ? new Date(row.starts_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                      : "â€”"}
                    <div className="mt-1 text-xs text-slate-500">Created by: {row.created_by || "unknown"}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-200">
                    {canShowPublishForRow(row) ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void handlePublish(row)}
                        className="inline-flex rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-60"
                      >
                        {loading ? "Publishing..." : "Publish"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={6}>
                    No contests found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

