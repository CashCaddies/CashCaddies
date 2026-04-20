import { tierFromPoints } from "@/lib/loyalty";

/** Wallet + loyalty fields from `public.profiles` (id = auth user id). */
export type ProfileRow = {
  /** DFS leaderboard handle (lowercase). */
  username: string;
  /** Closed beta access flag. */
  beta_user?: boolean;
  /** Waitlist interest (profiles.beta_waitlist). */
  beta_waitlist?: boolean;
  /** Beta product access (profiles.beta_access). */
  beta_access?: boolean;
  /** Advanced DFS tools (tee waves, ownership); admin-granted. */
  is_beta_tester?: boolean;
  /** Stripe current period end (ISO); paid premium active while in the future. */
  premium_expires_at?: string | null;
  /** Beta admin tooling; optional until loaded from profiles. */
  founding_tester?: boolean;
  /** Set on `public.profiles.is_founder`. */
  is_founder?: boolean;
  /** Canonical role field — use `isAdmin(role)` from `@/lib/permissions` for access. */
  role?: string | null;
  /** From `public.profiles.beta_status` (not auth metadata). */
  beta_status?: string | null;
  /** Public URL for profile image (Storage `avatars` bucket). */
  avatar_url?: string | null;
  account_balance: number;
  /** Same as account_balance when column exists (migration 038). */
  wallet_balance?: number;
  /** Community Protection Credit — spendable on contest entry before cash; not withdrawable. */
  protection_credit_balance?: number;
  site_credits: number;
  loyalty_points: number;
  loyalty_tier: string;
};

/** @deprecated Use ProfileRow */
export type UserWalletRow = ProfileRow;

export function normalizeProfileRow(row: {
  username?: string | null;
  beta_user?: boolean | null;
  beta_waitlist?: boolean | null;
  beta_access?: boolean | null;
  is_beta_tester?: boolean | null;
  premium_expires_at?: string | null;
  beta_status?: string | null;
  founding_tester?: boolean | null;
  is_founder?: boolean | null;
  role?: string | null;
  avatar_url?: string | null;
  account_balance?: number | string | null;
  wallet_balance?: number | string | null;
  protection_credit_balance?: number | string | null;
  site_credits?: number | string | null;
  loyalty_points?: number | null;
  loyalty_tier?: string | null;
}): ProfileRow {
  const loyaltyPoints = Math.floor(Number(row.loyalty_points ?? 0));
  const bal = Number(row.account_balance ?? 0);
  const wb =
    row.wallet_balance != null && row.wallet_balance !== ""
      ? Number(row.wallet_balance)
      : bal;
  const pc =
    row.protection_credit_balance != null && row.protection_credit_balance !== ""
      ? Number(row.protection_credit_balance)
      : 0;
  return {
    username: typeof row.username === "string" && row.username.trim() !== "" ? row.username.trim() : "",
    beta_user: row.beta_user === true,
    beta_waitlist: row.beta_waitlist === true,
    beta_access: row.beta_access === true,
    is_beta_tester: row.is_beta_tester === true,
    premium_expires_at:
      typeof row.premium_expires_at === "string" && row.premium_expires_at.trim() !== ""
        ? row.premium_expires_at.trim()
        : row.premium_expires_at === null
          ? null
          : undefined,
    beta_status: typeof row.beta_status === "string" ? row.beta_status : null,
    founding_tester: row.founding_tester === true,
    is_founder: row.is_founder === true,
    role: typeof row.role === "string" ? row.role : null,
    avatar_url: typeof row.avatar_url === "string" && row.avatar_url.trim() !== "" ? row.avatar_url.trim() : null,
    account_balance: bal,
    wallet_balance: Number.isFinite(wb) ? wb : bal,
    protection_credit_balance: Number.isFinite(pc) ? Math.max(0, pc) : 0,
    site_credits: Number(row.site_credits ?? 0),
    loyalty_points: loyaltyPoints,
    loyalty_tier: tierFromPoints(loyaltyPoints),
  };
}

/** @deprecated Use normalizeProfileRow */
export const normalizeWalletRow = normalizeProfileRow;

export function formatMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function tierBadgeClass(tier: string): string {
  const t = tier.toLowerCase();
  if (t.includes("platinum")) return "bg-violet-500/20 text-violet-200 ring-violet-500/40";
  if (t.includes("gold")) return "bg-amber-500/20 text-amber-200 ring-amber-500/40";
  if (t.includes("silver")) return "bg-slate-400/20 text-slate-200 ring-slate-400/35";
  return "bg-orange-900/40 text-orange-200 ring-orange-600/40";
}
