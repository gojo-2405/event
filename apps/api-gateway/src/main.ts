import { loadConfig } from "@eventrax/config";
import { startTelemetry } from "@eventrax/observability";

import { buildApp } from "./app.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig({
    ...process.env,
    SERVICE_NAME: process.env.SERVICE_NAME ?? "api-gateway"
  });

  startTelemetry({
    enabled: config.OTEL_ENABLED,
    exporterUrl: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    serviceName: config.SERVICE_NAME,
    serviceVersion: config.OTEL_SERVICE_VERSION
  });

  const app = await buildApp();
  await app.listen({ host: "0.0.0.0", port: config.PORT });
}

void bootstrap();
