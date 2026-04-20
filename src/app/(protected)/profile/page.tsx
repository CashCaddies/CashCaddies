"use client";

import Link from "next/link";
import { useWallet } from "@/hooks/use-wallet";
import { formatMoney } from "@/lib/wallet";

export default function ProfilePage() {
  const { user, wallet, fullUser, loading, error } = useWallet();

  if (loading) {
    return <p className="p-6 text-slate-400">Loading…</p>;
  }

  if (!user) {
    return (
      <p className="p-6 text-slate-300">
        <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
          Sign in
        </Link>{" "}
        to view your profile.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Profile</h1>

      {error ? (
        <p className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-amber-200">{error}</p>
      ) : null}

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-400">Email</dt>
            <dd className="mt-1 text-slate-100">{user.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Username</dt>
            <dd className="mt-1 text-slate-100">{wallet?.username ? `@${wallet.username}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Role</dt>
            <dd className="mt-1 text-slate-100">{fullUser?.role ?? "user"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Beta Status</dt>
            <dd className="mt-1 text-slate-100">{wallet?.beta_status ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Wallet Balance</dt>
            <dd className="mt-1 font-semibold tabular-nums text-emerald-300">
              {formatMoney(wallet?.account_balance ?? 0)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
