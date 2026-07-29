import { authRoleSchema } from "@eventrax/contracts";

import { AuthenticationError } from "../../../../shared/errors/authentication-error.js";
import type { SsoProvider } from "../../application/services/sso-provider.js";
import type { ExternalIdentity } from "../../domain/value-objects/external-identity.js";

export class MockSsoProvider implements SsoProvider {
  async exchangeCodeForIdentity(code: string): Promise<ExternalIdentity> {
    if (!code.startsWith("mock:")) {
      throw new AuthenticationError("Unsupported mock authorization code");
    }

    const payload = code.slice("mock:".length).split("|");
    const [ssoSubject, email, tenantIdHint, roleHint] = payload;

    if (!ssoSubject) {
      throw new AuthenticationError("Mock authorization code is missing subject");
    }

    return {
      email: email || undefined,
      provider: "mock",
      roleHint: roleHint ? authRoleSchema.parse(roleHint) : undefined,
      ssoSubject,
      tenantIdHint: tenantIdHint || undefined
    };
  }
}
