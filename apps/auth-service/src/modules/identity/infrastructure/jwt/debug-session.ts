import type { FastifyRequest } from "fastify";

import { authRoleSchema, sessionClaimsSchema, type SessionClaims } from "@eventrax/contracts";

export function getDebugSessionClaims(request: FastifyRequest): SessionClaims | null {
  const userId = request.headers["x-etx-user-id"];
  const tenantId = request.headers["x-etx-tenant-id"];
  const role = request.headers["x-etx-role"];
  const email = request.headers["x-etx-email"];

  if (
    typeof userId !== "string" ||
    typeof tenantId !== "string" ||
    typeof role !== "string"
  ) {
    return null;
  }

  const normalizedRole = authRoleSchema.parse(role);

  return sessionClaimsSchema.parse({
    sub: userId,
    tenantId,
    role: normalizedRole,
    email: typeof email === "string" ? email : undefined
  });
}
