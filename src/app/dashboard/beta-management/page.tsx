"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  approveBetaUser,
  rejectBetaUser,
  setProfileBetaPriority,
  toggleAdmin,
  toggleProfileIsBetaTester,
  toggleProfileIsPremium,
  updateProfileInviteSource,
} from "@/app/admin/user-actions";
import { FounderBadge } from "@/components/founder-badge";
import { DashboardNav } from "@/components/dashboard-nav";
import { useAuth } from "@/contexts/auth-context";
import { getProfileByUserId } from "@/lib/getProfile";
import {
  isAdmin as checkIsAdmin,
  isSeniorAdmin as checkIsSeniorAdmin,
  normalizeProfileRole,
} from "@/lib/permissions";
import type { BetaPriority } from "@/lib/beta-priority";
import { BETA_PRIORITIES, parseBetaPriority } from "@/lib/beta-priority";
import { INVITE_SOURCES, type InviteSource, parseInviteSource } from "@/lib/invite-source";
import { APP_CONFIG_DEFAULT_MAX_BETA_USERS, APP_CONFIG_KEY_MAX_BETA_USERS, parseConfigNumber } from "@/lib/config";
import { supabase } from "@/lib/supabase";

type BetaUserRow = {
  id: string;
  email: string | null;
  username: string | null;
  beta_user: boolean;
  beta_status: string | null;
  role: string | null;
  beta_notes: string | null;
  created_at: string | null;
  is_beta_tester: boolean;
  is_premium: boolean;
  beta_priority: BetaPriority;
  invite_source: InviteSource;
  founding_tester: boolean;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function BetaManagementPage() {
  const { user, isReady } = useAuth();
  const [users, setUsers] = useState<BetaUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [role, setRole] = useState<string>("");
  const [roleLoading, setRoleLoading] = useState(true);
  const [missingProfile, setMissingProfile] = useState(false);
  const [maxBetaUsersCap, setMaxBetaUsersCap] = useState(APP_CONFIG_DEFAULT_MAX_BETA_USERS);

  const viewerIsAdmin = checkIsAdmin(role);
  const viewerIsSeniorAdmin = checkIsSeniorAdmin(role);

  const loadUsers = useCallback(async () => {
    if (!supabase) {
      setUsers([]);
      setError("Supabase client is not available.");
      setLoading(false);
      return;
    }
    const { data, error: qError } = await supabase
      .from("profiles")
      .select(
        "id,email,username,beta_status,role,beta_notes,beta_user,created_at,is_beta_tester,is_premium,beta_priority,invite_source,founding_tester",
      )
      .order("created_at", { ascending: false });
    if (qError) {
      setUsers([]);
      setError(qError.message);
      setLoading(false);
      return;
    }
    const mapped = ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id ?? ""),
      email: typeof r.email === "string" ? r.email : null,
      username: typeof r.username === "string" ? r.username : null,
      beta_user: r.beta_user === true,
      beta_status: typeof r.beta_status === "string" ? r.beta_status : null,
      role: typeof r.role === "string" ? r.role : null,
      beta_notes: typeof r.beta_notes === "string" ? r.beta_notes : null,
      created_at: typeof r.created_at === "string" ? r.created_at : null,
      is_beta_tester: r.is_beta_tester === true,
      is_premium: r.is_premium === true,
      beta_priority: parseBetaPriority(r.beta_priority),
      invite_source: parseInviteSource(r.invite_source),
      founding_tester: r.founding_tester === true,
    }));
    setUsers(mapped);
    setError(null);
    setLoading(false);
  }, []);

  const loadBetaCap = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", APP_CONFIG_KEY_MAX_BETA_USERS)
      .maybeSingle();
    if (error || !data || typeof (data as { value?: unknown }).value !== "string") {
      return;
    }
    setMaxBetaUsersCap(parseConfigNumber((data as { value: string }).value, APP_CONFIG_DEFAULT_MAX_BETA_USERS));
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!supabase) {
      setRole("");
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
      if (!profile) {
        if (!cancelled) {
          setMissingProfile(true);
          setRole("");
          setRoleLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setMissingProfile(false);
        setRole(profile.role ?? "");
        setRoleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReady]);

  useEffect(() => {
    if (!isReady || roleLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    if (!viewerIsAdmin) {
      setLoading(false);
      return;
    }
    void loadUsers();
    void loadBetaCap();
  }, [viewerIsAdmin, isReady, loadBetaCap, loadUsers, roleLoading, user]);

  useEffect(() => {
    if (!successToast) {
      return;
    }
    const t = window.setTimeout(() => setSuccessToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [successToast]);

  const pending = users.filter((u) => String(u.beta_status ?? "").toLowerCase() === "pending");
  const approved = users.filter((u) => String(u.beta_status ?? "").toLowerCase() === "approved");

  async function approve(id: string): Promise<boolean> {
    if (!viewerIsAdmin) {
      setError("Admin or Senior Admin access required.");
      return false;
    }
    setError(null);
    setPendingId(id);
    const res = await approveBetaUser(id);
    setPendingId(null);
    if (res == null || typeof res !== "object" || !("success" in res)) {
      setError("Approve action returned an invalid response.");
      return false;
    }
    if (!res.success) {
      setError(res.error);
      return false;
    }
    setMaxBetaUsersCap(res.maxBetaUsers);
    await loadUsers();
    return true;
  }

  async function reject(id: string) {
    if (!viewerIsAdmin) {
      setError("Admin or Senior Admin access required.");
      return;
    }
    setError(null);
    setPendingId(id);
    const res = await rejectBetaUser(id);
    setPendingId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMaxBetaUsersCap(res.maxBetaUsers);
    await loadUsers();
  }

  async function runToggleAdminRole(id: string) {
    if (!viewerIsSeniorAdmin) {
      setError("Only senior admins can change admin roles.");
      return;
    }
    if (user?.id === id) {
      setError("You cannot change your own role from this screen.");
      return;
    }
    setError(null);
    setPendingId(id);
    const result = await toggleAdmin(id);
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await loadUsers();
  }

  async function runSetBetaPriority(id: string, priority: BetaPriority) {
    if (!viewerIsSeniorAdmin) {
      setError("Only senior admins can set beta priority.");
      return;
    }
    setError(null);
    setPendingId(id);
    const result = await setProfileBetaPriority(id, priority);
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await loadUsers();
  }

  async function saveNotes(id: string, notes: string) {
    if (!supabase) {
      setError("Supabase client is not available.");
      return;
    }
    if (!viewerIsAdmin) {
      setError("Admin or Senior Admin access required.");
      return;
    }
    setPendingId(id);
    const { error: uError } = await supabase.from("profiles").update({ beta_notes: notes }).eq("id", id);
    setPendingId(null);
    if (uError) {
      setError(uError.message);
      return;
    }
    await loadUsers();
  }

  async function runSetInviteSource(id: string, source: InviteSource) {
    setError(null);
    setPendingId(id);
    const result = await updateProfileInviteSource(id, source);
    setPendingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await loadUsers();
  }

  if (!isReady || roleLoading || loading) {
    return <p className="text-slate-400">Loading...</p>;
  }

  if (!user) {
    return (
      <p className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-slate-300">
        <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
          Login required
        </Link>
      </p>
    );
  }

  if (missingProfile) {
    return <div>Loading...</div>;
  }

  if (!viewerIsAdmin) {
    return (
      <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-200">
        Admin or Senior Admin access required.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {successToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-lg border border-emerald-500/40 bg-emerald-950/95 px-4 py-3 text-center text-sm font-semibold text-emerald-100 shadow-lg shadow-black/40"
        >
          {successToast}
        </div>
      ) : null}

      {confirmApproveId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="beta-mgmt-approve-confirm-title"
          onClick={() => {
            if (!isPending) {
              setConfirmApproveId(null);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id="beta-mgmt-approve-confirm-title"
              className="text-base font-medium leading-relaxed text-slate-100"
            >
              Approve this user for beta access?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                className="rounded-md border border-slate-600 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900 disabled:opacity-50"
                onClick={() => setConfirmApproveId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  const id = confirmApproveId;
                  if (!id) {
                    return;
                  }
                  setError(null);
                  startTransition(async () => {
                    const ok = await approve(id);
                    if (ok) {
                      setConfirmApproveId(null);
                      setSuccessToast("User approved");
                    }
                  });
                }}
              >
                {isPending ? "Approving…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-6">
        <DashboardNav mode="single" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white">Beta User Management</h2>
        <p className="mt-1 text-sm text-slate-400">Review requests, approve or reject access, add internal notes, and promote admins.</p>
        <p className="mt-2 text-sm tabular-nums text-slate-300">
          Approved beta users{" "}
          <span className="font-semibold text-emerald-300">{approved.length}</span>
          <span className="text-slate-500"> / </span>
          <span className="font-semibold text-slate-200">{maxBetaUsersCap}</span>
          <span className="text-slate-500"> program cap</span>
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">{error}</p>
      ) : null}

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Pending Users</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">No pending users.</p>
        ) : (
          pending.map((u) => (
            <PendingUserCard
              key={u.id}
              row={u}
              busy={
                (isPending && pendingId === u.id) || confirmApproveId === u.id
              }
              isSelf={user.id === u.id}
              canManageAdmins={viewerIsSeniorAdmin}
              canSetBetaPriority={viewerIsSeniorAdmin}
              onApprove={() => setConfirmApproveId(u.id)}
              onReject={() => startTransition(() => void reject(u.id))}
              onMakeAdmin={() => startTransition(() => void runToggleAdminRole(u.id))}
              onSetBetaPriority={(p) => startTransition(() => void runSetBetaPriority(u.id, p))}
              onSetInviteSource={(s) => startTransition(() => void runSetInviteSource(u.id, s))}
              onSaveNotes={(notes) => startTransition(() => void saveNotes(u.id, notes))}
              onReload={() => void loadUsers()}
            />
          ))
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Approved Users</h3>
        {approved.length === 0 ? (
          <p className="text-sm text-slate-500">No approved users.</p>
        ) : (
          approved.map((u) => (
            <ApprovedUserCard
              key={u.id}
              row={u}
              busy={isPending && pendingId === u.id}
              isSelf={user.id === u.id}
              canManageAdmins={viewerIsSeniorAdmin}
              canSetBetaPriority={viewerIsSeniorAdmin}
              onMakeAdmin={() => startTransition(() => void runToggleAdminRole(u.id))}
              onRemoveAdmin={() => startTransition(() => void runToggleAdminRole(u.id))}
              onSetBetaPriority={(p) => startTransition(() => void runSetBetaPriority(u.id, p))}
              onSetInviteSource={(s) => startTransition(() => void runSetInviteSource(u.id, s))}
              onSaveNotes={(notes) => startTransition(() => void saveNotes(u.id, notes))}
              onReload={() => void loadUsers()}
            />
          ))
        )}
      </section>
    </div>
  );
}

function InviteSourceField({
  row,
  busy,
  onSetSource,
}: {
  row: BetaUserRow;
  busy: boolean;
  onSetSource: (s: InviteSource) => void;
}) {
  return (
    <div className="mt-3">
      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor={`invite-source-${row.id}`}>
        Invite source
      </label>
      <select
        id={`invite-source-${row.id}`}
        className="mt-1 w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
        value={row.invite_source}
        disabled={busy}
        onChange={(e) => onSetSource(e.target.value as InviteSource)}
      >
        {INVITE_SOURCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

function BetaPriorityField({
  row,
  busy,
  canEdit,
  onSetPriority,
}: {
  row: BetaUserRow;
  busy: boolean;
  canEdit: boolean;
  onSetPriority: (p: BetaPriority) => void;
}) {
  const value = row.beta_priority;
  return (
    <div className="mt-3">
      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor={`beta-priority-${row.id}`}>
        Beta priority
      </label>
      {canEdit ? (
        <select
          id={`beta-priority-${row.id}`}
          className="mt-1 w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
          value={value}
          disabled={busy}
          onChange={(e) => onSetPriority(e.target.value as BetaPriority)}
        >
          {BETA_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-1 text-sm capitalize text-slate-200">{value}</p>
      )}
    </div>
  );
}

function NotesBlock({
  initialNotes,
  disabled,
  onSave,
}: {
  initialNotes: string | null;
  disabled: boolean;
  onSave: (notes: string) => void;
}) {
  const [value, setValue] = useState(initialNotes ?? "");
  useEffect(() => {
    setValue(initialNotes ?? "");
  }, [initialNotes]);

  return (
    <div className="mt-3">
      <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">Admin notes</label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-50"
        placeholder="Internal notes (visible to admins only)"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSave(value)}
        className="mt-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
      >
        Save notes
      </button>
    </div>
  );
}

function DfsPremiumToggles({
  userId,
  busy,
  row,
  onReload,
}: {
  userId: string;
  busy: boolean;
  row: BetaUserRow;
  onReload: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 rounded-lg border border-slate-700/80 bg-slate-950/40 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advanced DFS tools</p>
      <p className="mt-1 text-xs text-slate-400">
        DFS beta: {row.is_beta_tester ? "on" : "off"} · Premium: {row.is_premium ? "on" : "off"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || pending}
          className="rounded-md border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const r = await toggleProfileIsBetaTester(userId);
              setMsg(r.ok ? r.message : r.error);
              if (r.ok) onReload();
            });
          }}
        >
          Toggle DFS beta tools
        </button>
        <button
          type="button"
          disabled={busy || pending}
          className="rounded-md border border-amber-700/50 bg-amber-950/40 px-2.5 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const r = await toggleProfileIsPremium(userId);
              setMsg(r.ok ? r.message : r.error);
              if (r.ok) onReload();
            });
          }}
        >
          Toggle Premium
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs text-emerald-300/95">{msg}</p> : null}
    </div>
  );
}

