import { loadConfig } from "@eventrax/config";

import { AuthenticationError } from "../../../../shared/errors/authentication-error.js";
import type { SsoProvider } from "../../application/services/sso-provider.js";
import type { ExternalIdentity } from "../../domain/value-objects/external-identity.js";

type WorkOsAuthorizationUrlInput = {
  connectionId?: string;
  state: string;
};

export function getWorkOsAuthorizationUrl(input: WorkOsAuthorizationUrlInput): string {
  const config = loadConfig({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "auth-service"
  });

  const baseUrl = new URL("https://api.workos.com/sso/authorize");
  if (config.WORKOS_CLIENT_ID) {
    baseUrl.searchParams.set("client_id", config.WORKOS_CLIENT_ID);
  }
  if (config.WORKOS_REDIRECT_URI) {
    baseUrl.searchParams.set("redirect_uri", config.WORKOS_REDIRECT_URI);
  }
  baseUrl.searchParams.set("response_type", "code");
  baseUrl.searchParams.set("state", input.state);

  if (input.connectionId) {
    baseUrl.searchParams.set("connection", input.connectionId);
  }

  return baseUrl.toString();
}

export class WorkOsSsoProvider implements SsoProvider {
  async exchangeCodeForIdentity(): Promise<ExternalIdentity> {
    throw new AuthenticationError("WorkOS code exchange is not configured yet");
  }
}
