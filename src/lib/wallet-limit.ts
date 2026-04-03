/** Beta cap on `profiles.account_balance` (cash wallet) for credits: admin grants, prizes, refunds. */
export const BETA_MAX_WALLET = 5000;

export const WALLET_LIMIT_EXCEEDED_MESSAGE = "Wallet limit exceeded – contact admin";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Rejects credits that would raise account balance above {@link BETA_MAX_WALLET_USD}.
 * No-op for non-positive credit (caller still applies other wallet fields).
 */
export function assertAccountBalanceCreditAllowed(
  currentAccountBalance: number,
  creditUsd: number,
): { ok: true; nextBalance: number } | { ok: false; error: string } {
  const prev = round2(currentAccountBalance);
  const delta = round2(creditUsd);
  if (delta <= 0) {
    return { ok: true, nextBalance: prev };
  }
  const next = round2(prev + delta);
  if (next > BETA_MAX_WALLET + 1e-9) {
    return { ok: false, error: WALLET_LIMIT_EXCEEDED_MESSAGE };
  }
  return { ok: true, nextBalance: next };
}
