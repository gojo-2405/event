import type { AuthContext } from "../helpers/auth-context.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
