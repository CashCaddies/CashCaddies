"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { approveBetaUser, setBetaWaitlist } from "@/app/(protected)/admin/user-actions";
import { formatMoney } from "@/lib/wallet";
import { supabase } from "@/lib/supabase/client";

export type BetaUserProfileModalProps = {
  userId: string | null;
  onClose: () => void;
  /** When true, Approve is disabled (same rule as queue row actions). */
  betaAtCapacity: boolean;
  /** Called after a successful approve with server capacity snapshot. */
  onApproved: (payload: { approvedCount: number; maxBetaUsers: number }) => void | Promise<void>;
  /** Called after waitlist toggle with capacity snapshot (for queue header counts). */
  onWaitlistUpdated: (payload: { approvedCount: number; maxBetaUsers: number }) => void | Promise<void>;
};

type ProfileDetail = {
  email: string | null;
  username: string | null;
  role: string | null;
  wallet: number;
  beta_status: string | null;
  beta_notes: string | null;
  created_at: string | null;
  beta_waitlist: boolean;
};

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

export function BetaUserProfileModal({
  userId,
  onClose,
  betaAtCapacity,
  onApproved,
  onWaitlistUpdated,
}: BetaUserProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [approveBusy, setApproveBusy] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const loadProfile = useCallback(async (id: string) => {
    if (!supabase) {
      setFetchError("Client not configured.");
      setProfile(null);
      return;
    }
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("email,username,role,account_balance,wallet_balance,beta_status,beta_notes,created_at,beta_waitlist")
      .eq("id", id)
      .maybeSingle();
    setLoading(false);
    if (error) {
      setFetchError(error.message);
      setProfile(null);
      return;
    }
    if (!data) {
      setFetchError("Profile not found.");
      setProfile(null);
      return;
    }
    const row = data as Record<string, unknown>;
    const acct = Number(row.account_balance ?? 0);
    const wb = row.wallet_balance != null && row.wallet_balance !== "" ? Number(row.wallet_balance) : acct;
    setProfile({
      email: typeof row.email === "string" ? row.email : null,
      username: typeof row.username === "string" ? row.username : null,
      role: typeof row.role === "string" ? row.role : null,
      wallet: Number.isFinite(wb) ? wb : acct,
      beta_status: typeof row.beta_status === "string" ? row.beta_status : null,
      beta_notes: typeof row.beta_notes === "string" ? row.beta_notes : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      beta_waitlist: row.beta_waitlist === true,
    });
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setFetchError(null);
      setApproveError(null);
      setWaitlistError(null);
      return;
    }
    void loadProfile(userId);
  }, [userId, loadProfile]);

  const modalBusy = approveBusy || waitlistBusy;

  useEffect(() => {
    if (!userId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !modalBusy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [userId, modalBusy, onClose]);

  async function handleApprove() {
    if (!userId || !profile) return;
    const st = String(profile.beta_status ?? "").toLowerCase();
    if (st !== "pending" && st !== "rejected" && st !== "waitlist") return;
    setApproveBusy(true);
    setApproveError(null);
    const res = await approveBetaUser(userId);
    setApproveBusy(false);
    if (res == null || typeof res !== "object" || !("success" in res)) {
      setApproveError("Approve action returned an invalid response.");
      return;
    }
    if (!res.success) {
      setApproveError(res.error);
      return;
    }
    await onApproved({ approvedCount: res.approvedCount, maxBetaUsers: res.maxBetaUsers });
    onClose();
  }

  async function handleWaitlistToggle(enabled: boolean) {
    if (!userId || !profile) return;
    setWaitlistBusy(true);
    setWaitlistError(null);
    const res = await setBetaWaitlist(userId, enabled);
    setWaitlistBusy(false);
    if (!res.ok) {
      setWaitlistError(res.error);
      return;
    }
    setProfile((p) => (p ? { ...p, beta_waitlist: enabled } : p));
    await onWaitlistUpdated({ approvedCount: res.approvedCount, maxBetaUsers: res.maxBetaUsers });
  }

  if (!userId) return null;

  const canApprove =
    profile &&
    (String(profile.beta_status ?? "").toLowerCase() === "pending" ||
      String(profile.beta_status ?? "").toLowerCase() === "rejected" ||
      String(profile.beta_status ?? "").toLowerCase() === "waitlist");

  const showWaitlistControls = Boolean(canApprove && betaAtCapacity);

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={() => !modalBusy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-profile-modal-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="beta-profile-modal-title" className="text-lg font-bold text-white">
            User profile
          </h2>
          <button
            type="button"
            disabled={modalBusy}
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            âœ•
          </button>
        </div>

        {betaAtCapacity && canApprove ? (
          <p className="mt-3 rounded-lg border border-amber-500/35 bg-amber-950/25 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100">
            Beta full â€” approve disabled
          </p>
        ) : null}

        {loading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loadingâ€¦
          </p>
        ) : fetchError ? (
          <p className="mt-4 text-sm text-red-300">{fetchError}</p>
        ) : profile ? (
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-0.5 text-slate-200">{profile.email?.trim() || "â€”"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</dt>
              <dd className="mt-0.5 text-slate-200">
                {profile.username?.trim() ? `@${profile.username.trim()}` : "â€”"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</dt>
              <dd className="mt-0.5 capitalize text-slate-200">{profile.role?.trim() || "user"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wallet</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-emerald-300">{formatMoney(profile.wallet)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Beta status</dt>
              <dd className="mt-0.5">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(profile.beta_status)}`}
                >
                  {profile.beta_status ?? "â€”"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Waitlist</dt>
              <dd className="mt-0.5 text-slate-200">
                {profile.beta_waitlist ? (
                  <span className="inline-flex rounded-full border border-sky-500/40 bg-sky-950/35 px-2 py-0.5 text-xs font-semibold text-sky-200">
                    Yes
                  </span>
                ) : (
                  <span className="text-slate-500">No</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</dt>
              <dd className="mt-0.5 whitespace-pre-wrap break-words text-slate-300">
                {profile.beta_notes?.trim() ? profile.beta_notes : <span className="text-slate-600">â€”</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created</dt>
              <dd className="mt-0.5 text-slate-400">{formatDate(profile.created_at)}</dd>
            </div>
          </dl>
        ) : null}

        {profile && canApprove ? (
          <div className="mt-6 space-y-3 border-t border-slate-800 pt-4">
            {approveError ? <p className="text-sm text-red-300">{approveError}</p> : null}
            <button
              type="button"
              disabled={approveBusy || betaAtCapacity}
              title={betaAtCapacity ? "Beta full â€” cannot approve" : undefined}
              onClick={() => void handleApprove()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-600/50 bg-emerald-950/50 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-emerald-100 hover:bg-emerald-950/70 disabled:pointer-events-none disabled:opacity-50"
            >
              {approveBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Approve
            </button>

            {showWaitlistControls ? (
              <div className="rounded-lg border border-sky-800/50 bg-sky-950/20 p-3">
                {waitlistError ? <p className="mb-2 text-sm text-red-300">{waitlistError}</p> : null}
                <p className="mb-2 text-xs text-sky-200/90">
                  Program is full â€” add this user to the waitlist without changing their beta status.
                </p>
                <button
                  type="button"
                  disabled={waitlistBusy}
                  onClick={() => void handleWaitlistToggle(!profile.beta_waitlist)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-sky-600/45 bg-sky-950/40 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-sky-100 hover:bg-sky-950/55 disabled:pointer-events-none disabled:opacity-50"
                >
                  {waitlistBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {profile.beta_waitlist ? "Remove from waitlist" : "Add to waitlist"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
