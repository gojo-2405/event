import type { AuthRole, PermissionAction, SessionClaims } from "@eventrax/contracts";

export type AuthContext = SessionClaims & {
  permissions: PermissionAction[];
};

export function createAuthContext(claims: SessionClaims): AuthContext {
  return {
    ...claims,
    permissions: claims.permissions
  };
}

export function hasPermission(context: AuthContext, action: PermissionAction): boolean {
  return context.permissions.includes(action);
}

export function hasRole(context: AuthContext, role: AuthRole): boolean {
  return context.role === role;
}
