import type { ExternalIdentity } from "../value-objects/external-identity.js";
import type { ResolvedIdentity } from "../entities/resolved-identity.js";

export interface IdentityResolutionRepository {
  resolveFromExternalIdentity(identity: ExternalIdentity): Promise<ResolvedIdentity | null>;
}
