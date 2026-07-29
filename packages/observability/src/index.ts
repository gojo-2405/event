import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

type TelemetryOptions = {
  enabled: boolean;
  exporterUrl?: string;
  serviceName: string;
  serviceVersion: string;
};

export function startTelemetry(options: TelemetryOptions): NodeSDK | undefined {
  if (!options.enabled) {
    return undefined;
  }

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: options.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: options.serviceVersion
    }),
    traceExporter: options.exporterUrl
      ? new OTLPTraceExporter({ url: `${options.exporterUrl}/v1/traces` })
      : undefined,
    instrumentations: [getNodeAutoInstrumentations()]
  });

  void sdk.start();
  return sdk;
}
