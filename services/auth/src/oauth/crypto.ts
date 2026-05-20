/**
 * AES-256-GCM envelope for OAuth access / refresh tokens.
 *
 * Key: 32-byte hex in env ENC_KEY (or derived from JWT_SECRET as a dev fallback
 * via SHA-256 to keep dev frictionless). In prod, set ENC_KEY explicitly and
 * rotate via a KMS-derived envelope.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function key(): Buffer {
  const hex = process.env.ENC_KEY;
  if (hex && hex.length >= 64) return Buffer.from(hex.slice(0, 64), 'hex');
  return createHash('sha256').update(process.env.JWT_SECRET || 'dev-secret').digest();
}

export function enc(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(Buffer.from(plaintext, 'utf8')), c.final()]);
  const tag = c.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.');
}

export function dec(blob: string | null | undefined): string | null {
  if (!blob) return null;
  const parts = blob.split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const ct = Buffer.from(parts[2], 'base64');
    const d = createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
