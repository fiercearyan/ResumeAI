/**
 * Email transport. Two paths:
 *   - dev: SMTP to Mailhog (port 1025, plaintext, no auth).
 *   - prod: Resend HTTP API when RESEND_API_KEY is set.
 *
 * Returns an opaque id on success — Mailhog's messageId or Resend's id.
 */
import nodemailer from 'nodemailer';

const FROM = process.env.NOTIFICATIONS_FROM || 'ResumeAI <noreply@resumeai.local>';
const SMTP_HOST = process.env.SMTP_HOST || 'mailhog';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '1025', 10);

const smtp = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  ignoreTLS: true,
});

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<string> {
  if (process.env.RESEND_API_KEY) {
    // Production path via Resend HTTP API.
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    const j = await r.json() as any;
    return j.id || 'resend';
  }
  const info = await smtp.sendMail({ from: FROM, to, subject, text, html });
  return info.messageId || 'mailhog';
}
