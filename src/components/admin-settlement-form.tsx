"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { runContestSettlement, type RunContestSettlementResult } from "@/app/(protected)/admin/settlement/actions";

type Props = {
  contests: { id: string; name: string }[];
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-emerald-600/60 bg-emerald-900/40 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-50"
    >
      {pending ? "Settling…" : "Run settlement"}
    </button>
  );
}

export function AdminSettlementForm({ contests }: Props) {
  const [result, setResult] = useState<RunContestSettlementResult | null>(null);

  return (
    <form
      className="max-w-lg space-y-4"
      action={async (fd) => {
        setResult(null);
        const r = await runContestSettlement(fd);
        setResult(r);
      }}
    >
      <div>
        <label htmlFor="contestId" className="block text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">
          Contest
        </label>
        <div className="relative z-0">
          <select
            id="contestId"
            name="contestId"
            required
            className="mt-1 w-full relative z-0 rounded-lg border border-[#2a3039] bg-[#0f1419] px-3 py-2 text-sm text-white"
            defaultValue=""
          >
            <option value="" disabled>
              Choose contest…
            </option>
            {contests.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="adminSecret" className="block text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">
          Admin secret
        </label>
        <input
          id="adminSecret"
          name="adminSecret"
          type="password"
          autoComplete="off"
          required
          className="mt-1 w-full rounded-lg border border-[#2a3039] bg-[#0f1419] px-3 py-2 text-sm text-white"
          placeholder="ADMIN_SCORING_SECRET"
        />
      </div>
      <SubmitButton />
      {result && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            result.ok
              ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-100"
              : "border-red-800/50 bg-red-950/30 text-red-200"
          }`}
        >
          {result.ok ? (
            <>
              Settled <span className="font-mono">{result.contestId}</span>. Recorded prize pool $
              {result.prizePoolUsd.toFixed(2)}, {result.entryCount} entries (contest-level settlement only).
            </>
          ) : (
            result.error
          )}
        </p>
      )}
    </form>
  );
}
