"use client";

import { useState, useTransition } from "react";
import {
  submitProtectionClaim,
  type ProtectionResolution,
} from "@/app/dashboard/protection/actions";
import type { InsuranceClaimRow } from "@/hooks/use-insurance-claims";

function ClaimStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "approved"
      ? "bg-emerald-500/20 text-emerald-200 ring-emerald-500/40"
      : s === "denied"
        ? "bg-red-500/20 text-red-200 ring-red-500/40"
        : "bg-amber-500/20 text-amber-200 ring-amber-500/40";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${cls}`}>
      {status}
    </span>
  );
}

export function ProtectionClaimControls({
  lineupId,
  golferId,
  golferName,
  contestLabel,
  claim,
  onSubmitted,
}: {
  lineupId: string;
  golferId: string;
  golferName: string;
  contestLabel: string;
  claim: InsuranceClaimRow | undefined;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState<ProtectionResolution>("swap");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const showClaimButton = !claim || claim.status === "denied";

  function onSubmit() {
    setMessage("");
    startTransition(async () => {
      const result = await submitProtectionClaim({ lineupId, golferId, resolution });
      if (result.ok) {
        setOpen(false);
        onSubmitted();
        return;
      }
      setMessage(result.error);
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-200/90">Withdrawn · Protected</p>
          <p className="text-sm text-slate-200">
            <span className="font-semibold text-white">{golferName}</span>
            <span className="text-slate-500"> · {contestLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {claim && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Claim</span>
              <ClaimStatusBadge status={claim.status} />
              <span className="text-xs text-slate-500">
                {claim.claim_type === "swap"
                  ? "Swap before lock"
                  : claim.claim_type === "refund_balance"
                    ? "Balance refund"
                    : "Site credit refund"}
                {claim.refund_amount_usd != null && Number(claim.refund_amount_usd) > 0 ? (
                  <span className="text-slate-600"> · ${Number(claim.refund_amount_usd).toFixed(2)}</span>
                ) : null}
              </span>
            </div>
          )}
          {showClaimButton && (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setMessage("");
              }}
              className="rounded-md border border-amber-500/60 bg-amber-600/30 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-100 hover:bg-amber-600/50"
            >
              Claim CashCaddies Safety Coverage
            </button>
          )}
        </div>
      </div>

      {claim?.status === "denied" && (
        <p className="mt-2 text-xs text-slate-500">Previous claim was denied. You may submit a new claim.</p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="protection-claim-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="protection-claim-title" className="text-lg font-bold text-white">
              CashCaddies Safety Coverage claim
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {golferName} withdrew. Choose how you want to use your protection.
            </p>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3 has-[:checked]:border-emerald-500/50">
                <input
                  type="radio"
                  name="resolution"
                  checked={resolution === "swap"}
                  onChange={() => setResolution("swap")}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-white">Swap golfer before lock</p>
                  <p className="text-xs text-slate-500">Replace this player with another from the pool before the contest locks.</p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3 has-[:checked]:border-emerald-500/50">
                <input
                  type="radio"
                  name="resolution"
                  checked={resolution === "refund_credit"}
                  onChange={() => setResolution("refund_credit")}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-white">Site credits (entry fee)</p>
                  <p className="text-xs text-slate-500">
                    Adds the contest entry fee to <span className="font-medium text-slate-400">site credits</span>{" "}
                    when the server is configured (SUPABASE_SERVICE_ROLE_KEY). Otherwise the claim stays pending.
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3 has-[:checked]:border-emerald-500/50">
                <input
                  type="radio"
                  name="resolution"
                  checked={resolution === "refund_balance"}
                  onChange={() => setResolution("refund_balance")}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-white">Refund entry fee to account balance</p>
                  <p className="text-xs text-slate-500">
                    Returns the contest entry fee to your <span className="font-medium text-slate-400">cash</span>{" "}
                    balance (same service-role requirement as site credits).
                  </p>
                </div>
              </label>
            </div>
            {message && <p className="mt-3 text-sm text-red-300">{message}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onSubmit}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-500 disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Submit claim"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
