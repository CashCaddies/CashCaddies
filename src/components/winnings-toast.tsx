"use client";

import { useEffect, useState } from "react";
import { WALLET_WINNINGS_EVENT, type WalletWinningsDetail } from "@/lib/wallet-bankroll-events";
import { formatMoney } from "@/lib/wallet";

/**
 * Listens for `WALLET_WINNINGS_EVENT` and shows a short bankroll toast (mounted under app providers).
 */
export function WinningsToast() {
  const [visible, setVisible] = useState(false);
  const [amountUsd, setAmountUsd] = useState(0);

  useEffect(() => {
    function onWin(e: Event) {
      const ce = e as CustomEvent<WalletWinningsDetail>;
      const amt = Number(ce.detail?.amountUsd ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) return;
      setAmountUsd(amt);
      setVisible(true);
      window.setTimeout(() => setVisible(false), 4200);
    }
    window.addEventListener(WALLET_WINNINGS_EVENT, onWin);
    return () => window.removeEventListener(WALLET_WINNINGS_EVENT, onWin);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 opacity-95"
      role="status"
    >
      <div className="rounded-xl border border-yellow-500/45 bg-slate-950/95 px-5 py-3 shadow-[0_0_32px_rgba(212,175,55,0.25)] backdrop-blur-sm">
        <p className="text-center text-sm font-semibold text-[#ffe066]">
          +{formatMoney(amountUsd)}{" "}
          <span className="font-medium text-slate-200">Winnings</span>
        </p>
      </div>
    </div>
  );
}
