/**
 * Legacy env flag (some admin-only tooling may still read it).
 * Contest entry debits `profiles.account_balance` via `create_contest_entry_atomic` for all paid flows.
 */
export const CONTEST_WALLET_BILLING_ENABLED = process.env.CONTEST_WALLET_BILLING_ENABLED === "true";
