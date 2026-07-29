import { sessionClaimsSchema, type SessionClaims } from "@eventrax/contracts";

export function parseTenantContext(input: unknown): SessionClaims {
  return sessionClaimsSchema.parse(input);
}
