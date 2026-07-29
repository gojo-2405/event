import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthContext } from "./auth-context.js";

export function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): asserts request is FastifyRequest & { auth: AuthContext } {
  if (!request.auth) {
    throw reply.unauthorized("Authentication context missing");
  }
}
