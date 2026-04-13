"use client";

import { useState } from "react";
import { runProtectionEngineV1 } from "@/app/admin/settlement/protection-engine-actions";

type Contest = { id: string; name: string };

export function AdminProtectionEngineForm({ contests }: { contests: Contest[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="max-w-xl space-y-3"
      action={async (fd) => {
        setPending(true);
        setErr(null);
        setMsg(null);
        const r = await runProtectionEngineV1(fd);
        setPending(false);
        if (r.ok) {
          setMsg(
            `Swap marked: ${r.swapMarked}; protection applied: ${r.protectionApplied}; skipped: ${r.skipped}.`,
          );
        } else {
          setErr(r.error);
        }
      }}
    >
      <h2 className="text-lg font-semibold text-white">CashCaddies Safety Coverage engine (WD / DNS / DQ)</h2>
      <p className="text-sm text-[#8b98a5]">
        Marks <span className="text-[#c5cdd5]">swap_available</span> when replacements exist; otherwise credits{" "}
        <span className="text-[#c5cdd5]">protection_credit_balance</span> from the Safety Coverage fund.
      </p>
      <label className="block text-sm text-[#c5cdd5]">
        Contest
        <div className="relative z-0">
          <select
            name="contestId"
            required
            className="mt-1 w-full relative z-0 rounded border border-[#2a3039] bg-[#141920] px-3 py-2 text-white"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {contests.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </label>
      <label className="block text-sm text-[#c5cdd5]">
        Admin secret
        <input
          type="password"
          name="adminSecret"
          required
          autoComplete="off"
          className="mt-1 w-full rounded border border-[#2a3039] bg-[#141920] px-3 py-2 text-white"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Running…" : "Run protection engine"}
      </button>
      {msg ? <p className="text-sm text-emerald-200">{msg}</p> : null}
      {err ? <p className="text-sm text-red-300">{err}</p> : null}
    </form>
  );
}
