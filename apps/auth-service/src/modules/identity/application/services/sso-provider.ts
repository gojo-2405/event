import type { ExternalIdentity } from "../../domain/value-objects/external-identity.js";

export interface SsoProvider {
  exchangeCodeForIdentity(code: string): Promise<ExternalIdentity>;
}
