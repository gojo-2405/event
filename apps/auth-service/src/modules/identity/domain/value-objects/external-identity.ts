import type { AuthRole } from "@eventrax/contracts";

export type ExternalIdentity = {
  email?: string;
  firstName?: string;
  lastName?: string;
  provider: "mock" | "workos";
  roleHint?: AuthRole;
  ssoSubject: string;
  tenantIdHint?: string;
};
