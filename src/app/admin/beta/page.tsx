"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useWallet } from "@/hooks/use-wallet";
import { supabase } from "@/lib/supabase/client";
import { isAdmin } from "@/lib/permissions";

type BetaRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  beta_status: string | null;
};

function formatJoined(value: string | null): string {
  if (!value) return "â€”";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "â€”";
  return d.toLocaleString();
}

function statusBadgeClass(status: string | null): string {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "pending") return "bg-amber-500/20 text-amber-200 ring-amber-500/40";
  if (s === "approved") return "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40";
  if (s === "rejected") return "bg-red-500/20 text-red-200 ring-red-500/40";
  if (s === "waitlist") return "bg-sky-500/20 text-sky-200 ring-sky-500/40";
  return "bg-slate-600/30 text-slate-300 ring-slate-500/30";
}

export default function AdminBetaApprovalPage() {
  const { user, isReady } = useAuth();
  const { fullUser, loading: walletLoading } = useWallet();
  const [rows, setRows] = useState<BetaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const viewerIsAdmin = isAdmin(fullUser?.role);

  const loadRows = useCallback(async () => {
    if (!supabase) {
      setRows([]);
      setError("Supabase client is not available.");
      setLoading(false);
      return;
    }
    const { data, error: qError } = await supabase
      .from("profiles")
      .select("id,email,created_at,beta_status")
      .order("created_at", { ascending: false });
    if (qError) {
      setRows([]);
      setError(qError.message);
      setLoading(false);
      return;
    }
    const mapped = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id ?? ""),
      email: typeof r.email === "string" ? r.email : null,
      created_at: typeof r.created_at === "string" ? r.created_at : null,
      beta_status: typeof r.beta_status === "string" ? r.beta_status : null,
    }));
    setRows(mapped);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isReady || walletLoading) return;
    if (!user || !viewerIsAdmin) {
      setLoading(false);
      return;
    }
    void loadRows();
  }, [isReady, user, viewerIsAdmin, walletLoading, loadRows]);

  const approve = async (id: string) => {
    if (!supabase || !viewerIsAdmin) return;
    setBusyId(id);
    const { error: uError } = await supabase
      .from("profiles")
      .update({ beta_user: true, beta_status: "approved" })
      .eq("id", id);
    setBusyId(null);
    if (uError) {
      setError(uError.message);
      return;
    }
    await loadRows();
  };

  const reject = async (id: string) => {
    if (!supabase || !viewerIsAdmin) return;
    setBusyId(id);
    const { error: uError } = await supabase
      .from("profiles")
      .update({ beta_user: false, beta_status: "rejected" })
      .eq("id", id);
    setBusyId(null);
    if (uError) {
      setError(uError.message);
      return;
    }
    await loadRows();
  };

  if (!isReady || walletLoading) {
    return <p className="p-6 text-slate-400">Loadingâ€¦</p>;
  }

  if (!user) {
    return (
      <p className="p-6 text-slate-300">
        <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
          Sign in
        </Link>{" "}
        to manage beta approvals.
      </p>
    );
  }

  if (!viewerIsAdmin) {
    return <p className="p-6 text-amber-200">Access Denied</p>;
  }

  const pendingCount = rows.filter((r) => String(r.beta_status ?? "").toLowerCase() === "pending").length;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Beta approval</h1>
      <p className="mt-1 text-sm text-slate-400">Review profiles and approve or reject beta access.</p>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">{error}</p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-slate-400">Loading tableâ€¦</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No pending beta users</p>
      ) : (
        <>
          {pendingCount === 0 ? (
            <p className="mt-6 text-sm text-slate-500">No pending beta users</p>
          ) : null}
          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Joined Date</th>
                <th className="px-4 py-3">Beta Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pending = String(row.beta_status ?? "").toLowerCase() === "pending";
                return (
                  <tr key={row.id} className="border-b border-slate-800/80 last:border-0">
                    <td className="px-4 py-3 align-middle">{row.email ?? "â€”"}</td>
                    <td className="px-4 py-3 align-middle text-slate-300">{formatJoined(row.created_at)}</td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusBadgeClass(row.beta_status)}`}
                      >
                        {row.beta_status ?? "â€”"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      {pending ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void approve(row.id)}
                            className="rounded-md border border-emerald-600/60 bg-emerald-900/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => void reject(row.id)}
                            className="rounded-md border border-red-600/50 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-950/60 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-600">â€”</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
