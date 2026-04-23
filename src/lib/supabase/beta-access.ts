import type { SupabaseClient } from "@supabase/supabase-js";
import { isProfileBetaApproved } from "@/lib/beta-profile-filters";
import { isAdmin } from "@/lib/permissions";

/** Shown when signup is blocked by DB allowlist trigger or login gate. */
export const CLOSED_BETA_ACCESS_MESSAGE =
  "CashCaddies is onboarding through a waitlist. To request access, email contact@cashcaddies.com";

/** `login?reason=` value when beta program access is denied (canonical: profiles.beta_status). */
export const BETA_STATUS_DENIED_QUERY = "beta_status";

function adminBypassEmailsFromEnv(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

const ADMIN_EMAILS = new Set<string>([
  "contact@cashcaddies.com",
  ...adminBypassEmailsFromEnv(),
]);

/** Legacy: email allowlist + dashboard/lobby (middleware now uses `isProfileBetaRequiredPath` + `profiles.beta_user`). */
export function isBetaProtectedPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/lobby" || pathname.startsWith("/lobby/");
}

/** Beta-gated DFS routes (middleware + server guards). */
export function isProfileBetaRequiredPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname === "/lobby" || pathname.startsWith("/lobby/")) return true;
  if (pathname === "/contest" || pathname.startsWith("/contest/")) return true;
  if (pathname === "/lineup" || pathname.startsWith("/lineup/")) return true;
  if (pathname === "/lineups" || pathname.startsWith("/lineups/")) return true;
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return true;
  if (pathname === "/wallet" || pathname.startsWith("/wallet/")) return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/lineup-builder" || pathname.startsWith("/lineup-builder/")) return true;
  return false;
}

/**
 * Returns whether `email` is on the closed beta allowlist (approved = true).
 * Uses RPC `is_approved_user`: with a user session, only the signed-in email may be checked;
 * with the service role client, any email may be checked.
 */
export async function isApprovedUser(supabase: SupabaseClient, email: string): Promise<boolean> {
  const trimmed = email.trim();
  if (!trimmed) return false;
  const { data, error } = await supabase.rpc("is_approved_user", { p_email: trimmed });
  if (error) return false;
  return Boolean(data);
}

/**
 * Whether the current JWT user is allowlisted (for server/middleware checks).
 */
export async function isCurrentUserBetaApproved(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("current_user_beta_approved");
  if (error) return false;
  return Boolean(data);
}

/**
 * Closed beta DFS access policy:
 * allow only approved beta users, with staff (`profiles.role` admin/senior_admin) bypass.
 */
export async function currentUserHasContestAccess(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return false;

  /**
   * DEV BYPASS:
   * Admin emails bypass beta restriction for development/testing.
   */
  const email = String(user.email ?? "").trim().toLowerCase();
  if (email && ADMIN_EMAILS.has(email)) {
    return true;
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("beta_user,beta_status,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) return false;

  return (
    isAdmin(profile?.role) ||
    isProfileBetaApproved({
      beta_user: profile?.beta_user,
      beta_status: profile?.beta_status,
    })
  );
}
