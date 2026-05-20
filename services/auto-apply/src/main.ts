/**
 * auto-apply service entry.
 *
 * Two surfaces:
 *  1) A tiny HTTP server (:8005) exposing /health and the internal /enqueue
 *     endpoint the orchestrator hits when a new application is created.
 *  2) A background worker that polls a Redis list (BLPOP) and runs the
 *     Playwright driver pipeline per application.
 */
import http from 'http';
import { config } from './config';
import { runWorker, enqueueApplication, resumeApplication } from './worker';

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  if (req.method === 'GET' && url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, service: 'auto-apply' }));
    return;
  }
  if (req.method === 'POST' && url === '/enqueue') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const { applicationId } = JSON.parse(body || '{}');
        if (!applicationId) {
          res.statusCode = 400;
          return res.end('applicationId required');
        }
        await enqueueApplication(applicationId);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ enqueued: true }));
      } catch (e: any) {
        res.statusCode = 500;
        res.end(e?.message || 'error');
      }
    });
    return;
  }
  if (req.method === 'POST' && url.startsWith('/resume/')) {
    const applicationId = url.slice('/resume/'.length);
    try {
      await resumeApplication(applicationId);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ resumed: true }));
    } catch (e: any) {
      res.statusCode = 500;
      res.end(e?.message || 'error');
    }
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});

server.listen(config.port, '0.0.0.0', () => {
  console.log(`[auto-apply] http listening on :${config.port}`);
});

// Kick off the worker loop. It runs forever; errors are logged but do not crash.
runWorker().catch((err) => {
  console.error('[auto-apply] worker loop crashed', err);
  process.exit(1);
});
