/**
 * OpenTelemetry bootstrap.
 *
 * Imported at the very top of main.ts BEFORE any other module so the
 * NodeSDK can hook into Express/http/fetch/ioredis/pg at require time.
 *
 * Service name comes from the OTEL_SERVICE_NAME env var (set per-service in
 * docker-compose). Set OTEL_DISABLED=true to skip entirely. Exports OTLP/HTTP
 * to OTEL_EXPORTER_OTLP_ENDPOINT (default http://jaeger:4318).
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export function initOtel(serviceName: string) {
  if (process.env.OTEL_DISABLED === 'true') return;
  // Setting OTEL_SERVICE_NAME on the process tells the SDK to tag every span
  // with this service name — works across every minor SDK version, no
  // dependence on the resource-builder helper whose name varied across
  // versions of @opentelemetry/resources.
  if (!process.env.OTEL_SERVICE_NAME) {
    process.env.OTEL_SERVICE_NAME = serviceName;
  }
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://jaeger:4318';

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });

  try {
    sdk.start();
    // eslint-disable-next-line no-console
    console.log(`[otel] tracing enabled for ${serviceName} → ${endpoint}`);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn(`[otel] failed to start: ${e?.message || e}`);
  }

  ['SIGTERM', 'SIGINT'].forEach((sig) =>
    process.on(sig, async () => {
      try { await sdk.shutdown(); } catch {}
      process.exit(0);
    }),
  );
}
