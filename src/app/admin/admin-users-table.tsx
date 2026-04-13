"use client";

import { useState, useTransition } from "react";
import {
  grantBetaFunds,
  toggleAdmin,
  toggleBetaUser,
  toggleFoundingTester,
  toggleProfileIsBetaTester,
  toggleProfileIsPremium,
} from "@/app/admin/user-actions";
import { FounderBadge } from "@/components/founder-badge";
import { useWallet } from "@/hooks/use-wallet";
import { hasPermission } from "@/lib/permissions";

type AdminUserRow = {
  id: string;
  username: string | null;
  email: string | null;
  /** auth.users.email || profiles.email — resolved on server. */
  displayEmail: string;
  wallet_balance: number | null;
  beta_user: boolean | null;
  founding_tester: boolean | null;
  is_beta_tester: boolean | null;
  is_premium: boolean | null;
  role: string | null;
};

type Props = {
  users: AdminUserRow[];
};

function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AdminUsersTable({ users }: Props) {
  const { fullUser } = useWallet();
  const canToggleAdminRole = hasPermission(fullUser?.role, "manage_roles");
  const [statusByUser, setStatusByUser] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function setStatus(userId: string, message: string) {
    setStatusByUser((prev) => ({ ...prev, [userId]: message }));
  }

  function runAction(userId: string, action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(() => {
      void (async () => {
        const result = await action();
        if (result.ok) {
          setStatus(userId, result.message ?? "Updated.");
        } else {
          setStatus(userId, result.error ?? "Action failed.");
        }
      })();
    });
  }

  function onGrantFunds(userId: string) {
    const raw = window.prompt("Enter amount: 10, 50, or 100", "100");
    if (!raw) return;
    const amount = Number(raw.trim());
    if (!Number.isFinite(amount) || ![10, 50, 100].includes(amount)) {
      setStatus(userId, "Amount must be 10, 50, or 100.");
      return;
    }
    startTransition(() => {
      void (async () => {
        const result = await grantBetaFunds(userId, amount);
        if (result.ok) {
          const localTime = new Date(result.timestamp).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });
          setStatus(userId, `$${amount} beta funds granted • ${result.grant_count} total grants • ${localTime}`);
        } else {
          setStatus(userId, result.error ?? "Action failed.");
        }
      })();
    });
  }

  return (
    <div className="goldCard goldCardStatic mt-4 overflow-x-auto">
      <table className="w-full min-w-[1280px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-xs font-semibold tracking-wide text-slate-400">
            <th className="px-4 py-3.5">Handle</th>
            <th className="px-4 py-3.5">Email</th>
            <th className="px-4 py-3.5 text-right">Account balance</th>
            <th className="px-4 py-3.5 text-center">Beta</th>
            <th className="px-4 py-3.5 text-center">Founding</th>
            <th className="px-4 py-3.5 text-center">DFS β</th>
            <th className="px-4 py-3.5 text-center">Premium</th>
            <th className="px-4 py-3.5 text-center">Admin</th>
            <th className="px-4 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {users.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                No users found.
              </td>
            </tr>
          ) : (
            users.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-950/90">
                <td className="px-4 py-3.5 font-semibold text-white">
                  {row.username?.trim() ? `@${row.username.trim()}` : "—"}
                </td>
                <td className="px-4 py-3.5">
                  {row.displayEmail?.trim() ? (
                    <span className="text-slate-200">{row.displayEmail.trim()}</span>
                  ) : (
                    <span className="text-slate-500">No email</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums text-emerald-300">
                  {formatMoney(Number(row.wallet_balance ?? 0))}
                </td>
                <td className="px-4 py-3.5 text-center text-slate-300">{row.beta_user ? "Yes" : "No"}</td>
                <td className="px-4 py-3.5 text-center">
                  {row.founding_tester ? <FounderBadge className="mx-auto" /> : <span className="text-slate-600">—</span>}
                </td>
                <td className="px-4 py-3.5 text-center text-slate-300">{row.is_beta_tester ? "Yes" : "No"}</td>
                <td className="px-4 py-3.5 text-center text-slate-300">{row.is_premium ? "Yes" : "No"}</td>
                <td className="px-4 py-3.5 text-center text-slate-300">{row.role?.trim() ? row.role : "user"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => onGrantFunds(row.id)}
                      className="rounded border border-[#2d7a3a] bg-[#1f8a3b] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#249544] disabled:opacity-50"
                    >
                      Grant Beta Funds
                    </button>
                    {canToggleAdminRole ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => runAction(row.id, () => toggleAdmin(row.id))}
                        className="rounded border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                      >
                        Toggle Admin
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => runAction(row.id, () => toggleBetaUser(row.id))}
                      className="rounded border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                    >
                      Toggle Beta User
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => runAction(row.id, () => toggleFoundingTester(row.id))}
                      className="rounded border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                    >
                      Toggle Founding Tester
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => runAction(row.id, () => toggleProfileIsBetaTester(row.id))}
                      className="rounded border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
                    >
                      Toggle DFS beta
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => runAction(row.id, () => toggleProfileIsPremium(row.id))}
                      className="rounded border border-amber-800/60 bg-amber-950/50 px-2.5 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-950/70 disabled:opacity-50"
                    >
                      Toggle Premium
                    </button>
                  </div>
                  {statusByUser[row.id] ? (
                    <p className="mt-2 text-right text-xs text-emerald-300">{statusByUser[row.id]}</p>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
