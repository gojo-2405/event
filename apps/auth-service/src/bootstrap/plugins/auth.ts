import fp from "fastify-plugin";

import { loadConfig } from "@eventrax/config";

import { resolvePermissions } from "../../modules/authorization/application/services/authorization-service.js";
import { getDebugSessionClaims } from "../../modules/identity/infrastructure/jwt/debug-session.js";
import { verifyAccessToken } from "../../modules/identity/infrastructure/jwt/token-service.js";
import { AuthenticationError } from "../../shared/errors/authentication-error.js";
import { createAuthContext } from "../../shared/helpers/auth-context.js";

export const SESSION_COOKIE = "etx_session";

// Minimal cookie parsing so we don't add @fastify/cookie just to read one session cookie.
function readCookie(request: { headers: Record<string, unknown> }, name: string): string | null {
  const header = request.headers["cookie"];
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export const authPlugin = fp(async (app) => {
  const config = loadConfig({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "auth-service"
  });

  app.decorateRequest("auth", undefined);

  app.addHook("preHandler", async (request) => {
    const authorizationHeader = request.headers.authorization;
    // Accept the JWT from either the Authorization header (service-to-service) or the httpOnly
    // session cookie (browser sessions).
    const bearer = authorizationHeader?.startsWith("Bearer ")
      ? authorizationHeader.slice("Bearer ".length).trim()
      : null;
    const token = bearer || readCookie(request, SESSION_COOKIE);
    if (token) {
      try {
        const claims = await verifyAccessToken({
          audience: config.JWT_AUDIENCE,
          issuer: config.JWT_ISSUER,
          secret: config.JWT_SECRET,
          token
        });

        request.auth = createAuthContext(claims);
        return;
      } catch (error) {
        if (error instanceof AuthenticationError) {
          throw app.httpErrors.unauthorized(error.message);
        }

        throw error;
      }
    }

    if (!config.AUTH_DEBUG_BYPASS) {
      return;
    }

    const claims = getDebugSessionClaims(request);
    if (!claims) {
      return;
    }

    request.auth = createAuthContext({
      ...claims,
      permissions: resolvePermissions(claims.role)
    });
  });
});
