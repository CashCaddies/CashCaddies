"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { processWaitlistSignup } from "@/app/admin/user-actions";
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
  if (!value) return "â€”";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "â€”";
  return d.toLocaleString();
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "approved") return "border-emerald-500/40 bg-emerald-950/40 text-emerald-200";
  if (s === "removed") return "border-slate-600 bg-slate-900 text-slate-400";
  if (s === "kept_waiting") return "border-amber-500/40 bg-amber-950/35 text-amber-100";
  return "border-sky-500/40 bg-sky-950/35 text-sky-200";
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

  const canManage = useMemo(() => hasPermission(role, "approve_beta"), [role]);

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
  }, [canManage, isReady, loadRows, roleLoading, user]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

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

  if (!isReady || roleLoading) {
    return <p className="pageWrap py-8 text-slate-400">Loadingâ€¦</p>;
  }

  if (!user) {
    return (
      <p className="pageWrap py-8 text-slate-300">
        <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
          Sign in
        </Link>{" "}
        to manage the waitlist.
      </p>
    );
  }

  if (!canManage) {
    return (
      <p className="pageWrap rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-200">
        You do not have permission to manage waitlist signups.
      </p>
    );
  }

  return (
    <div className="pageWrap py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Link href="/dashboard/admin" className="text-emerald-400/90 hover:text-emerald-300">
            Admin Panel
          </Link>
          <span className="mx-2 text-slate-600">/</span>
          Waitlist manager
        </p>
        <h1 className="mt-1 text-2xl font-bold text-white">Waitlist manager</h1>
        <p className="mt-1 text-sm text-slate-400">
          Prelaunch signups from <span className="font-mono text-slate-300">/early-access</span>. Approve grants beta if an
          account exists for the email (respects capacity). Keep waiting or remove to triage.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Public signup:{" "}
          <Link href="/early-access" className="text-emerald-400 hover:text-emerald-300">
            /early-access
          </Link>
        </p>
      </div>

      {toast ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-100"
        >
          {toast}
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("active")}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            filter === "active"
              ? "border-sky-500/50 bg-sky-950/30 text-sky-100 ring-1 ring-sky-500/30"
              : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600"
          }`}
        >
          Active (pending / keep waiting)
        </button>
        <button
          type="button"
          onClick={() => setFilter("processed")}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
            filter === "processed"
              ? "border-slate-500/50 bg-slate-800/50 text-slate-100 ring-1 ring-slate-500/30"
              : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600"
          }`}
        >
          Processed (approved / removed)
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Username</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" aria-hidden />
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No signups in this view.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const busy = busyId === row.id;
                const canAct = row.status === "pending" || row.status === "kept_waiting";
                return (
                  <tr key={row.id} className="border-b border-slate-800/80">
                    <td className="px-4 py-3 text-slate-400">{formatDate(row.created_at)}</td>
                    <td className="max-w-[14rem] truncate px-4 py-3 text-slate-200">{row.email}</td>
                    <td className="px-4 py-3 text-slate-200">{row.username ? `@${row.username}` : "â€”"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{row.source}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canAct ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => runAction(row.id, "approve")}
                              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-600/50 bg-emerald-950/50 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-950/70 disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => runAction(row.id, "keep_waiting")}
                              className="rounded-md border border-amber-600/45 bg-amber-950/40 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
                            >
                              Keep waiting
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => runAction(row.id, "remove")}
                              className="rounded-md border border-red-600/45 bg-red-950/40 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-red-100 hover:bg-red-950/60 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-600">â€”</span>
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
  );
}
