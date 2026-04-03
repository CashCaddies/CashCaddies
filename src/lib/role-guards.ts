/**
 * Back-compat re-exports — canonical definitions live in `@/lib/permissions`.
 */

export type { AppPermission, ProfileRole } from "@/lib/permissions";
export {
  canChangeUserRoles,
  canManageAdminRoles,
  hasAdminDashboardAccess,
  hasPermission,
  hasSeniorAdminAccess,
  isAdmin,
  isSeniorAdmin,
  isSeniorAdminRoleLiteral,
  isStaffAdminRoleLiteral,
  normalizeProfileRole,
  rolePermissions,
} from "@/lib/permissions";
