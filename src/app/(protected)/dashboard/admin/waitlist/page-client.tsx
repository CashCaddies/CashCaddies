"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  listWaitlistRequestsForAdmin,
  reviewWaitlistRequest,
  type WaitlistRequestRow,
} from "@/app/(protected)/admin/waitlist-request-actions";
import { processWaitlistSignup } from "@/app/(protected)/admin/user-actions";
import { useAuth } from "@/contexts/auth-context";
import { getProfileByUserId } from "@/lib/getProfile";
import { hasPermission } from "@/lib/permissions";
import { supabase } from "@/lib/supabase/client";

type SignupRow = {
  id: string;
  email: string;
  username: string;
  source: string;
  status: string;
  created_at: string;
};

type FilterTab = "active" | "processed";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved") return "border-emerald-500/45 bg-emerald-950/50 text-emerald-200";
  if (s === "removed") return "border-slate-600 bg-slate-900/80 text-slate-400";
  if (s === "kept_waiting") return "border-amber-500/45 bg-amber-950/40 text-amber-100";
  return "border-sky-500/40 bg-sky-950/35 text-sky-200";
}

function inAppStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved") return "border-emerald-500/45 bg-emerald-950/50 text-emerald-200";
  if (s === "rejected") return "border-red-500/45 bg-red-950/50 text-red-200";
  return "border-amber-500/45 bg-amber-950/45 text-amber-100";
}

function formatStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "pending") return "Pending";
  if (s === "approved") return "Approved";
  if (s === "rejected") return "Rejected";
  return status.replace(/_/g, " ");
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "emerald" | "rose";
}) {
  const tones = {
    amber: "border-amber-500/30 bg-amber-950/25 text-amber-100 ring-1 ring-amber-500/15",
    emerald: "border-emerald-500/30 bg-emerald-950/25 text-emerald-100 ring-1 ring-emerald-500/15",
    rose: "border-red-500/30 bg-red-950/25 text-red-100 ring-1 ring-red-500/15",
  } as const;
  const nums = {
    amber: "text-amber-200",
    emerald: "text-emerald-200",
    rose: "text-red-200",
  } as const;
  return (
    <div
      className={`flex min-w-[7.25rem] flex-col rounded-xl border px-4 py-3 text-center shadow-inner shadow-black/20 ${tones[tone]}`}
    >
      <span className={`text-2xl font-black tabular-nums tracking-tight ${nums[tone]}`}>{value}</span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
    </div>
  );
}

