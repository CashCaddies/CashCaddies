"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";
import { runContestInsurance, type RunContestInsuranceResult } from "@/app/(protected)/admin/settlement/insurance-actions";

type Props = {
  contests: { id: string; name: string }[];
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-sky-600/60 bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-900/60 disabled:opacity-50"
    >
      {pending ? "Processing…" : "Run insurance payouts"}
    </button>
  );
}

export function AdminInsuranceForm({ contests }: Props) {
  const [result, setResult] = useState<RunContestInsuranceResult | null>(null);

  return (
    <form
      className="max-w-lg space-y-4"
      action={async (fd) => {
        setResult(null);
        const r = await runContestInsurance(fd);
        setResult(r);
      }}
    >
      <div>
        <label htmlFor="insuranceContestId" className="block text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">
          Contest
        </label>
        <div className="relative z-0">
          <select
            id="insuranceContestId"
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
        <label htmlFor="insuranceAdminSecret" className="block text-xs font-semibold uppercase tracking-wide text-[#8b98a5]">
          Admin secret
        </label>
        <input
          id="insuranceAdminSecret"
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
              ? "border-sky-700/50 bg-sky-950/40 text-sky-100"
              : "border-red-800/50 bg-red-950/30 text-red-200"
          }`}
        >
          {result.ok ? (
            <>
              Insurance processed for <span className="font-mono">{result.contestId}</span>. Credited $
              {result.totalCreditedUsd.toFixed(2)} across {result.lineCount} ledger line(s).
            </>
          ) : (
            result.error
          )}
        </p>
      )}
    </form>
  );
}
