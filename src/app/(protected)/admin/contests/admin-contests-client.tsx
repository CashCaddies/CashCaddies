"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { contestStatusBadgeClassName, contestStatusBadgeLabel } from "@/lib/contest-admin-state";
import { CONTESTS_MINIMAL_SELECT, entryCountFromContestEntriesRelation } from "@/lib/contest-lobby-shared";
import { supabase } from "@/lib/supabase/client";
import {
  adminCompleteContest,
  adminLockContest,
  adminStartContest,
  adminSettleContest,
} from "@/app/(protected)/admin/contest-lifecycle/actions";
import { createContestAdmin, deleteContestAdmin, seedTempLobbyTestContests, updateContestAdmin } from "./actions";

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

function rowStatusNorm(row: ContestRow): string {
  return String(row.status ?? "").trim().toLowerCase();
}

/** Show Publish when contest is `locked` (not yet open for lobby entries). */
function canShowPublishForRow(row: ContestRow): boolean {
  return rowStatusNorm(row) === "locked";
}

function canShowLockForRow(row: ContestRow): boolean {
  const s = rowStatusNorm(row);
  return s === "filling" || s === "full";
}

function canShowStartForRow(row: ContestRow): boolean {
  const s = rowStatusNorm(row);
  if (s === "live" || s === "complete" || s === "settled" || s === "cancelled" || s === "canceled") return false;
  return s === "locked" || s === "filling" || s === "full";
}

function canShowCompleteForRow(row: ContestRow): boolean {
  return rowStatusNorm(row) === "live";
}

function canShowSettleForRow(row: ContestRow): boolean {
  return rowStatusNorm(row) === "complete";
}

