import type { FastifyReply, FastifyRequest } from "fastify";

import type { PermissionAction } from "@eventrax/contracts";

import type { AuthContext } from "./auth-context.js";
import { hasPermission } from "./auth-context.js";
import { requireAuth } from "./require-auth.js";

export function requirePermission(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: PermissionAction
): asserts request is FastifyRequest & { auth: AuthContext } {
  requireAuth(request, reply);

  if (!hasPermission(request.auth, permission)) {
    throw reply.forbidden(`Missing required permission: ${permission}`);
  }
}
