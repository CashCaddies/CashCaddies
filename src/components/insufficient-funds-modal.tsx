"use client";

import Link from "next/link";
import { useEffect } from "react";
import { formatMoney } from "@/lib/wallet";

type Props = {
  open: boolean;
  onClose: () => void;
  balanceUsd: number;
  requiredUsd: number;
  contestName?: string;
};

export function InsufficientFundsModal({ open, onClose, balanceUsd, requiredUsd, contestName }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const shortfall = Math.max(0, requiredUsd - balanceUsd);

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insufficient-funds-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-amber-500/35 bg-slate-950 p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="insufficient-funds-title" className="text-xl font-bold text-white">
          Insufficient funds
        </h2>
        {contestName ? (
          <p className="mt-2 text-sm text-slate-400">
            <span className="text-slate-300">{contestName}</span>
          </p>
        ) : null}
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          Your balance ({formatMoney(balanceUsd)}) is below the cost to enter ({formatMoney(requiredUsd)}).
          {shortfall > 0 ? (
            <>
              {" "}
              You need <span className="font-semibold text-amber-200">{formatMoney(shortfall)}</span> more.
            </>
          ) : null}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Close
          </button>
          <Link
            href="/wallet"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-yellow-500/55 bg-gradient-to-b from-yellow-500/35 to-yellow-700/20 px-5 py-2.5 text-center text-sm font-bold text-[#fff8dc] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:border-yellow-400/70"
          >
            Deposit
          </Link>
        </div>
      </div>
    </div>
  );
}
