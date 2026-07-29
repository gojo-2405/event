import { Prisma } from "@prisma/client";

export type TenantContext = {
  bypassRls?: boolean;
  tenantId: string;
};

export async function withTenantContext<T>(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  operation: (scopedTx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  await tx.$executeRawUnsafe("SELECT set_config('app.tenant_id', $1, true)", context.tenantId);
  await tx.$executeRawUnsafe(
    "SELECT set_config('app.bypass_rls', $1, true)",
    context.bypassRls ? "true" : "false"
  );

  return operation(tx);
}

export function createTenantScopedWhere<T extends Record<string, unknown>>(
  context: TenantContext,
  baseWhere: T = {} as T
): T {
  if (context.bypassRls) {
    return baseWhere;
  }

  return {
    ...baseWhere,
    tenantId: context.tenantId
  };
}
