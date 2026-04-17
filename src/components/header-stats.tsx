"use client";

import Link from "next/link";
import { useWallet } from "@/hooks/use-wallet";
import { formatMoney } from "@/lib/wallet";

/** Wallet chip in header right rail (with account). Fund strip is `HeaderFundBar`. */
export function HeaderStats() {
  const { wallet, loading: walletLoading } = useWallet();

  const accountBalanceUsd =
    walletLoading || !wallet ? null : Number(wallet.wallet_balance ?? wallet.account_balance);

  const walletDisplay = walletLoading ? "…" : accountBalanceUsd != null ? formatMoney(accountBalanceUsd) : "—";

  return (
    <div className="headerStats">
      <Link
        href="/wallet"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-semibold text-sm transition hover:bg-yellow-500/15"
        prefetch
        title="Open wallet"
        aria-label={`Wallet, account balance ${walletDisplay}. Open wallet.`}
      >
        <span className="text-yellow-400/90">Wallet</span>
        <span className="font-semibold tabular-nums text-yellow-300">{walletDisplay}</span>
      </Link>
    </div>
  );
}