function formatMoney(n: number | string | null): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "â€”";
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function AdminContestsPageClient() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const [loadingPage, setLoadingPage] = useState(true);
  const [rows, setRows] = useState<ContestRow[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [listNotice, setListNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  /** Row id while a lifecycle/delete action runs (Publish still uses `loading`). */
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [tempSeedBusy, setTempSeedBusy] = useState(false);

  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState("5");
  const [maxEntries, setMaxEntries] = useState("100");
  const [startDate, setStartDate] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateEntryFee, setTemplateEntryFee] = useState("");
  const [templateMaxEntries, setTemplateMaxEntries] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [spawnStartTime, setSpawnStartTime] = useState("");
  const [spawnCount, setSpawnCount] = useState("1");
  const [founderUserEmail, setFounderUserEmail] = useState("");

  async function fetchContestsSafe(): Promise<ContestRow[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("contests")
      .select(CONTESTS_MINIMAL_SELECT)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Contest fetch error:", error);
      return [];
    }
    return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      entry_fee_usd: (row.entry_fee_usd as number | string | null) ?? null,
      entry_count: entryCountFromContestEntriesRelation(row),
      starts_at: typeof row.starts_at === "string" ? row.starts_at : null,
      start_time: typeof row.start_time === "string" ? row.start_time : null,
      status: row.status != null ? String(row.status) : null,
      created_by:
        typeof (row as { created_by?: unknown }).created_by === "string"
          ? String((row as { created_by?: string }).created_by)
          : null,
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
      const contests = await fetchContestsSafe();
      if (cancelled) return;
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

  useEffect(() => {
    const loadTemplates = async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("contest_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTemplates(data);
      }
    };

    void loadTemplates();
  }, []);

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

  const handlePublish = async (row: ContestRow) => {
    if (!user?.id || !canShowPublishForRow(row)) return;

    setLoading(true);
    try {
      const result = await updateContestAdmin(user.id, row.id, { status: "filling" });

      if (!result.ok) {
        console.error(result.error);
        alert(result.error || "Publish failed");
        return;
      }

      const contests = await fetchContestsSafe();
      setRows(contests);
      setListNotice({ text: "Contest published", ok: true });
    } finally {
      setLoading(false);
    }
  };

  const refreshRowsAfterAction = async (notice: { text: string; ok: boolean }) => {
    const contests = await fetchContestsSafe();
    setRows(contests);
    setListNotice(notice);
  };

  const runLifecycle = async (row: ContestRow, key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyRowId(row.id);
    try {
      const result = await fn();
      if (!result.ok) {
        alert(result.error ?? `${key} failed`);
        return;
      }
      const notice =
        key === "locked"
          ? "Contest locked"
          : key === "live"
            ? "Contest started (live)"
            : key === "complete"
              ? "Contest marked complete"
              : key === "settled"
                ? "Contest settled"
                : "Updated";
      await refreshRowsAfterAction({ text: notice, ok: true });
    } finally {
      setBusyRowId(null);
    }
  };

  const handleDeleteRow = async (row: ContestRow) => {
    if (!user?.id) return;
    if (!window.confirm(`Delete contest "${row.name}"? This cannot be undone.`)) return;
    setBusyRowId(row.id);
    try {
      const result = await deleteContestAdmin(user.id, row.id);
      if (!result.ok) {
        alert(result.error || "Delete failed");
        return;
      }
      await refreshRowsAfterAction({ text: "Contest deleted", ok: true });
    } finally {
      setBusyRowId(null);
    }
  };

  const actionBtnClass =
    "inline-flex rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

  const handleCreateTemplate = async () => {
    if (!supabase) {
      alert("Supabase client is not available.");
      return;
    }
    const { error } = await supabase.from("contest_templates").insert([
      {
        name: templateName,
        entry_fee_cents: Math.round((Number(templateEntryFee) || 0) * 100),
        max_entries: Number(templateMaxEntries),
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Template created");
  };

  const handleSpawnFromTemplate = async (templateId: string) => {
    if (!supabase) {
      alert("Supabase client is not available.");
      return;
    }
    if (!spawnStartTime) {
      alert("Please select a start time");
      return;
    }
    const startTime = spawnStartTime
      ? new Date(spawnStartTime).toISOString()
      : new Date().toISOString();

    const count = Number(spawnCount) || 1;

    for (let i = 0; i < count; i++) {
      const { error, data } = await supabase.rpc("spawn_contest_from_template", {
        p_template_id: templateId,
        p_slate_id: null,
        p_start_time: startTime,
      });

      if (error) {
        alert(error.message);
        return;
      }

      const payload = data as { ok?: boolean; error?: string } | null;
      if (payload && payload.ok === false) {
        alert(payload.error || "Spawn failed");
        return;
      }
    }

    alert(`Created ${count} contests`);
    const contests = await fetchContestsSafe();
    setRows(contests);
  };

  const handleSeedTempLobbyTests = () => {
    if (!user?.id) return;
    setTempSeedBusy(true);
    void (async () => {
      try {
        const res = await seedTempLobbyTestContests(user.id);
        if (!res.ok) {
          setListNotice({ text: res.error, ok: false });
          return;
        }
        const contests = await fetchContestsSafe();
        setRows(contests);
        setListNotice({
          text: `TEMP seed OK (${res.created.length}): ${res.created.map((c) => c.name).join(" · ")}`,
          ok: true,
        });
      } finally {
        setTempSeedBusy(false);
      }
    })();
  };

  const makeFounder = async (email: string) => {
    if (!supabase) {
      alert("Supabase client is not available.");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      alert("Enter an email");
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .update({ is_founder: true })
      .eq("email", trimmed)
      .select("id");

    if (error) {
      alert(error.message);
      return;
    }
    if (!data?.length) {
      alert("No profile found with that email.");
      return;
    }

    alert("User marked as founder");
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

      <div className="rounded-xl border-2 border-amber-500/50 bg-amber-950/25 p-5 shadow-inner shadow-black/20">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-200/95">Temp · admin only · remove later</p>
        <h2 className="mt-2 text-lg font-bold text-white">Lobby QA — seed test contests</h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/90">
          Creates <strong className="font-semibold text-white">three real rows</strong> in <code className="text-amber-50/95">public.contests</code>{" "}
          (all standard lobby contests) using the same path as &quot;Create Contest&quot;. Names include{" "}
          <code className="text-amber-50/95">[TEMP …]</code> so you can delete them from this list when done. Safe to
          click multiple times — each run uses a new timestamp in the name.
        </p>
        <button
          type="button"
          disabled={tempSeedBusy || !user?.id}
          onClick={handleSeedTempLobbyTests}
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-amber-400/60 bg-amber-600/90 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-slate-950 shadow hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {tempSeedBusy ? "Creating…" : "Create TEMP lobby test contests (3)"}
        </button>
      </div>

      <div className="goldCard p-6">
        <h2 className="text-lg font-semibold text-white">Founder access</h2>
        <p className="mt-1 text-sm text-slate-400">Set <code className="text-slate-300">is_founder</code> on a profile by email.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            placeholder="User Email"
            type="email"
            autoComplete="off"
            className="min-w-[220px] flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={founderUserEmail}
            onChange={(e) => setFounderUserEmail(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void makeFounder(founderUserEmail)}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          >
            Make Founder
          </button>
        </div>
      </div>
      <div className="goldCard p-6">
        <h2 className="text-xl font-semibold mt-10 mb-4">Create Template</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            placeholder="Template Name"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <input
            placeholder="Entry Fee"
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={templateEntryFee}
            onChange={(e) => setTemplateEntryFee(e.target.value)}
          />
          <input
            placeholder="Max Entries"
            type="number"
            min="1"
            step="1"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            value={templateMaxEntries}
            onChange={(e) => setTemplateMaxEntries(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={handleCreateTemplate}
          className="mt-4 inline-flex rounded-md bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Create Template
        </button>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={spawnStartTime}
            onChange={(e) => setSpawnStartTime(e.target.value)}
            className="p-2 bg-black border border-gray-800 rounded"
            placeholder="Start Time"
          />
          <input
            type="number"
            min={1}
            value={spawnCount}
            onChange={(e) => setSpawnCount(e.target.value)}
            className="p-2 bg-black border border-gray-800 rounded"
            placeholder="Number of Contests"
          />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded border border-gray-800 p-2">
              <span className="text-slate-200">{t.name}</span>
              <button
                type="button"
                onClick={() => void handleSpawnFromTemplate(String(t.id))}
                className="rounded bg-green-500 px-3 py-1 text-black"
              >
                Spawn
              </button>
            </div>
          ))}
        </div>
      </div>
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

                const parsedEntryFee = Number(entryFee) || 0;
                const parsedMaxEntries = Number(maxEntries) || 0;

                const created = await createContestAdmin({
                  requesterUserId: authUser.id,
                  name,
                  entryFee: parsedEntryFee,
                  maxEntries: parsedMaxEntries,
                  startDate: new Date(startDate).toISOString(),
                  status: "locked",
                });

                if (!created.ok) {
                  setIsError(true);
                  setMessage(created.error);
                  return;
                }

                const contests = await fetchContestsSafe();
                setRows(contests);
                setIsError(false);
                setMessage("Contest created successfully.");
                router.push(`/lobby?created=${encodeURIComponent(created.contestId)}`);
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
          <table className="w-full min-w-[960px] text-left text-sm">
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
                    <div className="flex max-w-[22rem] flex-wrap gap-1">
                      <Link
                        href={`/contest/${encodeURIComponent(row.id)}`}
                        className={`${actionBtnClass} border-emerald-600/50 text-emerald-200 hover:bg-emerald-950/50`}
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        disabled={busyRowId === row.id}
                        onClick={() => void handleDeleteRow(row)}
                        className={`${actionBtnClass} border-red-900/60 text-red-200 hover:bg-red-950/40`}
                      >
                        {busyRowId === row.id ? "…" : "Delete"}
                      </button>
                      {canShowPublishForRow(row) ? (
                        <button
                          type="button"
                          disabled={loading || busyRowId === row.id}
                          onClick={() => void handlePublish(row)}
                          className="inline-flex rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-950 disabled:opacity-60"
                        >
                          {loading ? "…" : "Publish"}
                        </button>
                      ) : null}
                      {canShowLockForRow(row) ? (
                        <button
                          type="button"
                          disabled={busyRowId === row.id}
                          onClick={() => void runLifecycle(row, "locked", () => adminLockContest(row.id))}
                          className={actionBtnClass}
                        >
                          {busyRowId === row.id ? "…" : "Lock"}
                        </button>
                      ) : null}
                      {canShowStartForRow(row) ? (
                        <button
                          type="button"
                          disabled={busyRowId === row.id}
                          onClick={() => void runLifecycle(row, "live", () => adminStartContest(row.id))}
                          className={actionBtnClass}
                        >
                          {busyRowId === row.id ? "…" : "Start"}
                        </button>
                      ) : null}
                      {canShowCompleteForRow(row) ? (
                        <button
                          type="button"
                          disabled={busyRowId === row.id}
                          onClick={() => void runLifecycle(row, "complete", () => adminCompleteContest(row.id))}
                          className={actionBtnClass}
                        >
                          {busyRowId === row.id ? "…" : "Complete"}
                        </button>
                      ) : null}
                      {canShowSettleForRow(row) ? (
                        <button
                          type="button"
                          disabled={busyRowId === row.id}
                          onClick={() => void runLifecycle(row, "settled", () => adminSettleContest(row.id))}
                          className={actionBtnClass}
                        >
                          {busyRowId === row.id ? "…" : "Settle"}
                        </button>
                      ) : null}
                    </div>
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

