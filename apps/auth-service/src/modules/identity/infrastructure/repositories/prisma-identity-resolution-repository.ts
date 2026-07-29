import { prisma } from "@eventrax/database";
import { authRoleSchema } from "@eventrax/contracts";

import type { IdentityResolutionRepository } from "../../domain/repositories/identity-resolution-repository.js";
import type { ExternalIdentity } from "../../domain/value-objects/external-identity.js";
import type { ResolvedIdentity } from "../../domain/entities/resolved-identity.js";

export class PrismaIdentityResolutionRepository implements IdentityResolutionRepository {
  async resolveFromExternalIdentity(identity: ExternalIdentity): Promise<ResolvedIdentity | null> {
    const user = await prisma.appUser.findFirst({
      where: {
        OR: [
          { ssoSubject: identity.ssoSubject },
          ...(identity.email ? [{ email: identity.email }] : [])
        ]
      }
    });

    if (!user?.tenantId || !user.role) {
      return null;
    }

    return {
      email: user.email ?? undefined,
      role: authRoleSchema.parse(user.role),
      ssoSubject: user.ssoSubject ?? identity.ssoSubject,
      tenantId: user.tenantId,
      userId: user.id
    };
  }
}
