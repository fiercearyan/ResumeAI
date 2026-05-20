/**
 * RFC-6238 TOTP (Time-based One-Time Password) — minimal implementation.
 *
 * No external deps. SHA-1 HMAC, 30-second step, 6-digit codes, ±1 step
 * tolerance window. Secrets are base32-encoded (RFC 4648, no padding).
 */
import { createHmac, randomBytes } from 'crypto';

const STEP_SEC = 30;
const DIGITS = 6;

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(byteLen = 20): string {
  const buf = randomBytes(byteLen);
  return bufferToBase32(buf);
}

export function otpauthUrl(opts: { secret: string; account: string; issuer: string }): string {
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SEC),
  });
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`);
  return `otpauth://totp/${label}?${params}`;
}

/** Generate the 6-digit code for the current 30-s step (or offset). */
export function generateTotp(secretBase32: string, stepOffset = 0): string {
  const key = base32ToBuffer(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / STEP_SEC) + stepOffset;
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** Verify a user-submitted code against the current step ± 1. */
export function verifyTotp(secretBase32: string, submittedCode: string): boolean {
  const clean = String(submittedCode || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  for (const off of [-1, 0, 1]) {
    if (timingSafeEqual(generateTotp(secretBase32, off), clean)) return true;
  }
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bufferToBase32(buf: Buffer): string {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += B32_ALPHABET[parseInt(chunk, 2)];
  }
  return out;
}

function base32ToBuffer(s: string): Buffer {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid base32 char: ${ch}`);
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}
