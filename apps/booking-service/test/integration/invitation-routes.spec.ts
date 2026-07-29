import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, writeInvitationAuditDiff } = vi.hoisted(() => ({
  mockPrisma: {
    booking: {
      findMany: vi.fn()
    },
    invitation: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    invitationAudit: {
      findMany: vi.fn(),
      createMany: vi.fn()
    },
    $transaction: vi.fn()
  },
  writeInvitationAuditDiff: vi.fn()
}));

vi.mock("@eventrax/database", () => ({
  prisma: mockPrisma,
  writeInvitationAuditDiff
}));

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

describe("booking-service invitation routes", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.SERVICE_NAME = "booking-service";
    process.env.PORT = "3003";
    process.env.DATABASE_URL = "postgresql://admin:Admin123@localhost:5432/aok_dev";
    process.env.OTEL_ENABLED = "false";

    vi.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
  });

  afterEach(() => {
    resetEnv();
  });

  it("updates an invitation and writes audit entries", async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      status: "pending",
      rsvpAt: null,
      reconfirmed: false,
      reconfirmedAt: null,
      attended: false,
      attendedAt: null,
      cancellationReasonCode: null,
      cancellationReasonText: null,
      sentAt: null
    });

    mockPrisma.invitation.update.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      status: "sent",
      rsvpAt: null,
      reconfirmed: false,
      reconfirmedAt: null,
      attended: false,
      attendedAt: null,
      cancellationReasonCode: null,
      cancellationReasonText: null,
      sentAt: new Date("2026-07-01T09:30:00.000Z")
    });

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/invitations/11111111-1111-1111-1111-111111111111",
        headers: {
          "x-etx-user-id": "22222222-2222-2222-2222-222222222222"
        },
        payload: {
          status: "sent",
          sentAt: "2026-07-01T09:30:00.000Z"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.invitation.update).toHaveBeenCalledWith({
        where: { id: "11111111-1111-1111-1111-111111111111" },
        data: {
          status: "sent",
          sentAt: new Date("2026-07-01T09:30:00.000Z")
        }
      });
      expect(writeInvitationAuditDiff).toHaveBeenCalledTimes(1);
      expect(writeInvitationAuditDiff).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          invitationId: "11111111-1111-1111-1111-111111111111",
          changedById: "22222222-2222-2222-2222-222222222222"
        })
      );
    } finally {
      await app.close();
    }
  });

  it("returns 404 when the invitation is missing", async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue(null);

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/invitations/11111111-1111-1111-1111-111111111111",
        headers: {
          "x-etx-user-id": "22222222-2222-2222-2222-222222222222"
        },
        payload: {
          status: "sent"
        }
      });

      expect(response.statusCode).toBe(404);
      expect(writeInvitationAuditDiff).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("returns 400 when the actor header is missing", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/v1/invitations/11111111-1111-1111-1111-111111111111",
        payload: {
          status: "sent"
        }
      });

      expect(response.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("returns the audit history for an invitation", async () => {
    mockPrisma.invitation.findUnique.mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111"
    });
    mockPrisma.invitationAudit.findMany.mockResolvedValue([
      {
        id: "33333333-3333-3333-3333-333333333333",
        invitationId: "11111111-1111-1111-1111-111111111111",
        fieldChanged: "status",
        oldValue: "pending",
        newValue: "sent"
      }
    ]);

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/invitations/11111111-1111-1111-1111-111111111111/audit"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        data: [
          {
            id: "33333333-3333-3333-3333-333333333333",
            invitationId: "11111111-1111-1111-1111-111111111111",
            fieldChanged: "status",
            oldValue: "pending",
            newValue: "sent"
          }
        ]
      });
    } finally {
      await app.close();
    }
  });
});
