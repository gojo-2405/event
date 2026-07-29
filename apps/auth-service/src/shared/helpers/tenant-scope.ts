import type { AuthContext } from "./auth-context.js";

import { hasPermission } from "./auth-context.js";

export function canBypassTenantScope(context: AuthContext): boolean {
  return hasPermission(context, "platform.override");
}

export function buildUserReadScope(context: AuthContext): { tenantId?: string } {
  if (canBypassTenantScope(context)) {
    return {};
  }

  return {
    tenantId: context.tenantId
  };
}
