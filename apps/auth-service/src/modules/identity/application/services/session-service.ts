import type { AuthRole, SessionClaims } from "@eventrax/contracts";

import { resolvePermissions } from "../../../authorization/application/services/authorization-service.js";

type BuildSessionClaimsInput = {
  email?: string;
  role: AuthRole;
  tenantId: string;
  userId: string;
};

export function buildSessionClaims(input: BuildSessionClaimsInput): SessionClaims {
  return {
    sub: input.userId,
    tenantId: input.tenantId,
    role: input.role,
    email: input.email,
    permissions: resolvePermissions(input.role)
  };
}
