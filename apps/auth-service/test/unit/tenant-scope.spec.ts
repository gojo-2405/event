import { describe, expect, it } from "vitest";

import { buildUserReadScope, canBypassTenantScope } from "../../src/shared/helpers/tenant-scope.js";

describe("tenant scope helper", () => {
  it("scopes normal tenant roles to their own tenant", () => {
    const context = {
      sub: "11111111-1111-1111-1111-111111111111",
      tenantId: "22222222-2222-2222-2222-222222222222",
      role: "tenant_admin" as const,
      email: "test@example.com",
      permissions: ["users.read", "users.manage"] as const
    };

    expect(canBypassTenantScope(context)).toBe(false);
    expect(buildUserReadScope(context)).toEqual({
      tenantId: "22222222-2222-2222-2222-222222222222"
    });
  });

  it("allows platform override roles to bypass tenant scoping", () => {
    const context = {
      sub: "11111111-1111-1111-1111-111111111111",
      tenantId: "22222222-2222-2222-2222-222222222222",
      role: "platform_admin" as const,
      email: "test@example.com",
      permissions: ["users.read", "platform.override"] as const
    };

    expect(canBypassTenantScope(context)).toBe(true);
    expect(buildUserReadScope(context)).toEqual({});
  });
});