function AccessRequestCard({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: WaitlistRequestRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const pending = row.status.toLowerCase() === "pending";
  const msg = row.message?.trim();

  return (
    <article className="rounded-xl border border-white/[0.08] bg-slate-950/60 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition hover:border-white/[0.12]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-3 py-0.5 text-xs font-bold uppercase tracking-wide ${inAppStatusBadgeClass(row.status)}`}
            >
              {formatStatusLabel(row.status)}
            </span>
            <span className="text-xs font-medium text-slate-500">
              Requested {formatDate(row.requested_at)}
              {!pending && row.reviewed_at ? (
                <>
                  {" · "}
                  <span className="text-slate-600">Reviewed {formatDate(row.reviewed_at)}</span>
                </>
              ) : null}
            </span>
          </div>
          <div>
            <p className="truncate text-base font-semibold tracking-tight text-white">{row.email}</p>
            <p className="mt-0.5 text-sm text-slate-400">
              {row.handle ? (
                <span className="font-medium text-emerald-400/95">@{row.handle}</span>
              ) : (
                <span className="italic text-slate-500">No handle yet</span>
              )}
            </p>
          </div>
          {msg ? (
            <div className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Message</p>
              <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-slate-300">{msg}</p>
            </div>
          ) : null}
        </div>
        {pending ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:justify-end lg:w-auto lg:flex-col">
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-600/15 px-5 text-sm font-bold uppercase tracking-wide text-emerald-100 transition hover:bg-emerald-600/25 disabled:pointer-events-none disabled:opacity-45 sm:flex-none lg:min-w-[9.5rem]"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/45 bg-red-950/35 px-5 text-sm font-bold uppercase tracking-wide text-red-100 transition hover:bg-red-950/50 disabled:pointer-events-none disabled:opacity-45 sm:flex-none lg:min-w-[9.5rem]"
            >
              Reject
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function WaitlistManagerPage() {
  const { user, isReady } = useAuth();
  const [role, setRole] = useState<string>("");
  const [roleLoading, setRoleLoading] = useState(true);
  const [rows, setRows] = useState<SignupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("active");
  const [, startTransition] = useTransition();

  const [inAppRows, setInAppRows] = useState<WaitlistRequestRow[]>([]);
  const [inAppLoading, setInAppLoading] = useState(true);
  const [inAppError, setInAppError] = useState<string | null>(null);
  const [inAppBusyId, setInAppBusyId] = useState<string | null>(null);

  const canManage = useMemo(() => hasPermission(role, "approve_beta"), [role]);

  const loadInApp = useCallback(async () => {
    if (!canManage) {
      setInAppRows([]);
      setInAppLoading(false);
      return;
    }
    setInAppLoading(true);
    const res = await listWaitlistRequestsForAdmin();
    setInAppLoading(false);
    if (!res.ok) {
      setInAppRows([]);
      setInAppError(res.error);
      return;
    }
    setInAppRows(res.rows);
    setInAppError(null);
  }, [canManage]);

  const loadRows = useCallback(async () => {
    if (!supabase || !canManage) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: qErr } = await supabase
      .from("waitlist_signups")
      .select("id,email,username,source,status,created_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (qErr) {
      setRows([]);
      setError(qErr.message);
      return;
    }
    const mapped = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id ?? ""),
      email: typeof r.email === "string" ? r.email : "",
      username: typeof r.username === "string" ? r.username : "",
      source: typeof r.source === "string" ? r.source : "",
      status: typeof r.status === "string" ? r.status : "",
      created_at: typeof r.created_at === "string" ? r.created_at : "",
    }));
    setRows(mapped);
    setError(null);
  }, [canManage]);

  useEffect(() => {
    if (!isReady) return;
    if (!supabase) {
      setRoleLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) {
        if (!cancelled) {
          setRole("");
          setRoleLoading(false);
        }
        return;
      }
      const profile = await getProfileByUserId(u.id);
      if (!cancelled) {
        setRole(profile?.role ?? "");
        setRoleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady]);

  useEffect(() => {
    if (!isReady || roleLoading || !user || !canManage) {
      if (isReady && !roleLoading && user && !canManage) setLoading(false);
      return;
    }
    void loadRows();
    void loadInApp();
  }, [canManage, isReady, loadInApp, loadRows, roleLoading, user]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const inAppStats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const r of inAppRows) {
      const s = r.status.toLowerCase();
      if (s === "pending") pending += 1;
      else if (s === "approved") approved += 1;
      else if (s === "rejected") rejected += 1;
    }
    return { pending, approved, rejected };
  }, [inAppRows]);

  const pendingRequests = useMemo(
    () => inAppRows.filter((r) => r.status.toLowerCase() === "pending"),
    [inAppRows],
  );

  const historyRequests = useMemo(() => {
    return inAppRows
      .filter((r) => r.status.toLowerCase() !== "pending")
      .sort((a, b) => {
        const ta = new Date(a.reviewed_at ?? a.requested_at).getTime();
        const tb = new Date(b.reviewed_at ?? b.requested_at).getTime();
        return tb - ta;
      });
  }, [inAppRows]);

  const visibleRows = useMemo(() => {
    if (filter === "active") {
      return rows.filter((r) => r.status === "pending" || r.status === "kept_waiting");
    }
    return rows.filter((r) => r.status === "approved" || r.status === "removed");
  }, [rows, filter]);

  function runAction(id: string, kind: "approve" | "keep_waiting" | "remove") {
    setBusyId(id);
    startTransition(() => {
      void (async () => {
        const res = await processWaitlistSignup(id, kind);
        setBusyId(null);
        if (!res.ok) {
          setToast(`Error: ${res.error}`);
          return;
        }
        setToast(res.detail ?? "Updated.");
        await loadRows();
      })();
    });
  }

  function runInAppReview(id: string, decision: "approve" | "reject") {
    setInAppBusyId(id);
    startTransition(() => {
      void (async () => {
        const res = await reviewWaitlistRequest(id, decision);
        setInAppBusyId(null);
        if (!res.ok) {
          setToast(`Error: ${res.error}`);
          return;
        }
        setToast(decision === "approve" ? "Approved — user has beta access." : "Request rejected.");
        await loadInApp();
      })();
    });
  }

  if (!isReady || roleLoading) {
    return (
      <div className="pageWrap flex min-h-[40vh] items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500/80" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return (
      <p className="pageWrap py-12 text-center text-slate-300">
        <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
          Sign in
        </Link>{" "}
        to manage access requests.
      </p>
    );
  }

  if (!canManage) {
    return (
      <div className="pageWrap py-12">
        <p className="mx-auto max-w-lg rounded-xl border border-amber-600/40 bg-amber-950/35 px-5 py-4 text-center text-sm text-amber-100">
          You do not have permission to manage access requests.
        </p>
      </div>
    );
  }

  return (
    <div className="pageWrap max-w-4xl pb-16 pt-10">
      <div className="mb-2">
        <Link
          href="/dashboard/admin"
          className="text-xs font-medium text-slate-500 transition hover:text-emerald-400/90"
        >
          ← Admin
        </Link>
      </div>

      <header className="mb-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Access Requests</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
            Review users asking for beta access. Approving unlocks their account immediately.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <StatPill label="Pending" value={inAppStats.pending} tone="amber" />
          <StatPill label="Approved" value={inAppStats.approved} tone="emerald" />
          <StatPill label="Rejected" value={inAppStats.rejected} tone="rose" />
        </div>
      </header>

      {toast ? (
        <div
          role="status"
          className="mb-6 rounded-xl border border-emerald-500/35 bg-emerald-950/40 px-4 py-3 text-sm font-medium text-emerald-100 shadow-lg shadow-emerald-950/30"
        >
          {toast}
        </div>
      ) : null}

      {error ? (
        <p className="mb-6 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</p>
      ) : null}

      {inAppError ? (
        <p className="mb-6 rounded-xl border border-amber-600/40 bg-amber-950/35 px-4 py-3 text-sm text-amber-100">
          {inAppError}
        </p>
      ) : null}

      {/* Primary: waitlist_requests */}
      <section className="goldCard goldCardStatic mb-10 p-6 sm:p-8" aria-labelledby="pending-heading">
        <div className="mb-6 flex flex-col gap-1 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="pending-heading" className="text-lg font-bold text-white">
              Pending
            </h2>
            <p className="mt-1 text-xs text-slate-500">Source: waitlist_requests</p>
          </div>
        </div>

        {inAppLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500/70" aria-hidden />
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-slate-950/40 px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-300">No pending requests</p>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-500">
              New submissions will appear here. Approved and rejected requests move to history below.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {pendingRequests.map((row) => (
              <li key={row.id}>
                <AccessRequestCard
                  row={row}
                  busy={inAppBusyId === row.id}
                  onApprove={() => runInAppReview(row.id, "approve")}
                  onReject={() => runInAppReview(row.id, "reject")}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="goldCard goldCardStatic mb-10 p-6 sm:p-8" aria-labelledby="history-heading">
        <div className="mb-6 border-b border-white/[0.06] pb-5">
          <h2 id="history-heading" className="text-lg font-bold text-white">
            History
          </h2>
          <p className="mt-1 text-xs text-slate-500">Approved and rejected access requests</p>
        </div>
        {inAppLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-slate-500" aria-hidden />
          </div>
        ) : historyRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-slate-950/40 px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-400">No history yet</p>
            <p className="mx-auto mt-2 max-w-sm text-xs text-slate-600">
              Processed requests will show here with their final status.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {historyRequests.map((row) => (
              <li key={row.id}>
                <AccessRequestCard
                  row={row}
                  busy={inAppBusyId === row.id}
                  onApprove={() => runInAppReview(row.id, "approve")}
                  onReject={() => runInAppReview(row.id, "reject")}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Legacy prelaunch — collapsed, bottom */}
      <details className="group rounded-xl border border-white/[0.06] bg-slate-950/40 open:border-amber-500/20">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-400 outline-none transition marker:content-none hover:text-slate-300 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            Legacy prelaunch signups
            <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-slate-500">
              waitlist_signups
            </span>
            <span className="text-slate-600 transition group-open:rotate-90" aria-hidden>
              ▸
            </span>
          </span>
        </summary>
        <div className="border-t border-white/[0.06] px-4 py-5">
          <p className="mb-4 text-xs text-slate-500">
            Separate from in-app access requests. Public:{" "}
            <Link href="/early-access" className="font-medium text-emerald-400/90 hover:text-emerald-300">
              /early-access
            </Link>
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("active")}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                filter === "active"
                  ? "border-sky-500/50 bg-sky-950/30 text-sky-100 ring-1 ring-sky-500/25"
                  : "border-slate-700/80 bg-slate-900/50 text-slate-400 hover:border-slate-600"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setFilter("processed")}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                filter === "processed"
                  ? "border-slate-500/50 bg-slate-800/50 text-slate-100 ring-1 ring-slate-500/25"
                  : "border-slate-700/80 bg-slate-900/50 text-slate-400 hover:border-slate-600"
              }`}
            >
              Processed
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/[0.06] bg-black/20">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 font-semibold">Created</th>
                  <th className="px-3 py-2.5 font-semibold">Email</th>
                  <th className="px-3 py-2.5 font-semibold">Username</th>
                  <th className="px-3 py-2.5 font-semibold">Source</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden />
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-500">
                      No rows in this view.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => {
                    const busy = busyId === row.id;
                    const canAct = row.status === "pending" || row.status === "kept_waiting";
                    return (
                      <tr key={row.id} className="border-b border-white/[0.04] last:border-0">
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-400">{formatDate(row.created_at)}</td>
                        <td className="max-w-[10rem] truncate px-3 py-2.5 text-slate-200">{row.email}</td>
                        <td className="px-3 py-2.5 text-slate-300">{row.username ? `@${row.username}` : "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{row.source}</td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(row.status)}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {canAct ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runAction(row.id, "approve")}
                                  className="rounded-md border border-emerald-600/50 bg-emerald-950/40 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-950/60 disabled:opacity-50"
                                >
                                  {busy ? <Loader2 className="inline h-3 w-3 animate-spin" aria-hidden /> : null}
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runAction(row.id, "keep_waiting")}
                                  className="rounded-md border border-amber-600/45 bg-amber-950/35 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-100 hover:bg-amber-950/55 disabled:opacity-50"
                                >
                                  Keep
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runAction(row.id, "remove")}
                                  className="rounded-md border border-red-600/45 bg-red-950/35 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-red-100 hover:bg-red-950/55 disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-600">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  );
}
