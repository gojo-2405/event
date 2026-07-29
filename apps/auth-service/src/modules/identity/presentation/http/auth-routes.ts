import { scryptSync, timingSafeEqual } from "node:crypto";

import type { FastifyInstance } from "fastify";

import { authRoleSchema, permissionActionSchema, type AuthRole } from "@eventrax/contracts";
import { loadConfig } from "@eventrax/config";
import { prisma } from "@eventrax/database";

import { SESSION_COOKIE } from "../../../../bootstrap/plugins/auth.js";

import { AuthenticationError } from "../../../../shared/errors/authentication-error.js";
import { canPerform, resolvePermissions } from "../../../authorization/application/services/authorization-service.js";
import { handleAuthCallback } from "../../application/services/callback-service.js";
import { buildSessionClaims } from "../../application/services/session-service.js";
import { issueAccessToken } from "../../infrastructure/jwt/token-service.js";
import { InMemoryIdentityResolutionRepository } from "../../infrastructure/repositories/in-memory-identity-resolution-repository.js";
import { MockSsoProvider } from "../../infrastructure/sso/mock-sso-provider.js";
import { getWorkOsAuthorizationUrl } from "../../infrastructure/sso/workos-provider.js";
import { requireAuth } from "../../../../shared/helpers/require-auth.js";
import { requirePermission } from "../../../../shared/helpers/require-permission.js";

const db = prisma as any;

