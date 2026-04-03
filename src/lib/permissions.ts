/**
 * Permission matrix: roles stay in `public.profiles.role`; capabilities are defined in code.
 */

export type ProfileRole = "user" | "admin" | "senior_admin" | "founder";

export type AppPermission =
  | "view_admin_dashboard"
  | "manage_contests"
  | "manage_users"
  | "manage_admins"
  | "manage_roles"
  | "approve_beta"
  | "view_financials"
  | "system_settings";

export const rolePermissions: Record<ProfileRole, readonly AppPermission[]> = {
  user: [],
  admin: [
    "view_admin_dashboard",
    "manage_contests",
    "manage_users",
    "approve_beta",
  ],
  senior_admin: [
    "view_admin_dashboard",
    "manage_contests",
    "manage_users",
    "manage_admins",
    "manage_roles",
    "approve_beta",
    "view_financials",
    "system_settings",
  ],
  founder: [
    "view_admin_dashboard",
    "manage_contests",
    "manage_users",
    "approve_beta",
  ],
} as const;

export function normalizeProfileRole(raw: string | null | undefined): ProfileRole {
  const r = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (r === "senior_admin" || r === "super_admin") return "senior_admin";
  if (r === "admin") return "admin";
  if (r === "founder") return "founder";
  return "user";
}

export function hasPermission(
  role: string | null | undefined,
  permission: AppPermission,
): boolean {
  const key = normalizeProfileRole(role);
  return rolePermissions[key].includes(permission);
}

/**
 * Staff admin access: `admin`, `senior_admin` (and DB aliases `super_admin`), and `founder`.
 * Prefer this over raw string checks — handles case and whitespace in `profiles.role`.
 */
export function isAdmin(role: string | null | undefined): boolean {
  const r = normalizeProfileRole(role);
  return r === "admin" || r === "senior_admin" || r === "founder";
}

/** Senior-only tier: `profiles.role === 'senior_admin'` (normalized). */
export function isSeniorAdmin(role: string | null | undefined): boolean {
  return normalizeProfileRole(role) === "senior_admin";
}

/** Literal `admin` role only (not `senior_admin`). */
export function isStaffAdminRoleLiteral(role: string | null | undefined): boolean {
  return normalizeProfileRole(role) === "admin";
}

export function isSeniorAdminRoleLiteral(role: string | null | undefined): boolean {
  return isSeniorAdmin(role);
}

export function hasAdminDashboardAccess(role: string | null | undefined): boolean {
  return isAdmin(role);
}

export function hasSeniorAdminAccess(role: string | null | undefined): boolean {
  return isSeniorAdmin(role);
}

export function canManageAdminRoles(role: string | null | undefined): boolean {
  return hasPermission(role, "manage_roles");
}

export function canChangeUserRoles(role: string | null | undefined): boolean {
  return hasPermission(role, "manage_roles");
}
