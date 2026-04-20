"use client";

import { useState, useTransition } from "react";
import { addDevTestFunds100 } from "@/app/(protected)/dashboard/dev-wallet-actions";

type Props = {
  onSuccess: () => void;
};

/** Renders nothing in production builds. */
export function DevTestFundsButton({ onSuccess }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-700/40 bg-amber-950/25 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-200/90">Development only</p>
      <p className="mt-1 text-sm text-amber-100/80">
        Adds $100 via <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">add_test_funds</code> with a{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">test_credit</code> ledger row. Enabled when{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">app_config.allow_test_wallet_funding</code> is{" "}
        <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">true</code>.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(() => {
            void (async () => {
              const r = await addDevTestFunds100();
              if (r.ok) {
                setMessage(`Account balance updated to ${r.accountBalance.toFixed(2)}.`);
                onSuccess();
                return;
              }
              setMessage(r.error);
            })();
          });
        }}
        className="mt-3 inline-flex items-center justify-center rounded-lg border border-amber-600/60 bg-amber-900/40 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-900/60 disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add $100 Test Funds"}
      </button>
      {message ? (
        <p className="mt-2 text-sm text-amber-100" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