// Password hashes are stored as `scrypt$<saltHex>$<hashHex>` (see the RBAC seed). No external
// hashing dependency — Node's scrypt is a sound password KDF.
function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, expected.length);
  } catch {
    return false;
  }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sessionCookie(token: string, maxAgeSeconds: number): string {
  // HttpOnly so JS can't read it; SameSite=Lax + no Secure works for local http behind the
  // Vite dev proxy (same-site). Add `; Secure` when served over https in production.
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

// Shared payload for login + /me: the authenticated user plus the screens their role can see.
async function loadUserContext(userId: string) {
  const user = await db.appUser.findUnique({ where: { id: userId }, include: { roleRef: true } });
  if (!user || !user.roleId) return null;

  const roleScreens = await db.roleScreen.findMany({
    where: { roleId: user.roleId, canView: true, screen: { isActive: true } },
    include: { screen: true }
  });

  const screens = roleScreens
    .map((rs: any) => ({
      key: rs.screen.key,
      title: rs.screen.title,
      path: rs.screen.path,
      icon: rs.screen.icon,
      section: rs.screen.section,
      sortOrder: rs.screen.sortOrder,
      canView: rs.canView,
      canCreate: rs.canCreate,
      canEdit: rs.canEdit,
      canDelete: rs.canDelete,
      canApprove: rs.canApprove
    }))
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      role: user.roleRef?.key ?? null,
      roleLabel: user.roleRef?.label ?? null
    },
    screens
  };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const config = loadConfig({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "auth-service"
  });

  // Email + password login. Verifies the scrypt hash, issues a JWT, and sets it as an httpOnly
  // session cookie (the token is never exposed to JS).
  app.post<{ Body: { email?: string; password?: string } }>(
    "/api/v1/auth/login",
    async (request, reply) => {
      const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "";
      const password = typeof request.body?.password === "string" ? request.body.password : "";
      if (!email || !password) {
        return reply.badRequest("Email and password are required");
      }

      const user = await db.appUser.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, isActive: true },
        include: { roleRef: true }
      });
      // Same generic message whether the email is unknown or the password is wrong.
      if (!user || !user.roleRef || !verifyPassword(password, user.passwordHash)) {
        return reply.unauthorized("Invalid email or password");
      }

      const roleKey = user.roleRef.key;
      const parsedRole = authRoleSchema.safeParse(roleKey);
      if (!parsedRole.success || !user.tenantId) {
        return reply.internalServerError("User account is misconfigured (role/tenant)");
      }

      const claims = buildSessionClaims({
        email: user.email ?? undefined,
        role: parsedRole.data as AuthRole,
        tenantId: user.tenantId,
        userId: user.id
      });
      const accessToken = await issueAccessToken({
        audience: config.JWT_AUDIENCE,
        claims,
        issuer: config.JWT_ISSUER,
        secret: config.JWT_SECRET
      });

      reply.header("set-cookie", sessionCookie(accessToken, 12 * 60 * 60));
      const context = await loadUserContext(user.id);
      return reply.send(context);
    }
  );

  // Clears the session cookie.
  app.post("/api/v1/auth/logout", async (_request, reply) => {
    reply.header("set-cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
    return { ok: true };
  });

  app.get("/api/v1/auth/me", async (request, reply) => {
    requireAuth(request, reply);
    const context = await loadUserContext(request.auth!.sub);
    if (!context) return reply.unauthorized("Session user not found");
    return context;
  });

  app.get<{ Params: { role: string } }>("/api/v1/auth/permissions/:role", async (request) => {
    const role = authRoleSchema.parse(request.params.role);

    return {
      role,
      permissions: resolvePermissions(role)
    };
  });

  app.get<{ Querystring: { role: string; action: string } }>(
    "/api/v1/auth/permissions/check",
    async (request, reply) => {
      const role = authRoleSchema.parse(request.query.role);
      const action = permissionActionSchema.parse(request.query.action);

      if (!canPerform(role, action)) {
        return reply.forbidden("Role does not have the requested permission");
      }

      return {
        allowed: true
      };
    }
  );

  app.get("/api/v1/auth/role-matrix", async (request, reply) => {
    requirePermission(request, reply, "users.manage");

    return Object.fromEntries(
      authRoleSchema.options.map((role) => [role, resolvePermissions(role)])
    );
  });

  app.get<{ Querystring: { connectionId?: string; state?: string } }>(
    "/api/v1/auth/login",
    async (request) => {
      const state = request.query.state ?? "local-dev-state";

      return {
        authorizationUrl: getWorkOsAuthorizationUrl({
          connectionId: request.query.connectionId,
          state
        })
      };
    }
  );

  app.get<{ Querystring: { code?: string; state?: string } }>(
    "/api/v1/auth/callback",
    async (request, reply) => {
      if (!request.query.code) {
        return reply.badRequest("Missing authorization code");
      }

      try {
        const claims = await handleAuthCallback({
          code: request.query.code,
          repository: new InMemoryIdentityResolutionRepository([
            {
              email: "test@example.com",
              role: "tenant_admin",
              ssoSubject: "mock-user",
              tenantId: "22222222-2222-2222-2222-222222222222",
              userId: "11111111-1111-1111-1111-111111111111"
            }
          ]),
          ssoProvider: new MockSsoProvider()
        });

        const accessToken = await issueAccessToken({
          audience: config.JWT_AUDIENCE,
          claims,
          issuer: config.JWT_ISSUER,
          secret: config.JWT_SECRET
        });

        return {
          accessToken,
          claims,
          receivedState: request.query.state ?? null,
          tokenType: "Bearer"
        };
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return reply.unauthorized(error.message);
        }

        throw error;
      }
    }
  );

  app.post<{
    Body: {
      email?: string;
      role: string;
      tenantId: string;
      userId: string;
    };
  }>("/api/v1/auth/token", async (request) => {
    const role = authRoleSchema.parse(request.body.role);
    const claims = buildSessionClaims({
      email: request.body.email,
      role,
      tenantId: request.body.tenantId,
      userId: request.body.userId
    });

    const accessToken = await issueAccessToken({
      audience: config.JWT_AUDIENCE,
      claims,
      issuer: config.JWT_ISSUER,
      secret: config.JWT_SECRET
    });

    return {
      accessToken,
      tokenType: "Bearer",
      claims
    };
  });
}
