"use client";

import Link from "next/link";
import { FounderBadge } from "@/components/founder-badge";
import { Loader2, Pencil, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  approveBetaUser,
  approveBetaUserAsFounder,
  bulkUpdateBetaStatus,
  rejectBetaUser,
  setBetaWaitlist,
  updateProfileBetaNotes,
  updateProfileInviteSource,
} from "@/app/admin/user-actions";
import { useAuth } from "@/contexts/auth-context";
import { getProfileByUserId } from "@/lib/getProfile";
import { APP_CONFIG_DEFAULT_MAX_BETA_USERS, APP_CONFIG_KEY_MAX_BETA_USERS, parseConfigNumber } from "@/lib/config";
import { INVITE_SOURCES, type InviteSource, parseInviteSource } from "@/lib/invite-source";
import { hasPermission, isSeniorAdmin } from "@/lib/permissions";
import { supabase } from "@/lib/supabase/client";
import { BetaUserProfileModal } from "./beta-user-profile-modal";

type BetaFilter = "pending" | "approved" | "rejected" | "waitlist";

type QueueRow = {
  id: string;
  email: string | null;
  username: string | null;
  created_at: string | null;
  beta_status: string | null;
  invite_source: InviteSource;
  beta_notes: string | null;
  founding_tester: boolean;
  beta_waitlist: boolean;
};

type AuditRow = {
  id: string;
  user_id: string;
  changed_by: string;
  action: string;
  created_at: string;
};

type ProfileMini = { id: string; email: string | null; username: string | null };

type RowActionState = { id: string; kind: "approve" | "approve_founder" | "reject" | "waitlist" };

type ToastState = { type: "success" | "error"; message: string };

const TOAST_MS = 3500;
const CLICK_DEBOUNCE_MS = 450;
const SEARCH_DEBOUNCE_MS = 350;

function queueRowMatchesSearch(row: QueueRow, queryLower: string): boolean {
  if (!queryLower) return true;
  const hay = [
    row.email,
    row.username,
    row.username?.trim() ? `@${row.username.trim()}` : null,
    row.beta_notes,
    row.invite_source,
    row.beta_waitlist ? "waitlist" : null,
  ];
  return hay.some((p) => String(p ?? "").toLowerCase().includes(queryLower));
}

function formatDate(value: string | null): string {
  if (!value) return "â€”";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "â€”";
  return d.toLocaleString();
}

function statusBadgeClass(status: string | null): string {
  const s = String(status ?? "").toLowerCase();
  if (s === "approved") return "border-emerald-500/40 bg-emerald-950/40 text-emerald-200";
  if (s === "rejected") return "border-red-500/40 bg-red-950/40 text-red-200";
  if (s === "waitlist") return "border-sky-500/40 bg-sky-950/40 text-sky-200";
  return "border-amber-500/40 bg-amber-950/40 text-amber-200";
}

function mergeRowBack(rows: QueueRow[], row: QueueRow): QueueRow[] {
  const next = rows.filter((r) => r.id !== row.id);
  next.push(row);
  next.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  return next;
}

