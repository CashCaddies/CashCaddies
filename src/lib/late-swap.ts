import { CONTEST_LIVE_AFTER_START_MS } from "@/lib/contest-state";

export type LateSwapContestMeta = {
  startsAtIso: string | null | undefined;
  lateSwapEnabled?: boolean | null;
  contestStatus?: string | null;
};

/** Matches SQL `contest_late_swap_live`: live phase (starts + 5m) and feature enabled. */
export function lateSwapWindowOpenForContest(meta: LateSwapContestMeta): boolean {
  if (meta.lateSwapEnabled === false) {
    return false;
  }
  const s = String(meta.contestStatus ?? "")
    .trim()
    .toLowerCase();
  if (s === "completed" || s === "settled" || s === "cancelled") {
    return false;
  }
  const t = Date.parse(String(meta.startsAtIso ?? ""));
  if (!Number.isFinite(t)) {
    return false;
  }
  return Date.now() >= t + CONTEST_LIVE_AFTER_START_MS;
}

/** User may open entry lineup editor when pre-start OR late-swap window. */
export function allowContestEntryLineupEdit(lineupLockedByStart: boolean, lateSwapOpen: boolean): boolean {
  return !lineupLockedByStart || lateSwapOpen;
}

export const LATE_SWAP_HEADER_NOTICE =
  "Late Swap Active – Players lock individually at game start.";

export function playerSlotLockCountdownLabel(gameStartTimeIso: string | null | undefined, nowMs?: number): string | null {
  if (gameStartTimeIso == null || String(gameStartTimeIso).trim() === "") {
    return null;
  }
  const t = Date.parse(String(gameStartTimeIso));
  if (!Number.isFinite(t)) {
    return null;
  }
  const now = nowMs ?? Date.now();
  const sec = Math.max(0, Math.ceil((t - now) / 1000));
  if (sec <= 0) {
    return null;
  }
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `Locks in ${m}:${s.toString().padStart(2, "0")}`;
}
