/** User-facing copy for fee protection (untouched lineup before lock). */

export const ENTRY_PROTECTED_BADGE = "ENTRY PROTECTED";

export const ENTRY_PROTECTED_TOOLTIP =
  "Your entry fee is protected if you did not modify your lineup before lock. At settlement, that entry fee is refunded — you can still win prizes, with no downside on the fee.";

export const ENTRY_PROTECTED_SHORT =
  "Entry fee protected — no lineup changes before lock; fee refunded at settlement.";

export type EntryProtectionFields = {
  entry_protected?: boolean | null;
  lineup_edited?: boolean | null;
  lock_timestamp?: string | null;
  entry_protection_forced?: boolean | null;
};

export function isEntryFeeProtected(row: EntryProtectionFields): boolean {
  return Boolean(row.entry_protected);
}
