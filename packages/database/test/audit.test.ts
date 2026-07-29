import { describe, expect, it, vi } from "vitest";

import {
  buildInvitationAuditCreateManyData,
  buildInvitationAuditEntries,
  writeInvitationAuditEntries
} from "../src/audit.js";

describe("invitation audit helpers", () => {
  it("builds audit entries only for changed fields", () => {
    const entries = buildInvitationAuditEntries({
      invitationId: "8bb8c3fe-b94b-4b0c-b4d8-695825fc0363",
      changedById: "e9e77498-73f1-4216-8ce3-6f25f7ef2997",
      before: {
        status: "pending",
        reconfirmed: false,
        sentAt: null
      },
      after: {
        status: "sent",
        reconfirmed: false,
        sentAt: new Date("2026-06-30T10:00:00.000Z")
      },
      changedAt: new Date("2026-06-30T10:00:01.000Z")
    });

    expect(entries).toEqual([
      {
        invitationId: "8bb8c3fe-b94b-4b0c-b4d8-695825fc0363",
        changedById: "e9e77498-73f1-4216-8ce3-6f25f7ef2997",
        fieldChanged: "status",
        oldValue: "pending",
        newValue: "sent",
        changedAt: new Date("2026-06-30T10:00:01.000Z")
      },
      {
        invitationId: "8bb8c3fe-b94b-4b0c-b4d8-695825fc0363",
        changedById: "e9e77498-73f1-4216-8ce3-6f25f7ef2997",
        fieldChanged: "sentAt",
        oldValue: null,
        newValue: "2026-06-30T10:00:00.000Z",
        changedAt: new Date("2026-06-30T10:00:01.000Z")
      }
    ]);
  });

  it("builds prisma createMany payloads with generated ids", () => {
    const data = buildInvitationAuditCreateManyData([
      {
        invitationId: "8bb8c3fe-b94b-4b0c-b4d8-695825fc0363",
        fieldChanged: "status",
        oldValue: "pending",
        newValue: "sent",
        changedAt: new Date("2026-06-30T10:00:01.000Z")
      }
    ]);

    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      invitationId: "8bb8c3fe-b94b-4b0c-b4d8-695825fc0363",
      fieldChanged: "status",
      oldValue: "pending",
      newValue: "sent",
      changedAt: new Date("2026-06-30T10:00:01.000Z")
    });
    expect(data[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("skips the database write when there are no audit entries", async () => {
    const createMany = vi.fn();

    await writeInvitationAuditEntries(
      {
        invitationAudit: { createMany }
      } as never,
      []
    );

    expect(createMany).not.toHaveBeenCalled();
  });
});
