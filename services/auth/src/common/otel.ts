/**
 * OpenTelemetry bootstrap.
 *
 * Imported once at the very top of main.ts BEFORE any other module that we
 * want auto-instrumented (Express, http, fetch, ioredis, pg, etc.).
 *
 * No-ops when OTEL_DISABLED=true. Exports OTLP/HTTP to
 * OTEL_EXPORTER_OTLP_ENDPOINT (default http://jaeger:4318 in compose).
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

export function initOtel(serviceName: string) {
  if (process.env.OTEL_DISABLED === 'true') return;
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://jaeger:4318';

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION || '0.4.0',
    }),
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
