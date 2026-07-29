import type { AuthRole } from "@eventrax/contracts";

export type ResolvedIdentity = {
  email?: string;
  role: AuthRole;
  ssoSubject: string;
  tenantId: string;
  userId: string;
};
