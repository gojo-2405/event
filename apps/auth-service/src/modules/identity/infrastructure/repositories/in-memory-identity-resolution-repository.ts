import type { AuthRole } from "@eventrax/contracts";

import type { IdentityResolutionRepository } from "../../domain/repositories/identity-resolution-repository.js";
import type { ResolvedIdentity } from "../../domain/entities/resolved-identity.js";
import type { ExternalIdentity } from "../../domain/value-objects/external-identity.js";

type InMemoryIdentityRecord = {
  email?: string;
  role: AuthRole;
  ssoSubject: string;
  tenantId: string;
  userId: string;
};

export class InMemoryIdentityResolutionRepository implements IdentityResolutionRepository {
  constructor(private readonly records: InMemoryIdentityRecord[]) {}

  async resolveFromExternalIdentity(identity: ExternalIdentity): Promise<ResolvedIdentity | null> {
    const match = this.records.find((record) => {
      if (record.ssoSubject === identity.ssoSubject) {
        return true;
      }

      return Boolean(record.email && identity.email && record.email === identity.email);
    });

    return match ?? null;
  }
}
