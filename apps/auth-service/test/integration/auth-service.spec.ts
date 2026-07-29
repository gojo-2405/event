import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../../src/app.js";

const originalEnv = { ...process.env };

function resetEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
}

describe("auth-service", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.SERVICE_NAME = "auth-service";
    process.env.PORT = "3001";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.JWT_ISSUER = "https://eventrax.local";
    process.env.JWT_AUDIENCE = "eventrax-api";
    process.env.JWT_SECRET = "change-me";
    process.env.OTEL_ENABLED = "false";
  });

  afterEach(() => {
    resetEnv();
  });

  it("returns service health from /api/v1/auth-service/health", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth-service/health"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
        service: "auth-service",
        version: "0.1.0"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 401 for /api/v1/auth/me without auth", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me"
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("returns auth context for debug-header auth when AUTH_DEBUG_BYPASS=true", async () => {
    process.env.AUTH_DEBUG_BYPASS = "true";

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          "x-etx-user-id": "11111111-1111-1111-1111-111111111111",
          "x-etx-tenant-id": "22222222-2222-2222-2222-222222222222",
          "x-etx-role": "tenant_admin",
          "x-etx-email": "test@example.com"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        sub: "11111111-1111-1111-1111-111111111111",
        tenantId: "22222222-2222-2222-2222-222222222222",
        role: "tenant_admin",
        email: "test@example.com"
      });
    } finally {
      await app.close();
    }
  });

  it("issues a token and accepts it on /api/v1/auth/me", async () => {
    const app = await buildApp();

    try {
      const tokenResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/token",
        payload: {
          userId: "11111111-1111-1111-1111-111111111111",
          tenantId: "22222222-2222-2222-2222-222222222222",
          role: "tenant_admin",
          email: "test@example.com"
        }
      });

      expect(tokenResponse.statusCode).toBe(200);

      const { accessToken } = tokenResponse.json() as { accessToken: string };

      const authMeResponse = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      });

      expect(authMeResponse.statusCode).toBe(200);
      expect(authMeResponse.json()).toMatchObject({
        sub: "11111111-1111-1111-1111-111111111111",
        tenantId: "22222222-2222-2222-2222-222222222222",
        role: "tenant_admin"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 401 for invalid bearer tokens", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: "Bearer invalid.token.value"
        }
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("protects /api/v1/users when auth is missing", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users"
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("returns 403 for /api/v1/users when the role lacks users.read", async () => {
    process.env.AUTH_DEBUG_BYPASS = "true";

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/users",
        headers: {
          "x-etx-user-id": "11111111-1111-1111-1111-111111111111",
          "x-etx-tenant-id": "22222222-2222-2222-2222-222222222222",
          "x-etx-role": "requestor",
          "x-etx-email": "test@example.com"
        }
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("returns the role matrix for privileged roles", async () => {
    process.env.AUTH_DEBUG_BYPASS = "true";

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/role-matrix",
        headers: {
          "x-etx-user-id": "11111111-1111-1111-1111-111111111111",
          "x-etx-tenant-id": "22222222-2222-2222-2222-222222222222",
          "x-etx-role": "tenant_admin",
          "x-etx-email": "test@example.com"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty("tenant_admin");
      expect(response.json()).toHaveProperty("aok_admin");
    } finally {
      await app.close();
    }
  });

  it("returns 400 when callback code is missing", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/callback"
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("returns 200 and issues a token for the mock callback flow", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/callback?code=mock:mock-user|test@example.com|22222222-2222-2222-2222-222222222222|tenant_admin&state=test-state"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        claims: {
          sub: "11111111-1111-1111-1111-111111111111",
          tenantId: "22222222-2222-2222-2222-222222222222",
          role: "tenant_admin"
        },
        receivedState: "test-state",
        tokenType: "Bearer"
      });
    } finally {
      await app.close();
    }
  });

  it("returns 401 when the callback code cannot be resolved", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/callback?code=invalid-code"
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
