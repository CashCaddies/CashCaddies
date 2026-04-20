"use client";

import { adminToggleEntryProtectionForced } from "@/app/(protected)/admin/entry-protection/actions";
import {
  ENTRY_PROTECTED_BADGE,
  ENTRY_PROTECTED_TOOLTIP,
  isEntryFeeProtected,
  type EntryProtectionFields,
} from "@/lib/entry-protection";
import { useState } from "react";

export type ContestEntryCardProps = {
  id: string;
  contestId: string;
  index: number;
  userLabel: string;
  createdAtLabel: string;
  /** Admin sees all entries; non-admin typically one row */
  isAdmin?: boolean;
} & EntryProtectionFields;

export function ContestEntryCard({
  id,
  contestId,
  index,
  userLabel,
  createdAtLabel,
  isAdmin,
  entry_protected,
  lineup_edited,
  entry_protection_forced,
}: ContestEntryCardProps) {
  const [busy, setBusy] = useState(false);
  const protectedRow = isEntryFeeProtected({ entry_protected });

  async function onToggleForced(next: boolean) {
    setBusy(true);
    try {
      const r = await adminToggleEntryProtectionForced(contestId, id, next);
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-white">Entry #{index + 1}</p>
          <p className="mt-1 text-slate-300">
            <span className="text-slate-400">User:</span> {userLabel}
          </p>
          <p className="mt-1 text-slate-300">
            <span className="text-slate-400">Entered:</span> {createdAtLabel}
          </p>
        </div>
        {protectedRow ? (
          <span
            className="shrink-0 cursor-help rounded border border-sky-500/40 bg-sky-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-200"
            title={ENTRY_PROTECTED_TOOLTIP}
          >
            {ENTRY_PROTECTED_BADGE}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        <span className="text-slate-400">Lineup:</span> (Not revealed yet)
        {lineup_edited ? (
          <span className="ml-2 text-amber-200/90">· Edited before lock</span>
        ) : (
          <span className="ml-2 text-slate-500">· No edits after entry</span>
        )}
      </p>
      {isAdmin ? (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-600"
            checked={Boolean(entry_protection_forced)}
            disabled={busy}
            onChange={(e) => void onToggleForced(e.target.checked)}
          />
          <span>Force fee protection (admin)</span>
        </label>
      ) : null}
    </div>
  );
}
