"use client";

import { useState } from "react";
import { triggerAutoContestSettlement, type TriggerAutoContestSettlementResult } from "@/app/admin/settlement/auto-actions";

export function AdminTriggerSettlement() {
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<TriggerAutoContestSettlementResult | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold text-white">Trigger contest settlement</h2>
      <p className="mt-2 text-sm text-slate-400">
        Runs prize settlement on the <span className="text-slate-300">earliest eligible</span> contest: not yet
        settled, at least 3 days after start, with entries and payout structure. Pool uses{" "}
        <span className="text-slate-300">90%</span> of entry fees; credits winners via{" "}
        <span className="font-mono text-slate-400">settle_contest_prizes</span> (same as{" "}
        <a href="/admin/settlement" className="text-emerald-400 underline hover:text-emerald-300">
          Contest settlement
        </a>
        ).
      </p>
      <div className="mt-4 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Admin secret
          <input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="ADMIN_SCORING_SECRET"
          />
        </label>
        <button
          type="button"
          disabled={pending || !secret.trim()}
          onClick={() => {
            setPending(true);
            setResult(null);
            void (async () => {
              const r = await triggerAutoContestSettlement(secret.trim());
              setResult(r);
              setPending(false);
            })();
          }}
          className="rounded-lg border border-amber-600/60 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-950/55 disabled:opacity-50"
        >
          {pending ? "Settling…" : "Trigger Contest Settlement"}
        </button>
      </div>
      {result ? (
        <p
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            result.ok
              ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-100"
              : "border-red-800/50 bg-red-950/30 text-red-200"
          }`}
        >
          {result.ok ? (
            <>
              Settled <span className="font-semibold">{result.contestName}</span>. Pool $
              {result.prizePoolUsd.toFixed(2)}, {result.entryCount} entries, distributed $
              {result.distributedUsd.toFixed(2)} across {result.payoutCount} payout(s).
            </>
          ) : (
            result.error
          )}
        </p>
      ) : null}
    </div>
  );
}