export default function BetaQueuePage() {
  const { user, isReady } = useAuth();
  const [filter, setFilter] = useState<BetaFilter>("pending");
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [counts, setCounts] = useState<{
    pending: number;
    approved: number;
    rejected: number;
    waitlist: number;
  }>({
    pending: 0,
    approved: 0,
    rejected: 0,
    waitlist: 0,
  });
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditProfiles, setAuditProfiles] = useState<Map<string, ProfileMini>>(new Map());
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowAction, setRowAction] = useState<RowActionState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [, startTransition] = useTransition();
  const [role, setRole] = useState<string>("");
  const [roleLoading, setRoleLoading] = useState(true);
  const [maxBetaCap, setMaxBetaCap] = useState(APP_CONFIG_DEFAULT_MAX_BETA_USERS);
  const [notesModalUserId, setNotesModalUserId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [inviteSavingId, setInviteSavingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const lastClickRef = useRef(0);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const canApproveBeta = useMemo(() => hasPermission(role, "approve_beta"), [role]);
  const canApproveAsFounder = useMemo(() => isSeniorAdmin(role), [role]);
  const tableActionBusy = rowAction !== null;
  const tableBusy = tableActionBusy || bulkBusy;
  const betaAtCapacity = counts.approved >= maxBetaCap;
  const availableApproveSlots = Math.max(0, maxBetaCap - counts.approved);

  const loadCounts = useCallback(async () => {
    if (!supabase) return;
    const [p, a, r, w, cfg] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("beta_status", "pending"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("beta_status", "approved"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("beta_status", "rejected"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("beta_status", "waitlist"),
      supabase.from("app_config").select("value").eq("key", APP_CONFIG_KEY_MAX_BETA_USERS).maybeSingle(),
    ]);
    setCounts({
      pending: p.error ? 0 : Number(p.count ?? 0),
      approved: a.error ? 0 : Number(a.count ?? 0),
      rejected: r.error ? 0 : Number(r.count ?? 0),
      waitlist: w.error ? 0 : Number(w.count ?? 0),
    });
    if (!cfg.error && cfg.data && typeof (cfg.data as { value?: unknown }).value === "string") {
      setMaxBetaCap(parseConfigNumber((cfg.data as { value: string }).value, APP_CONFIG_DEFAULT_MAX_BETA_USERS));
    }
  }, []);

  const loadTable = useCallback(async () => {
    if (!supabase || !canApproveBeta) return;
    setLoading(true);
    const { data, error: qErr } = await supabase
      .from("profiles")
      .select("id,email,username,created_at,beta_status,invite_source,beta_notes,founding_tester,beta_waitlist")
      .eq("beta_status", filter)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (qErr) {
      setRows([]);
      setError(qErr.message);
      return;
    }
    const mapped = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id ?? ""),
      email: typeof r.email === "string" ? r.email : null,
      username: typeof r.username === "string" ? r.username : null,
      created_at: typeof r.created_at === "string" ? r.created_at : null,
      beta_status: typeof r.beta_status === "string" ? r.beta_status : null,
      invite_source: parseInviteSource(r.invite_source),
      beta_notes: typeof r.beta_notes === "string" ? r.beta_notes : null,
      founding_tester: r.founding_tester === true,
      beta_waitlist: r.beta_waitlist === true,
    }));
    setRows(mapped);
    setError(null);
  }, [canApproveBeta, filter]);

  const loadAudit = useCallback(async () => {
    if (!supabase || !canApproveBeta) return;
    setAuditLoading(true);
    const { data, error: qErr } = await supabase
      .from("beta_approvals")
      .select("id,user_id,changed_by,action,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (qErr) {
      setAuditRows([]);
      setAuditProfiles(new Map());
      setAuditLoading(false);
      return;
    }
    const logs = ((data ?? []) as AuditRow[]).map((row) => ({
      ...row,
      id: String(row.id),
      user_id: String(row.user_id),
      changed_by: String(row.changed_by),
      action: String(row.action),
      created_at: typeof row.created_at === "string" ? row.created_at : String(row.created_at ?? ""),
    }));
    setAuditRows(logs);
    const idSet = new Set<string>();
    for (const l of logs) {
      idSet.add(l.user_id);
      idSet.add(l.changed_by);
    }
    const ids = [...idSet];
    if (ids.length === 0) {
      setAuditProfiles(new Map());
      setAuditLoading(false);
      return;
    }
    const { data: profs } = await supabase.from("profiles").select("id,email,username").in("id", ids);
    const map = new Map<string, ProfileMini>();
    for (const p of (profs ?? []) as ProfileMini[]) {
      map.set(String(p.id), {
        id: String(p.id),
        email: typeof p.email === "string" ? p.email : null,
        username: typeof p.username === "string" ? p.username : null,
      });
    }
    setAuditProfiles(map);
    setAuditLoading(false);
  }, [canApproveBeta]);

  useEffect(() => {
    if (!isReady) return;
    if (!supabase) {
      setRoleLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        if (!cancelled) {
          setRole("");
          setRoleLoading(false);
        }
        return;
      }
      const profile = await getProfileByUserId(authUser.id);
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
    if (!isReady || roleLoading || !user || !canApproveBeta) {
      if (isReady && !roleLoading && user && !canApproveBeta) setLoading(false);
      return;
    }
    void loadCounts();
  }, [canApproveBeta, isReady, loadCounts, roleLoading, user]);

  useEffect(() => {
    if (!isReady || roleLoading || !user || !canApproveBeta) return;
    void loadTable();
  }, [canApproveBeta, isReady, loadTable, roleLoading, user]);

  useEffect(() => {
    setSelectedIds([]);
    setSearchInput("");
    setDebouncedSearch("");
  }, [filter]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const filteredRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => queueRowMatchesSearch(r, q));
  }, [rows, debouncedSearch]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filteredRows.some((r) => r.id === id)));
  }, [filteredRows]);

  useEffect(() => {
    if (!isReady || roleLoading || !user || !canApproveBeta) return;
    void loadAudit();
  }, [canApproveBeta, isReady, loadAudit, roleLoading, user]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!notesModalUserId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !notesSaving) setNotesModalUserId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [notesModalUserId, notesSaving]);

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el || filteredRows.length === 0) return;
    const selectedVisible = selectedIds.filter((id) => filteredRows.some((r) => r.id === id)).length;
    el.indeterminate = selectedVisible > 0 && selectedVisible < filteredRows.length;
  }, [filteredRows, selectedIds]);

  const toggleRowSelected = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const toggleSelectAllOnPage = useCallback(() => {
    const ids = filteredRows.map((r) => r.id);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...ids])]);
    }
  }, [filteredRows, selectedIds]);

  const selectedOnPageCount = useMemo(
    () => selectedIds.filter((id) => filteredRows.some((r) => r.id === id)).length,
    [filteredRows, selectedIds],
  );

  const bulkApproveDisabled =
    filter === "approved" ||
    selectedOnPageCount === 0 ||
    bulkBusy ||
    tableActionBusy ||
    betaAtCapacity ||
    selectedOnPageCount > availableApproveSlots;

  const bulkRejectDisabled = filter === "rejected" || selectedOnPageCount === 0 || bulkBusy || tableActionBusy;

  const applyQueueSnapshot = useCallback((p: { approvedCount: number; maxBetaUsers: number }) => {
    setMaxBetaCap(p.maxBetaUsers);
    setCounts((c) => ({ ...c, approved: p.approvedCount }));
  }, []);

  const runBulkApprove = useCallback(() => {
    if (bulkApproveDisabled) return;
    const ids = selectedIds.filter((id) => filteredRows.some((r) => r.id === id));
    if (ids.length === 0) return;
    setBulkBusy(true);
    startTransition(() => {
      void (async () => {
        const res = await bulkUpdateBetaStatus(ids, "approved");
        setBulkBusy(false);
        if (!res.ok) {
          setToast({ type: "error", message: res.error });
          return;
        }
        setSelectedIds([]);
        setToast({ type: "success", message: `Approved ${res.processed} user(s)` });
        applyQueueSnapshot(res);
        await loadTable();
        await loadAudit();
      })();
    });
  }, [
    applyQueueSnapshot,
    bulkApproveDisabled,
    loadAudit,
    loadTable,
    filteredRows,
    selectedIds,
    startTransition,
  ]);

  const runBulkReject = useCallback(() => {
    if (bulkRejectDisabled) return;
    const ids = selectedIds.filter((id) => filteredRows.some((r) => r.id === id));
    if (ids.length === 0) return;
    setBulkBusy(true);
    startTransition(() => {
      void (async () => {
        const res = await bulkUpdateBetaStatus(ids, "rejected");
        setBulkBusy(false);
        if (!res.ok) {
          setToast({ type: "error", message: res.error });
          return;
        }
        setSelectedIds([]);
        setToast({ type: "success", message: `Rejected ${res.processed} user(s)` });
        applyQueueSnapshot(res);
        await loadTable();
        await loadAudit();
      })();
    });
  }, [applyQueueSnapshot, bulkRejectDisabled, loadAudit, loadTable, filteredRows, selectedIds, startTransition]);

  const runApprove = useCallback(
    (id: string) => {
      if (tableBusy) return;
      const t = Date.now();
      if (t - lastClickRef.current < CLICK_DEBOUNCE_MS) return;
      lastClickRef.current = t;

      const row = rows.find((r) => r.id === id);
      if (!row) return;

      const countsBefore = { ...counts };

      setRows((prev) => prev.filter((r) => r.id !== id));
      setCounts((c) => {
        if (filter === "pending") {
          return { ...c, pending: Math.max(0, c.pending - 1), approved: c.approved + 1 };
        }
        if (filter === "rejected") {
          return { ...c, rejected: Math.max(0, c.rejected - 1), approved: c.approved + 1 };
        }
        if (filter === "waitlist") {
          return { ...c, waitlist: Math.max(0, c.waitlist - 1), approved: c.approved + 1 };
        }
        return c;
      });
      setRowAction({ id, kind: "approve" });

      startTransition(() => {
        void (async () => {
          const res = await approveBetaUser(id);
          setRowAction(null);
          if (res == null || typeof res !== "object" || !("success" in res)) {
            setRows((prev) => mergeRowBack(prev, row));
            setCounts(countsBefore);
            setToast({ type: "error", message: "Approve action returned an invalid response." });
            return;
          }
          if (!res.success) {
            setRows((prev) => mergeRowBack(prev, row));
            setCounts(countsBefore);
            setToast({ type: "error", message: res.error });
            return;
          }
          setToast({ type: "success", message: "User approved" });
          applyQueueSnapshot(res);
          await loadTable();
          await loadAudit();
        })();
      });
    },
    [applyQueueSnapshot, counts, filter, loadAudit, loadTable, rows, tableBusy],
  );

  const runApproveFounder = useCallback(
    (id: string) => {
      if (tableBusy || !canApproveAsFounder) return;
      const t = Date.now();
      if (t - lastClickRef.current < CLICK_DEBOUNCE_MS) return;
      lastClickRef.current = t;

      const row = rows.find((r) => r.id === id);
      if (!row) return;

      const countsBefore = { ...counts };

      setRows((prev) => prev.filter((r) => r.id !== id));
      setCounts((c) => {
        if (filter === "pending") {
          return { ...c, pending: Math.max(0, c.pending - 1), approved: c.approved + 1 };
        }
        if (filter === "rejected") {
          return { ...c, rejected: Math.max(0, c.rejected - 1), approved: c.approved + 1 };
        }
        if (filter === "waitlist") {
          return { ...c, waitlist: Math.max(0, c.waitlist - 1), approved: c.approved + 1 };
        }
        return c;
      });
      setRowAction({ id, kind: "approve_founder" });

      startTransition(() => {
        void (async () => {
          const res = await approveBetaUserAsFounder(id);
          setRowAction(null);
          if (!res.ok) {
            setRows((prev) => mergeRowBack(prev, row));
            setCounts(countsBefore);
            setToast({ type: "error", message: "Action failed" });
            return;
          }
          setToast({ type: "success", message: "User approved as founder" });
          applyQueueSnapshot(res);
          await loadTable();
          await loadAudit();
        })();
      });
    },
    [applyQueueSnapshot, canApproveAsFounder, counts, filter, loadAudit, loadTable, rows, tableBusy],
  );

  const runReject = useCallback(
    (id: string) => {
      if (tableBusy) return;
      const t = Date.now();
      if (t - lastClickRef.current < CLICK_DEBOUNCE_MS) return;
      lastClickRef.current = t;

      const row = rows.find((r) => r.id === id);
      if (!row) return;

      const countsBefore = { ...counts };

      setRows((prev) => prev.filter((r) => r.id !== id));
      setCounts((c) => {
        if (filter === "pending") {
          return { ...c, pending: Math.max(0, c.pending - 1), rejected: c.rejected + 1 };
        }
        if (filter === "approved") {
          return { ...c, approved: Math.max(0, c.approved - 1), rejected: c.rejected + 1 };
        }
        if (filter === "waitlist") {
          return { ...c, waitlist: Math.max(0, c.waitlist - 1), rejected: c.rejected + 1 };
        }
        return c;
      });
      setRowAction({ id, kind: "reject" });

      startTransition(() => {
        void (async () => {
          const res = await rejectBetaUser(id);
          setRowAction(null);
          if (!res.ok) {
            setRows((prev) => mergeRowBack(prev, row));
            setCounts(countsBefore);
            setToast({ type: "error", message: "Action failed" });
            return;
          }
          setToast({ type: "success", message: "User rejected" });
          applyQueueSnapshot(res);
          await loadTable();
          await loadAudit();
        })();
      });
    },
    [applyQueueSnapshot, counts, filter, loadAudit, loadTable, rows, tableBusy],
  );

  const runWaitlistToggle = useCallback(
    (id: string, enabled: boolean) => {
      if (tableBusy) return;
      const t = Date.now();
      if (t - lastClickRef.current < CLICK_DEBOUNCE_MS) return;
      lastClickRef.current = t;
      if (!rows.some((r) => r.id === id)) return;
      setRowAction({ id, kind: "waitlist" });
      startTransition(() => {
        void (async () => {
          const res = await setBetaWaitlist(id, enabled);
          setRowAction(null);
          if (!res.ok) {
            setToast({ type: "error", message: res.error });
            return;
          }
          applyQueueSnapshot(res);
          setRows((prev) => prev.map((r) => (r.id === id ? { ...r, beta_waitlist: enabled } : r)));
          setToast({
            type: "success",
            message: enabled ? "Saved to waitlist" : "Removed from waitlist",
          });
          await loadAudit();
        })();
      });
    },
    [applyQueueSnapshot, loadAudit, rows, startTransition, tableBusy],
  );

  const notesModalRow = useMemo(
    () => (notesModalUserId ? rows.find((r) => r.id === notesModalUserId) : undefined),
    [notesModalUserId, rows],
  );

  const openNotesModal = useCallback((row: QueueRow) => {
    setNotesModalUserId(row.id);
    setNotesDraft(row.beta_notes ?? "");
  }, []);

  const saveNotes = useCallback(async () => {
    if (!notesModalUserId) return;
    setNotesSaving(true);
    const res = await updateProfileBetaNotes(notesModalUserId, notesDraft);
    setNotesSaving(false);
    if (!res.ok) {
      setToast({ type: "error", message: res.error });
      return;
    }
    const stored = notesDraft.trim() === "" ? null : notesDraft.trim();
    setRows((prev) => prev.map((r) => (r.id === notesModalUserId ? { ...r, beta_notes: stored } : r)));
    setNotesModalUserId(null);
    setToast({ type: "success", message: "Notes saved" });
  }, [notesDraft, notesModalUserId]);

  const onInviteSourceChange = useCallback(
    async (rowId: string, current: InviteSource, next: InviteSource) => {
      if (next === current) return;
      setInviteSavingId(rowId);
      const res = await updateProfileInviteSource(rowId, next);
      setInviteSavingId(null);
      if (!res.ok) {
        setToast({ type: "error", message: res.error });
        void loadTable();
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, invite_source: next } : r)));
      setToast({ type: "success", message: "Invite source updated" });
    },
    [loadTable],
  );

  if (!isReady || roleLoading) {
    return <p className="text-slate-400">Loadingâ€¦</p>;
  }

  if (!user) {
    return (
      <p className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-300">
        <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
          Sign in
        </Link>{" "}
        to manage the beta queue.
      </p>
    );
  }

  if (!canApproveBeta) {
    return (
      <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-200">
        You do not have permission to manage beta approvals.
      </p>
    );
  }

  return (
    <div className="pageWrap relative py-8">
      <BetaUserProfileModal
        userId={profileModalUserId}
        onClose={() => setProfileModalUserId(null)}
        betaAtCapacity={betaAtCapacity}
        onApproved={async ({ approvedCount, maxBetaUsers }) => {
          setToast({ type: "success", message: "User approved" });
          applyQueueSnapshot({ approvedCount, maxBetaUsers });
          await loadTable();
          await loadAudit();
        }}
        onWaitlistUpdated={async ({ approvedCount, maxBetaUsers }) => {
          applyQueueSnapshot({ approvedCount, maxBetaUsers });
          await loadTable();
          await loadAudit();
        }}
      />

      {notesModalUserId ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => !notesSaving && setNotesModalUserId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="beta-notes-modal-title"
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="beta-notes-modal-title" className="text-lg font-bold text-white">
              Beta notes
              {notesModalRow ? (
                <span className="mt-1 block text-sm font-normal text-slate-400">
                  {notesModalRow.email?.trim() ||
                    (notesModalRow.username?.trim() ? `@${notesModalRow.username}` : null) ||
                    notesModalRow.id.slice(0, 8)}
                </span>
              ) : null}
            </h2>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              disabled={notesSaving}
              rows={5}
              className="mt-3 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
              placeholder="Internal notes for this beta userâ€¦"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={notesSaving}
                onClick={() => setNotesModalUserId(null)}
                className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={notesSaving}
                onClick={() => void saveNotes()}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-600/50 bg-emerald-950/50 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-950/70 disabled:pointer-events-none disabled:opacity-50"
              >
                {notesSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Savingâ€¦
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 z-[70] max-w-md -translate-x-1/2 rounded-lg border px-4 py-3 text-center text-sm font-semibold shadow-lg shadow-black/40 ${
            toast.type === "success"
              ? "border-emerald-500/45 bg-emerald-950/95 text-emerald-100"
              : "border-red-500/45 bg-red-950/95 text-red-100"
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Link href="/dashboard/admin" className="text-emerald-400/90 hover:text-emerald-300">
              Admin Panel
            </Link>
            <span className="mx-2 text-slate-600">/</span>
            Beta Queue
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">Beta approval queue</h1>
          <p className="mt-1 text-sm text-slate-400">Approve or reject closed-beta access. Changes are audited.</p>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">{error}</p>
      ) : null}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => setFilter("pending")}
          className={`rounded-xl border px-4 py-4 text-left transition ${
            filter === "pending"
              ? "border-amber-500/50 bg-amber-950/30 ring-1 ring-amber-500/30"
              : "border-slate-700 bg-slate-900/60 hover:border-slate-600"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-amber-200">{counts.pending}</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter("waitlist")}
          className={`rounded-xl border px-4 py-4 text-left transition ${
            filter === "waitlist"
              ? "border-sky-500/50 bg-sky-950/25 ring-1 ring-sky-500/30"
              : "border-slate-700 bg-slate-900/60 hover:border-slate-600"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Waitlist</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-sky-200">{counts.waitlist}</p>
          <p className="mt-1 text-xs text-slate-500">beta_status</p>
        </button>
        <button
          type="button"
          onClick={() => setFilter("rejected")}
          className={`rounded-xl border px-4 py-4 text-left transition ${
            filter === "rejected"
              ? "border-red-500/50 bg-red-950/20 ring-1 ring-red-500/30"
              : "border-slate-700 bg-slate-900/60 hover:border-slate-600"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rejected</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-red-300">{counts.rejected}</p>
        </button>
      </div>

      <p className="mb-2 text-sm text-slate-400">
        Showing <span className="font-semibold text-slate-200">{filter}</span> only â€” click a card above to switch.
      </p>

      {betaAtCapacity ? (
        <div
          role="status"
          className="mb-4 rounded-xl border border-amber-500/45 bg-amber-950/25 px-4 py-3 ring-1 ring-amber-500/20"
        >
          <p className="text-sm font-bold uppercase tracking-wide text-amber-100">Beta full</p>
          <p className="mt-1 text-sm text-amber-100/90">
            {counts.approved} / {maxBetaCap} approved â€” Approve, Approve + Founder, and bulk approve are off. Use{" "}
            <span className="font-semibold text-amber-50">Waitlist</span> on pending users to flag them for when slots open.
          </p>
        </div>
      ) : null}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="relative flex min-w-[min(100%,20rem)] flex-1 items-center gap-2">
          <span className="sr-only">Search queue</span>
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-500" aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search email, username, notes, invite sourceâ€¦"
            autoComplete="off"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-9 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setDebouncedSearch("");
              }}
              className="absolute right-2 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Clear search"
            >
              Clear
            </button>
          ) : null}
        </label>
        {debouncedSearch.trim() ? (
          <p className="text-xs text-slate-500">
            Showing {filteredRows.length} of {rows.length} {filter} users
          </p>
        ) : null}
      </div>

      {!loading && rows.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {filter !== "approved" ? (
            <button
              type="button"
              disabled={bulkApproveDisabled}
              title={
                betaAtCapacity
                  ? "Beta full â€” approvals disabled"
                  : selectedOnPageCount > availableApproveSlots
                    ? `Only ${availableApproveSlots} approval slot(s) left`
                    : undefined
              }
              onClick={() => runBulkApprove()}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-600/50 bg-emerald-950/50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-950/70 disabled:pointer-events-none disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Approve Selected
              {selectedOnPageCount > 0 ? ` (${selectedOnPageCount})` : ""}
            </button>
          ) : null}
          {filter !== "rejected" ? (
            <button
              type="button"
              disabled={bulkRejectDisabled}
              onClick={() => runBulkReject()}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-red-600/50 bg-red-950/40 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-100 hover:bg-red-950/60 disabled:pointer-events-none disabled:opacity-50"
            >
              {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Reject Selected
              {selectedOnPageCount > 0 ? ` (${selectedOnPageCount})` : ""}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
              <th className="w-10 px-2 py-3 text-center font-semibold">
                <span className="sr-only">Select row</span>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  disabled={loading || bulkBusy || tableActionBusy || filteredRows.length === 0}
                  checked={filteredRows.length > 0 && filteredRows.every((r) => selectedIds.includes(r.id))}
                  onChange={() => toggleSelectAllOnPage()}
                  aria-label="Select all rows matching the current search"
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-600 focus:ring-emerald-500/40 disabled:opacity-40"
                />
              </th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Username</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 font-semibold">Beta status</th>
              <th className="px-4 py-3 font-semibold">Waitlist</th>
              <th className="min-w-[8.5rem] px-4 py-3 font-semibold">Invite source</th>
              <th className="min-w-[10rem] px-4 py-3 font-semibold">Notes</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Loadingâ€¦
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No {filter} users.
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No users match your search.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const approveLoading = rowAction?.id === row.id && rowAction.kind === "approve";
                const approveFounderLoading = rowAction?.id === row.id && rowAction.kind === "approve_founder";
                const rejectLoading = rowAction?.id === row.id && rowAction.kind === "reject";
                const waitlistLoading = rowAction?.id === row.id && rowAction.kind === "waitlist";
                return (
                  <tr key={row.id} className="border-b border-slate-800/80">
                    <td className="px-2 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        disabled={tableBusy}
                        onChange={() => toggleRowSelected(row.id)}
                        aria-label={`Select ${row.email ?? row.username ?? row.id}`}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-600 focus:ring-emerald-500/40 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={tableBusy}
                        onClick={() => setProfileModalUserId(row.id)}
                        className="max-w-[min(14rem,100%)] truncate text-left text-emerald-400 underline decoration-emerald-400/50 underline-offset-2 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
                      >
                        {row.email?.trim() || "View profile"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span>{row.username?.trim() ? `@${row.username}` : "â€”"}</span>
                        {row.founding_tester ? <FounderBadge /> : null}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(row.beta_status)}`}
                      >
                        {row.beta_status ?? "â€”"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.beta_waitlist ? (
                        <span className="inline-flex rounded-full border border-sky-500/40 bg-sky-950/35 px-2 py-0.5 text-xs font-semibold text-sky-200">
                          Yes
                        </span>
                      ) : (
                        <span className="text-slate-600">â€”</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Invite source for ${row.email ?? row.username ?? row.id}`}
                        className="w-full max-w-[10rem] rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
                        value={row.invite_source}
                        disabled={tableBusy || inviteSavingId === row.id}
                        onChange={(e) => {
                          void onInviteSourceChange(row.id, row.invite_source, e.target.value as InviteSource);
                        }}
                      >
                        {INVITE_SOURCES.map((src) => (
                          <option key={src} value={src}>
                            {src}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="max-w-[14rem] px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-slate-400 line-clamp-2">
                          {row.beta_notes?.trim() ? row.beta_notes : <span className="text-slate-600 select-none">â€”</span>}
                        </span>
                        <button
                          type="button"
                          aria-label="Edit beta notes"
                          disabled={tableBusy}
                          onClick={() => openNotesModal(row)}
                          className="shrink-0 rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-emerald-300 disabled:pointer-events-none disabled:opacity-40"
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {filter === "pending" || filter === "rejected" || filter === "waitlist" ? (
                          <>
                            <button
                              type="button"
                              disabled={tableBusy || betaAtCapacity}
                              title={betaAtCapacity ? "Beta full â€” cannot approve" : undefined}
                              onClick={() => runApprove(row.id)}
                              className="approveBtn inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:pointer-events-none disabled:opacity-50"
                            >
                              {approveLoading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                  Approving...
                                </>
                              ) : (
                                "Approve"
                              )}
                            </button>
                            {canApproveAsFounder ? (
                              <button
                                type="button"
                                disabled={tableBusy || betaAtCapacity}
                                title={
                                  betaAtCapacity
                                    ? "Beta full â€” cannot approve"
                                    : "Senior admin: approve with founding tester + founder priority"
                                }
                                onClick={() => runApproveFounder(row.id)}
                                className="approveFounderBtn inline-flex items-center justify-center gap-1.5 rounded-md border border-yellow-500/55 bg-gradient-to-b from-yellow-500/35 to-yellow-700/25 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#fff8dc] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] disabled:pointer-events-none disabled:opacity-50 hover:border-yellow-400/70 hover:from-yellow-500/45"
                              >
                                {approveFounderLoading ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                    Approving + Founder...
                                  </>
                                ) : (
                                  "Approve + Founder"
                                )}
                              </button>
                            ) : null}
                            {betaAtCapacity &&
                            (filter === "pending" || filter === "rejected" || filter === "waitlist") ? (
                              <button
                                type="button"
                                disabled={tableBusy}
                                title={
                                  row.beta_waitlist
                                    ? "Remove waitlist flag"
                                    : "Flag user for follow-up when slots open"
                                }
                                onClick={() => runWaitlistToggle(row.id, !row.beta_waitlist)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-sky-600/45 bg-sky-950/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-sky-100 hover:bg-sky-950/60 disabled:pointer-events-none disabled:opacity-50"
                              >
                                {waitlistLoading ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                    Savingâ€¦
                                  </>
                                ) : row.beta_waitlist ? (
                                  "Remove waitlist"
                                ) : (
                                  "Waitlist"
                                )}
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {filter === "pending" || filter === "approved" || filter === "waitlist" ? (
                          <button
                            type="button"
                            disabled={tableBusy}
                            onClick={() => runReject(row.id)}
                            className="rejectBtn inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide disabled:pointer-events-none disabled:opacity-50"
                          >
                            {rejectLoading ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                Rejecting...
                              </>
                            ) : (
                              "Reject"
                            )}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-bold text-white">Audit log</h2>
        <p className="mt-1 text-sm text-slate-400">Recent approve, reject, and waitlist actions.</p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/40">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">By</th>
              </tr>
            </thead>
            <tbody>
              {auditLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Loadingâ€¦
                  </td>
                </tr>
              ) : auditRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No audit entries yet.
                  </td>
                </tr>
              ) : (
                auditRows.map((log) => {
                  const subject = auditProfiles.get(log.user_id);
                  const actor = auditProfiles.get(log.changed_by);
                  const subjectLabel =
                    subject?.email?.trim() ||
                    (subject?.username?.trim() ? `@${subject.username.trim()}` : null) ||
                    log.user_id.slice(0, 8);
                  const actorLabel =
                    actor?.email?.trim() ||
                    (actor?.username?.trim() ? `@${actor.username.trim()}` : null) ||
                    log.changed_by.slice(0, 8);
                  return (
                    <tr key={log.id} className="border-b border-slate-800/80">
                      <td className="px-4 py-3 text-slate-400">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            log.action === "approved"
                              ? "border-emerald-500/40 text-emerald-200"
                              : log.action === "rejected"
                                ? "border-red-500/40 text-red-200"
                                : "border-sky-500/40 text-sky-200"
                          }`}
                        >
                          {log.action === "waitlist_on"
                            ? "Waitlist on"
                            : log.action === "waitlist_off"
                              ? "Waitlist off"
                              : log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200">{subjectLabel}</td>
                      <td className="px-4 py-3 text-slate-200">{actorLabel}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
