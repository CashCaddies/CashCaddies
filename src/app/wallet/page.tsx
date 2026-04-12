import Link from "next/link";
import { getUserWallet } from "@/lib/supabase/queries/getUserWallet";
import { formatMoney } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const { account_balance, transactions, userId } = await getUserWallet();

  if (!userId) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="text-slate-300">
          <Link href="/login" className="font-semibold text-emerald-400 underline hover:text-emerald-300">
            Sign in
          </Link>{" "}
          to view your wallet.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold text-white">Wallet</h1>

      <p className="mt-8 text-sm text-slate-500">Account balance</p>
      <p className="mt-1 text-4xl font-semibold tabular-nums text-white">{formatMoney(account_balance)}</p>

      <h2 className="mt-10 text-sm font-medium text-slate-400">Transactions</h2>

      {transactions.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No transactions yet</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-800 border-t border-slate-800">
          {transactions.map((t) => (
            <li key={t.id} className="py-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="tabular-nums text-slate-200">{formatMoney(t.amount)}</span>
                <span className="text-slate-500">{t.type ?? "—"}</span>
              </div>
              {t.description ? <p className="mt-1 text-slate-400">{t.description}</p> : null}
              <p className="mt-1 text-xs text-slate-600">
                {new Date(t.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
