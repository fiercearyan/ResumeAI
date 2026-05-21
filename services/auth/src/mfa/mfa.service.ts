import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { DbService } from '../db.service';
import { AuthService, TokenPair } from '../auth.service';
import { generateBase32Secret, otpauthUrl, verifyTotp } from './totp';
import { notify } from '../common/notify';

const ISSUER = process.env.MFA_ISSUER || 'ResumeAI';

@Injectable()
export class MfaService {
  constructor(private db: DbService, private auth: AuthService, private jwt: JwtService) {}

  async startEnroll(userId: string) {
    const u = await this.user(userId);
    if (u.mfa_enabled) throw new BadRequestException('MFA is already enabled');
    const secret = generateBase32Secret(20);
    // Persist pending secret; treat mfa_enabled=false + mfa_secret_enc=set as "enroll in progress".
    await this.db.query('UPDATE users SET mfa_secret_enc=$1 WHERE id=$2', [secret, userId]);
    const url = otpauthUrl({ secret, account: u.email, issuer: ISSUER });
    return { otpauthUrl: url, secret };
  }

  async confirmEnroll(userId: string, code: string) {
    const u = await this.user(userId);
    if (!u.mfa_secret_enc) throw new BadRequestException('No enrollment in progress');
    if (!verifyTotp(u.mfa_secret_enc, code)) throw new UnauthorizedException('Invalid code');

    // Generate 10 backup codes; show them ONCE to the user and store argon2 hashes.
    const codes = Array.from({ length: 10 }, () => randomBytes(5).toString('hex').toUpperCase());
    const hashes = await Promise.all(codes.map((c) => argon2.hash(c, { type: argon2.argon2id })));
    await this.db.query(
      'UPDATE users SET mfa_enabled=true, mfa_backup_codes_hash=$1 WHERE id=$2',
      [JSON.stringify(hashes), userId],
    );
    notify({
      userId,
      email: u.email,
      template: 'mfa_enabled',
      idempotencyKey: `mfa_enabled:${userId}:${Date.now()}`,
    });
    return { ok: true, backupCodes: codes };
  }

  async disable(userId: string, code: string) {
    const u = await this.user(userId);
    if (!u.mfa_enabled) return { ok: true };
    if (!u.mfa_secret_enc || !verifyTotp(u.mfa_secret_enc, code)) {
      // also accept backup code
      const consumed = await this.tryConsumeBackup(userId, code);
      if (!consumed) throw new UnauthorizedException('Invalid code');
    }
    await this.db.query(
      'UPDATE users SET mfa_enabled=false, mfa_secret_enc=NULL, mfa_backup_codes_hash=NULL WHERE id=$1',
      [userId],
    );
    return { ok: true };
  }

  async verifyChallenge(challengeToken: string, code: string): Promise<{ user: any; tokens: TokenPair }> {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(challengeToken, { secret: process.env.JWT_SECRET || 'dev-secret' });
    } catch {
      throw new UnauthorizedException('Invalid MFA challenge');
    }
    if (payload.typ !== 'mfa_challenge') throw new UnauthorizedException();

    const u = await this.user(payload.sub);
    if (!u.mfa_enabled || !u.mfa_secret_enc) {
      // The challenge was issued but MFA got disabled between login and verify; let the user through.
      const me = await this.auth.meOrThrow(u.id);
      return { user: me, tokens: this.auth.issueTokens(me) };
    }
    const totpOk = verifyTotp(u.mfa_secret_enc, code);
    const backupOk = totpOk ? false : await this.tryConsumeBackup(u.id, code);
    if (!totpOk && !backupOk) throw new UnauthorizedException('Invalid code');

    const me = await this.auth.meOrThrow(u.id);
    return { user: me, tokens: this.auth.issueTokens(me) };
  }

  private async tryConsumeBackup(userId: string, code: string): Promise<boolean> {
    const cleaned = String(code || '').replace(/\s+/g, '').toUpperCase();
    if (cleaned.length < 8) return false;
    const u = await this.user(userId);
    const hashes: string[] = Array.isArray(u.mfa_backup_codes_hash) ? u.mfa_backup_codes_hash : [];
    for (let i = 0; i < hashes.length; i++) {
      try {
        if (await argon2.verify(hashes[i], cleaned)) {
          const remaining = [...hashes.slice(0, i), ...hashes.slice(i + 1)];
          await this.db.query('UPDATE users SET mfa_backup_codes_hash=$1 WHERE id=$2', [
            JSON.stringify(remaining),
            userId,
          ]);
          return true;
        }
      } catch {
        /* ignore individual verify failures */
      }
    }
    return false;
  }

  private async user(id: string) {
    const r = await this.db.query<{
      id: string;
      email: string;
      mfa_enabled: boolean;
      mfa_secret_enc: string | null;
      mfa_backup_codes_hash: any;
    }>('SELECT id, email, mfa_enabled, mfa_secret_enc, mfa_backup_codes_hash FROM users WHERE id=$1 AND deleted_at IS NULL', [id]);
    if (!r.rowCount) throw new UnauthorizedException();
    return r.rows[0];
  }
}
