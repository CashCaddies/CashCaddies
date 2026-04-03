"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { WALLET_BANKROLL_FLASH_EVENT, WALLET_WINNINGS_EVENT } from "@/lib/wallet-bankroll-events";
import { formatMoney } from "@/lib/wallet";

/** Wallet chip in header right rail (with account). Fund strip is `HeaderFundBar`. */
export function HeaderStats() {
  const { wallet, loading: walletLoading } = useWallet();
  const [deductFlash, setDeductFlash] = useState(false);
  const [winFlash, setWinFlash] = useState(false);

  useEffect(() => {
    function onFlash() {
      setDeductFlash(true);
      window.setTimeout(() => setDeductFlash(false), 700);
    }
    window.addEventListener(WALLET_BANKROLL_FLASH_EVENT, onFlash);
    return () => window.removeEventListener(WALLET_BANKROLL_FLASH_EVENT, onFlash);
  }, []);

  useEffect(() => {
    function onWin() {
      setWinFlash(true);
      window.setTimeout(() => setWinFlash(false), 900);
    }
    window.addEventListener(WALLET_WINNINGS_EVENT, onWin);
    return () => window.removeEventListener(WALLET_WINNINGS_EVENT, onWin);
  }, []);

  const walletBalanceUsd =
    walletLoading || !wallet ? null : Number(wallet.wallet_balance ?? wallet.account_balance);

  const walletDisplay = walletLoading ? "…" : walletBalanceUsd != null ? formatMoney(walletBalanceUsd) : "—";

  return (
    <div className="headerStats">
      <Link
        href="/wallet"
        className="walletStat"
        prefetch
        title="Open wallet"
        aria-label={`Wallet, balance ${walletDisplay}. Open wallet.`}
      >
        <span>Wallet</span>
        <b
          className={[deductFlash ? "walletStatAmountDeduct" : "", winFlash ? "walletStatAmountWin" : ""]
            .filter(Boolean)
            .join(" ") || undefined}
        >
          {walletDisplay}
        </b>
      </Link>
    </div>
  );
}
