/** Allowed `profiles.role` values for general admin tooling (server + optional client UI hints). */
export const ADMIN_ROLES = ["admin", "senior_admin", "founder"] as const;

/** Roles that can run senior-only operations (role changes, global caps, etc.). */
export const SENIOR_ADMIN_ROLES = ["senior_admin", "founder"] as const;

export function normalizeRole(role: string | null | undefined): string {
  return String(role ?? "")
    .toLowerCase()
    .trim();
}

export function isAdminRole(role: string | null | undefined): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(normalizeRole(role));
}

export function isSeniorAdminRole(role: string | null | undefined): boolean {
  return (SENIOR_ADMIN_ROLES as readonly string[]).includes(normalizeRole(role));
}