function PendingUserCard({
  row,
  busy,
  isSelf,
  canManageAdmins,
  canSetBetaPriority,
  onApprove,
  onReject,
  onMakeAdmin,
  onSetBetaPriority,
  onSetInviteSource,
  onSaveNotes,
  onReload,
}: {
  row: BetaUserRow;
  busy: boolean;
  isSelf: boolean;
  canManageAdmins: boolean;
  canSetBetaPriority: boolean;
  onApprove: () => void;
  onReject: () => void;
  onMakeAdmin: () => void;
  onSetBetaPriority: (p: BetaPriority) => void;
  onSetInviteSource: (s: InviteSource) => void;
  onSaveNotes: (notes: string) => void;
  onReload: () => void;
}) {
  return (
    <div className="adminUserCard">
      <p className="text-xs uppercase tracking-wide text-slate-500">Joined {formatDate(row.created_at)}</p>
      <p className="mt-1 text-sm text-slate-400">
        Email <span className="font-medium text-slate-200">{row.email || "—"}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <span>
          Username{" "}
          <span className="font-medium text-slate-200">{row.username?.trim() ? `@${row.username}` : "—"}</span>
        </span>
        {row.founding_tester ? <FounderBadge /> : null}
      </p>
      <InviteSourceField row={row} busy={busy} onSetSource={onSetInviteSource} />
      <BetaPriorityField row={row} busy={busy} canEdit={canSetBetaPriority} onSetPriority={onSetBetaPriority} />
      <NotesBlock initialNotes={row.beta_notes} disabled={busy} onSave={onSaveNotes} />
      <DfsPremiumToggles userId={row.id} busy={busy} row={row} onReload={onReload} />
      <div className="adminButtons">
        <button type="button" disabled={busy} onClick={onApprove} className="approveBtn text-sm font-semibold text-white">
          Approve
        </button>
        <button type="button" disabled={busy} onClick={onReject} className="rejectBtn text-sm font-semibold text-white">
          Reject
        </button>
        {canManageAdmins ? (
          <button
            type="button"
            disabled={busy || isSelf}
            title={isSelf ? "Cannot change your own role here" : undefined}
            onClick={onMakeAdmin}
            className="adminBtn text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Make Admin
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ApprovedUserCard({
  row,
  busy,
  isSelf,
  canManageAdmins,
  canSetBetaPriority,
  onMakeAdmin,
  onRemoveAdmin,
  onSetBetaPriority,
  onSetInviteSource,
  onSaveNotes,
  onReload,
}: {
  row: BetaUserRow;
  busy: boolean;
  isSelf: boolean;
  canManageAdmins: boolean;
  canSetBetaPriority: boolean;
  onMakeAdmin: () => void;
  onRemoveAdmin: () => void;
  onSetBetaPriority: (p: BetaPriority) => void;
  onSetInviteSource: (s: InviteSource) => void;
  onSaveNotes: (notes: string) => void;
  onReload: () => void;
}) {
  const isAlreadyAdmin = checkIsAdmin(row.role);
  const isRegularAdmin = normalizeProfileRole(row.role) === "admin";

  return (
    <div className="adminUserCard">
      <p className="text-xs uppercase tracking-wide text-slate-500">Joined {formatDate(row.created_at)}</p>
      <p className="mt-1 text-sm text-slate-400">
        Email <span className="font-medium text-slate-200">{row.email || "—"}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <span>
          Username{" "}
          <span className="font-medium text-slate-200">{row.username?.trim() ? `@${row.username}` : "—"}</span>
        </span>
        {row.founding_tester ? <FounderBadge /> : null}
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Role <span className="font-medium text-slate-200">{row.role || "—"}</span>
      </p>
      <InviteSourceField row={row} busy={busy} onSetSource={onSetInviteSource} />
      <BetaPriorityField row={row} busy={busy} canEdit={canSetBetaPriority} onSetPriority={onSetBetaPriority} />
      <NotesBlock initialNotes={row.beta_notes} disabled={busy} onSave={onSaveNotes} />
      <DfsPremiumToggles userId={row.id} busy={busy} row={row} onReload={onReload} />
      {canManageAdmins && !isAlreadyAdmin ? (
        <div className="adminButtons">
          <button
            type="button"
            disabled={busy || isSelf}
            title={isSelf ? "Cannot change your own role here" : undefined}
            onClick={onMakeAdmin}
            className="adminBtn text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Make Admin
          </button>
        </div>
      ) : null}
      {canManageAdmins && isRegularAdmin ? (
        <div className="adminButtons mt-2">
          <button
            type="button"
            disabled={busy || isSelf}
            title={isSelf ? "Cannot change your own role here" : undefined}
            onClick={onRemoveAdmin}
            className="rejectBtn text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove admin
          </button>
        </div>
      ) : null}
    </div>
  );
}
