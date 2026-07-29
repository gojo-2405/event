import type { AuthRole, PermissionAction } from "@eventrax/contracts";

import { getPermissionsForRole } from "../../domain/roles/role-matrix.js";

export function resolvePermissions(role: AuthRole): PermissionAction[] {
  return getPermissionsForRole(role);
}

export function canPerform(role: AuthRole, action: PermissionAction): boolean {
  return resolvePermissions(role).includes(action);
}
