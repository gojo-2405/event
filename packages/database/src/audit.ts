import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

export type InvitationAuditPrimitive = string | number | boolean | null | undefined | Date;

export type InvitationAuditSnapshot = Record<string, InvitationAuditPrimitive>;

export interface InvitationAuditEntryInput {
  invitationId: string;
  changedById?: string | null;
  fieldChanged: string;
  oldValue?: string | null;
  newValue?: string | null;
  changedAt?: Date;
}

export interface InvitationAuditDiffInput {
  invitationId: string;
  changedById?: string | null;
  before: InvitationAuditSnapshot;
  after: InvitationAuditSnapshot;
  changedAt?: Date;
}

export interface InvitationAuditWriter {
  invitationAudit: {
    createMany(args: {
      data: Prisma.InvitationAuditCreateManyInput[];
    }): Promise<unknown>;
  };
}

function normalizeAuditValue(value: InvitationAuditPrimitive): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export function buildInvitationAuditEntries({
  after,
  before,
  changedAt,
  changedById,
  invitationId
}: InvitationAuditDiffInput): InvitationAuditEntryInput[] {
  const fieldNames = new Set([...Object.keys(before), ...Object.keys(after)]);
  const entries: InvitationAuditEntryInput[] = [];

  for (const fieldChanged of fieldNames) {
    const oldValue = normalizeAuditValue(before[fieldChanged]);
    const newValue = normalizeAuditValue(after[fieldChanged]);

    if (oldValue === newValue) {
      continue;
    }

    entries.push({
      invitationId,
      changedById: changedById ?? null,
      fieldChanged,
      oldValue,
      newValue,
      changedAt
    });
  }

  return entries;
}

export function buildInvitationAuditCreateManyData(
  entries: InvitationAuditEntryInput[]
): Prisma.InvitationAuditCreateManyInput[] {
  return entries.map((entry) => ({
    id: randomUUID(),
    invitationId: entry.invitationId,
    changedById: entry.changedById ?? null,
    fieldChanged: entry.fieldChanged,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    changedAt: entry.changedAt ?? new Date()
  }));
}

export async function writeInvitationAuditEntries(
  prismaClient: InvitationAuditWriter,
  entries: InvitationAuditEntryInput[]
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  await prismaClient.invitationAudit.createMany({
    data: buildInvitationAuditCreateManyData(entries)
  });
}

export async function writeInvitationAuditDiff(
  prismaClient: InvitationAuditWriter,
  input: InvitationAuditDiffInput
): Promise<void> {
  const entries = buildInvitationAuditEntries(input);
  await writeInvitationAuditEntries(prismaClient, entries);
}
