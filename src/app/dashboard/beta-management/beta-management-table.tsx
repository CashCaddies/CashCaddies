"use client";

import { useEffect, useState, useTransition } from "react";
import { approveBetaUser, toggleFoundingTester } from "@/app/dashboard/beta-management/actions";
import { FoundingStarIcon, FoundingStarOutlineIcon } from "@/components/founding-star-icon";

export type BetaProfileRow = {
  id: string;
  username: string | null;
  email: string | null;
  /** auth.users.email || profiles.email — resolved on server for display. */
  displayEmail: string;
  beta_user: boolean;
  beta_status: string;
  founding_tester: boolean;
  updated_at: string | null;
};

function statusBadgeClass(statusRaw: string): string {
  const s = statusRaw.trim().toLowerCase();
  if (s === "approved") {
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
  }
  if (s === "active") {
    return "border-sky-500/40 bg-sky-500/15 text-sky-200";
  }
  if (s === "pending") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-100";
  }
  return "border-slate-600/60 bg-slate-800/80 text-slate-300";
}

type Props = {
  pendingRows: BetaProfileRow[];
  approvedRows: BetaProfileRow[];
};

function UserTable({
  rows,
  showApprove,
  emptyLabel,
}: {
  rows: BetaProfileRow[];
  showApprove: boolean;
  emptyLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    if (!successToast) {
      return;
    }
    const t = window.setTimeout(() => setSuccessToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [successToast]);

  return (
    <>
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
          aria-labelledby="beta-approve-confirm-title"
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
              id="beta-approve-confirm-title"
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
                  setPendingId(id);
                  startTransition(async () => {
                    const r = await approveBetaUser(id);
                    setPendingId(null);
                    if (!r.ok) {
                      setError(r.error);
                      return;
                    }
                    setConfirmApproveId(null);
                    setSuccessToast("User approved");
                  });
                }}
              >
                {isPending ? "Approving…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-100" role="alert">
          {error}
        </p>
      ) : null}

      <div className="goldCard goldCardStatic overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Beta users</caption>
          <thead>
            <tr className="border-b border-slate-800 text-xs font-semibold tracking-wide text-slate-400">
              <th className="px-4 py-3.5">Handle</th>
              <th className="px-4 py-3.5">Email</th>
              <th className="px-4 py-3.5">Beta</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Founding</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const busy =
                  (isPending && pendingId === row.id) ||
                  (confirmApproveId === row.id && isPending);
                const emailShow = row.displayEmail?.trim();
                return (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-slate-950/90"
                  >
                    <td className="px-4 py-3.5 font-semibold text-white">
                      {row.username?.trim() ? `@${row.username}` : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      {emailShow ? (
                        <span className="text-slate-200">{emailShow}</span>
                      ) : (
                        <span className="text-slate-500">No email</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-300">{row.beta_user ? "Yes" : "No"}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(row.beta_status)}`}
                      >
                        {row.beta_status || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-amber-300/95">
                      <span className="inline-flex items-center justify-center" title="Founding Member">
                        {row.founding_tester ? (
                          <FoundingStarIcon className="h-5 w-5 text-amber-400" />
                        ) : (
                          <FoundingStarOutlineIcon className="h-5 w-5 text-slate-500" />
                        )}
                        <span className="sr-only">{row.founding_tester ? "Founding member" : "Not a founding member"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {showApprove ? (
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                            onClick={() => {
                              setError(null);
                              setConfirmApproveId(row.id);
                            }}
                          >
                            Approve Beta Access
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          className="inline-flex min-h-[2rem] min-w-[2rem] items-center justify-center rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 hover:border-amber-500/50 hover:bg-slate-900 disabled:opacity-40"
                          title="Founding Member"
                          aria-pressed={row.founding_tester}
                          aria-label="Toggle founding member"
                          onClick={() => {
                            setError(null);
                            setPendingId(row.id);
                            startTransition(async () => {
                              const r = await toggleFoundingTester(row.id);
                              setPendingId(null);
                              if (!r.ok) {
                                setError(r.error);
                                return;
                              }
                            });
                          }}
                        >
                          {row.founding_tester ? (
                            <FoundingStarIcon className="h-5 w-5 text-amber-400" />
                          ) : (
                            <FoundingStarOutlineIcon className="h-5 w-5 text-slate-500" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function BetaManagementTable({ pendingRows, approvedRows }: Props) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Pending Users</h2>
        <UserTable
          rows={pendingRows}
          showApprove
          emptyLabel="No pending users yet."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Approved Users</h2>
        <UserTable
          rows={approvedRows}
          showApprove={false}
          emptyLabel="No approved users yet"
        />
      </section>
    </div>
  );
}
