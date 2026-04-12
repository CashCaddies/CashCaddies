import { TierProgressBar } from "@/components/tier-progress-bar";
import type { ProfileRow } from "@/lib/wallet";
import { formatMoney, tierBadgeClass } from "@/lib/wallet";

export function WalletSummaryCards({
  wallet,
  loading,
  error,
}: {
  wallet: ProfileRow | null;
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="goldCard animate-pulse p-5">
            <div className="h-3 w-24 rounded bg-slate-700" />
            <div className="mt-3 h-8 w-20 rounded bg-slate-700" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
        Beta Wallet: {error}
      </p>
    );
  }

  if (!wallet) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-white">Beta Wallet</h2>
      <p className="text-sm text-slate-400">Testing funds only</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="goldCard p-5">
          <p className="text-sm font-medium text-slate-400">Account balance</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{formatMoney(wallet.account_balance)}</p>
        </div>
        <div className="goldCard border-emerald-900/40 p-5">
          <p className="text-sm font-medium text-slate-400">Safety Coverage credit</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-200">
            {formatMoney(wallet.protection_credit_balance ?? 0)}
          </p>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Used before cash on contest entry · not withdrawable
          </p>
        </div>
        <div className="goldCard p-5">
          <p className="text-sm font-medium text-slate-400">Site credits</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">{formatMoney(wallet.site_credits)}</p>
        </div>
        <div className="goldCard p-5">
          <p className="text-sm font-medium text-slate-400">Loyalty points</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{wallet.loyalty_points.toLocaleString()}</p>
        </div>
        <div className="goldCard p-5">
          <p className="text-sm font-medium text-slate-400">Tier status</p>
          <p className="mt-3">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ${tierBadgeClass(wallet.loyalty_tier)}`}
            >
              {wallet.loyalty_tier}
            </span>
          </p>
        </div>
      </div>

      <div className="goldCard p-5">
        <TierProgressBar points={wallet.loyalty_points} />
      </div>
    </div>
  );
}
