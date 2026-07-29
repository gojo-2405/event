import { createSecretKey } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import { sessionClaimsSchema, type SessionClaims } from "@eventrax/contracts";

import { AuthenticationError } from "../../../../shared/errors/authentication-error.js";

type IssueAccessTokenInput = {
  audience: string;
  claims: SessionClaims;
  expiresIn?: string;
  issuer: string;
  secret: string;
};

type VerifyAccessTokenInput = {
  audience: string;
  issuer: string;
  secret: string;
  token: string;
};

function getJwtSecret(secret: string): Uint8Array {
  return createSecretKey(Buffer.from(secret, "utf8")).export() as Uint8Array;
}

export async function issueAccessToken(input: IssueAccessTokenInput): Promise<string> {
  const claims = sessionClaimsSchema.parse(input.claims);

  return new SignJWT({
    tenantId: claims.tenantId,
    role: claims.role,
    email: claims.email,
    permissions: claims.permissions
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(input.issuer)
    .setAudience(input.audience)
    .setIssuedAt()
    .setExpirationTime(input.expiresIn ?? "12h")
    .sign(getJwtSecret(input.secret));
}

export async function verifyAccessToken(input: VerifyAccessTokenInput): Promise<SessionClaims> {
  try {
    const { payload } = await jwtVerify(input.token, getJwtSecret(input.secret), {
      issuer: input.issuer,
      audience: input.audience
    });

    return sessionClaimsSchema.parse({
      sub: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email,
      permissions: payload.permissions
    });
  } catch {
    throw new AuthenticationError("Invalid or expired access token");
  }
}
