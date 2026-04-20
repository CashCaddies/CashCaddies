"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const QUICK_AMOUNTS = [10, 25, 50, 100] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after validation; should persist account_balance and return true on success. */
  onConfirm: (amount: number) => Promise<boolean>;
  busy?: boolean;
};

export function WalletModal({ open, onClose, onConfirm, busy }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [amountInput, setAmountInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setAmountInput("");
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const parsed = Number.parseFloat(amountInput.replace(/,/g, ""));
  const valid = Number.isFinite(parsed) && parsed > 0;

  async function handleConfirm() {
    setError(null);
    if (!valid) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    const ok = await onConfirm(parsed);
    if (ok) {
      reset();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px] pointer-events-auto"
        aria-label="Close deposit dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md rounded-2xl border border-yellow-500/25 bg-slate-950/95 p-6 shadow-[0_0_48px_rgba(212,175,55,0.15)] pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-bold text-white">
          Deposit funds
        </h2>
        <p className="mt-1 text-sm text-slate-500">Test deposit — no payment processing yet.</p>

        <label className="mt-6 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Amount (USD)
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amountInput}
            disabled={busy}
            onChange={(e) => setAmountInput(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-base font-semibold tabular-nums text-white outline-none ring-yellow-500/30 placeholder:text-slate-600 focus:border-yellow-500/45 focus:ring-2 disabled:opacity-50"
          />
        </label>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Quick select</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() => {
                setAmountInput(String(n));
                setError(null);
              }}
              className="rounded-lg border border-yellow-500/35 bg-yellow-500/10 px-2 py-2.5 text-sm font-semibold text-[#ffe066] transition hover:border-yellow-400/55 hover:bg-yellow-500/15 disabled:opacity-40"
            >
              ${n}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-slate-600 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => void handleConfirm()}
            className="rounded-xl border border-yellow-500/50 bg-gradient-to-b from-yellow-500/30 to-yellow-700/15 px-5 py-3 text-sm font-semibold text-[#fff8dc] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:border-yellow-400/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Processing…" : "Confirm deposit"}
          </button>
        </div>
      </div>
    </div>
  );
}
