import type { SessionClaims } from "@eventrax/contracts";

import { AuthenticationError } from "../../../../shared/errors/authentication-error.js";
import { buildSessionClaims } from "./session-service.js";
import type { IdentityResolutionRepository } from "../../domain/repositories/identity-resolution-repository.js";
import type { SsoProvider } from "./sso-provider.js";

type HandleCallbackInput = {
  code: string;
  repository: IdentityResolutionRepository;
  ssoProvider: SsoProvider;
};

export async function handleAuthCallback(input: HandleCallbackInput): Promise<SessionClaims> {
  const externalIdentity = await input.ssoProvider.exchangeCodeForIdentity(input.code);
  const resolvedIdentity = await input.repository.resolveFromExternalIdentity(externalIdentity);

  if (!resolvedIdentity) {
    throw new AuthenticationError("No Eventrax user mapping found for this SSO identity");
  }

  return buildSessionClaims({
    email: resolvedIdentity.email,
    role: resolvedIdentity.role,
    tenantId: resolvedIdentity.tenantId,
    userId: resolvedIdentity.userId
  });
}
