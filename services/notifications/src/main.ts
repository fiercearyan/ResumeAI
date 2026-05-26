/**
 * Notifications service.
 *
 * One endpoint: POST /send { userId?, email, template, data?, idempotencyKey? }.
 * Idempotency: if a row with the same idempotencyKey exists, no email is sent
 * (handy because every caller fires-and-forgets; one duplicate doesn't spam).
 */
import { initOtel } from './otel';
import { initSentry } from './sentry';
initOtel('notifications');
initSentry('notifications');

import http from 'http';
import { PrismaClient } from '@prisma/client';
import { render, TemplateId } from './templates';
import { sendEmail } from './transport';

const prisma = new PrismaClient();
const PORT = parseInt(process.env.NOTIFICATIONS_PORT || '8006', 10);

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  if (req.method === 'GET' && url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, service: 'notifications' }));
    return;
  }
  if (req.method === 'POST' && url === '/send') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const { userId, email, template, data, idempotencyKey } = JSON.parse(body || '{}');
        if (!email || !template) {
          res.statusCode = 400; return res.end('email and template required');
        }
        // Idempotency check.
        if (idempotencyKey) {
          const existing = await prisma.notificationLog.findUnique({
            where: { idempotencyKey },
          });
          if (existing) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ ok: true, deduped: true, id: Number(existing.id) }));
          }
        }
        const log = await prisma.notificationLog.create({
          data: { userId: userId ?? null, email, template, status: 'queued', idempotencyKey, meta: data ?? null },
        });
        try {
          const rendered = render(template as TemplateId, data || {});
          await sendEmail(email, rendered.subject, rendered.text, rendered.html);
          await prisma.notificationLog.update({
            where: { id: log.id },
            data: { status: 'sent', sentAt: new Date() },
          });
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, id: Number(log.id) }));
        } catch (e: any) {
          await prisma.notificationLog.update({
            where: { id: log.id },
            data: { status: 'failed', error: e?.message || String(e) },
          });
          res.statusCode = 500;
          res.end(e?.message || 'send failed');
        }
      } catch (e: any) {
        res.statusCode = 500; res.end(e?.message || 'error');
      }
    });
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[notifications] http listening on :${PORT}`);
});
