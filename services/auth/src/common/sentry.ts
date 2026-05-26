/**
 * Sentry bootstrap.
 *
 * No-op if SENTRY_DSN is unset (the default in dev). Scrubs auth tokens
 * and password fields from breadcrumbs + request bodies.
 */
import * as Sentry from '@sentry/node';

const SENSITIVE_HEADER = /^(authorization|cookie|x-api-key)$/i;
const SENSITIVE_KEY = /(password|token|secret|api[_-]?key|stripe-signature)/i;

export function initSentry(serviceName: string) {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SERVICE_VERSION || '0.4.0',
    serverName: serviceName,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    beforeSend(event) {
      // Scrub Authorization etc. from request data.
      if (event.request?.headers) {
        for (const k of Object.keys(event.request.headers)) {
          if (SENSITIVE_HEADER.test(k)) event.request.headers[k] = '[scrubbed]';
        }
      }
      function deepScrub(obj: any) {
        if (!obj || typeof obj !== 'object') return obj;
        for (const k of Object.keys(obj)) {
          if (SENSITIVE_KEY.test(k)) obj[k] = '[scrubbed]';
          else if (typeof obj[k] === 'object') deepScrub(obj[k]);
        }
        return obj;
      }
      if (event.request?.data) event.request.data = deepScrub(event.request.data);
      if (event.extra) event.extra = deepScrub(event.extra);
      return event;
    },
  });
  // eslint-disable-next-line no-console
  console.log(`[sentry] enabled for ${serviceName}`);
}

export { Sentry };
