"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { runFullPayout, type RunFullPayoutResult } from "@/app/(protected)/admin/settlement/run-full-payout";

type Props = {
  contestId: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-emerald-600/60 bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-50"
    >
      {pending ? "Running…" : "Run full payout"}
    </button>
  );
}

export default function AdminTriggerPayout({ contestId }: Props) {
  const [result, setResult] = useState<RunFullPayoutResult | null>(null);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="text-sm font-semibold text-white">Full payout pipeline</h3>
      <p className="mt-1 text-xs text-slate-400">
        Runs <span className="font-mono text-slate-300">settle_contest_prizes</span> →{" "}
        <span className="font-mono text-slate-300">calculate_contest_financials</span> →{" "}
        <span className="font-mono text-slate-300">run_contest_payouts</span> →{" "}
        <span className="font-mono text-slate-300">credit_contest_winnings</span>, then marks the contest settled.
      </p>
      <form
        className="mt-4 space-y-3"
        action={async (fd) => {
          setResult(null);
          const r = await runFullPayout(fd);
          setResult(r);
        }}
      >
        <input type="hidden" name="contestId" value={contestId} />
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Admin secret
          <input
            name="adminSecret"
            type="password"
            autoComplete="off"
            required
            className="mt-1 w-full max-w-md rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="ADMIN_SCORING_SECRET"
          />
        </label>
        <SubmitButton />
      </form>
      {result ? (
        <div className="mt-4 space-y-2">
          <p
            className={`rounded-lg border px-4 py-3 text-sm ${
              result.ok
                ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-100"
                : "border-red-800/50 bg-red-950/30 text-red-200"
            }`}
          >
            {result.ok ? (
              <>Full payout completed for contest <span className="font-mono">{result.contestId}</span>.</>
            ) : (
              <>
                <span className="font-mono text-slate-300">{result.step}</span>: {result.error}
              </>
            )}
          </p>
          <pre className="max-h-64 overflow-auto text-xs whitespace-pre-wrap break-all rounded-lg border border-slate-800 bg-black p-3 text-green-400">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
