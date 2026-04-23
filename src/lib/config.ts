import type { SupabaseClient } from "@supabase/supabase-js";

/** Canonical `app_config` key for max approved beta users (`profiles.beta_status`). */
export const APP_CONFIG_KEY_MAX_BETA_USERS = "max_beta_users" as const;

/** Fallback when `max_beta_users` is missing or invalid in `app_config`. */
export const APP_CONFIG_DEFAULT_MAX_BETA_USERS = 20;

/**
 * Parse a stored config value as a non-negative integer.
 * Returns `fallback` when missing, empty, non-numeric, or negative.
 */
export function parseConfigNumber(raw: string | null | undefined, fallback: number): number {
  if (raw == null) return fallback;
  const s = String(raw).trim();
  if (s === "") return fallback;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

/**
 * Read a single `app_config` row by key using the given Supabase client.
 * Use the browser client (admin session) or service role on the server.
 */
export async function getConfig(key: string, client: SupabaseClient | null): Promise<string | null> {
  if (!client) return null;
  const { data, error } = await client.from("app_config").select("value").eq("key", key).maybeSingle();
  if (error || !data) return null;
  const v = (data as { value?: unknown }).value;
  return typeof v === "string" ? v : null;
}

export async function getMaxBetaUsersCap(client: SupabaseClient | null): Promise<number> {
  const raw = await getConfig(APP_CONFIG_KEY_MAX_BETA_USERS, client);
  return parseConfigNumber(raw, APP_CONFIG_DEFAULT_MAX_BETA_USERS);
}

/** Approved `profiles` with `beta_status = approved` and configured cap (`max_beta_users`). */
export async function getBetaCapacitySnapshot(
  client: SupabaseClient,
): Promise<{ approvedCount: number; maxBetaUsers: number }> {
  const maxBetaUsers = await getMaxBetaUsersCap(client);
  const { count, error } = await client
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("beta_status", "approved");
  const approvedCount = error ? 0 : Number(count ?? 0);
  return { approvedCount, maxBetaUsers };
}
