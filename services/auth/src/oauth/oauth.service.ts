import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { DbService } from '../db.service';
import { AuthService, AuthUser, TokenPair } from '../auth.service';
import { ProviderKey, providers } from './providers';
import { enc } from './crypto';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min
const STATE = new Map<
  string,
  {
    provider: ProviderKey;
    redirectAfter?: string;
    /** When linking from an authenticated session, the user the new identity will attach to. */
    linkUserId?: string;
    expiresAt: number;
  }
>();

function newState(): string {
  return randomBytes(24).toString('base64url');
}

function pruneExpired() {
  const now = Date.now();
  for (const [k, v] of STATE) if (v.expiresAt < now) STATE.delete(k);
}

@Injectable()
export class OAuthService {
  constructor(private db: DbService, private auth: AuthService, private jwt: JwtService) {}

  enabledProviders(): { key: ProviderKey; enabled: boolean }[] {
    return (['google', 'github', 'linkedin'] as ProviderKey[]).map((k) => ({
      key: k,
      enabled: providers[k].enabled() || mockMode(),
    }));
  }

  startAuthorize(providerKey: ProviderKey, redirectAfter?: string, linkUserId?: string): string {
    const p = providers[providerKey];
    if (!p) throw new NotFoundException(`unknown provider ${providerKey}`);
    if (!p.enabled() && !mockMode()) throw new BadRequestException(`${providerKey} not configured`);
    pruneExpired();
    const state = newState();
    STATE.set(state, {
      provider: providerKey,
      redirectAfter,
      linkUserId,
      expiresAt: Date.now() + STATE_TTL_MS,
    });
    if (mockMode()) {
      // Skip the network round-trip and immediately bounce back to our own callback.
      return `${p.redirectUri}?code=MOCK_${providerKey}&state=${encodeURIComponent(state)}`;
    }
    return p.authorizeUrl(state);
  }

  async handleCallback(providerKey: ProviderKey, code: string, state: string) {
    const p = providers[providerKey];
    if (!p) throw new NotFoundException();
    const ctx = STATE.get(state);
    if (!ctx) throw new BadRequestException('invalid or expired state');
    STATE.delete(state);
    if (ctx.provider !== providerKey) throw new BadRequestException('state/provider mismatch');

    let profile, tokens;
    if (mockMode()) {
      profile = {
        providerUserId: `mock-${providerKey}-${code.slice(-8)}`,
        email: `mock-${providerKey}-${Date.now()}@example.com`,
        fullName: `Mock ${providerKey} User`,
      };
      tokens = { accessToken: 'MOCK_ACCESS', refreshToken: null, expiresInSec: 3600 };
    } else {
      tokens = await p.exchangeCode(code, p.redirectUri);
      profile = await p.fetchProfile(tokens.accessToken);
    }

    // Resolve which user this identity attaches to.
    //
    // Priority:
    //   1. If the OAuth flow was started while authenticated (linkUserId set),
    //      attach to that user. This is the "Link from Account Settings"
    //      path and it bypasses email matching entirely so users with different
    //      provider-emails can still consolidate.
    //   2. Otherwise look up by (provider, provider_user_id) — already linked
    //      from a previous sign-in.
    //   3. Otherwise look up by email — same person signing in via a new
    //      provider that happens to share an email.
    //   4. Otherwise create a new user.
    let userId: string | null = null;

    const idLookup = await this.db.query<{ user_id: string }>(
      'SELECT user_id FROM oauth_identities WHERE provider=$1 AND provider_user_id=$2',
      [providerKey, profile.providerUserId],
    );
    const existingIdUserId = idLookup.rowCount && idLookup.rowCount > 0 ? idLookup.rows[0].user_id : null;

    if (ctx.linkUserId) {
      // Linking from an authenticated session.
      if (existingIdUserId && existingIdUserId !== ctx.linkUserId) {
        throw new BadRequestException(
          `That ${providerKey} account is already linked to a different ResumeAI account. ` +
            `Sign out and use that account, or unlink the provider there first.`,
        );
      }
      userId = ctx.linkUserId;
    } else if (existingIdUserId) {
      userId = existingIdUserId;
    } else if (profile.email) {
      const u = await this.db.query<{ id: string }>(
        'SELECT id FROM users WHERE email=$1 AND deleted_at IS NULL',
        [profile.email.toLowerCase()],
      );
      if (u.rowCount && u.rowCount > 0) {
        userId = u.rows[0].id;
      }
    }
    if (!userId) {
      // Create new user.
      if (!profile.email) throw new BadRequestException('OAuth provider returned no email; cannot create account');
      const ins = await this.db.query<{ id: string }>(
        'INSERT INTO users (email, password_hash, full_name) VALUES ($1, NULL, $2) RETURNING id',
        [profile.email.toLowerCase(), profile.fullName],
      );
      userId = ins.rows[0].id;
    }

    // Upsert identity.
    const expiresAt = tokens.expiresInSec ? new Date(Date.now() + tokens.expiresInSec * 1000) : null;
    await this.db.query(
      `INSERT INTO oauth_identities (user_id, provider, provider_user_id, email, access_token_enc, refresh_token_enc, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (provider, provider_user_id) DO UPDATE
         SET access_token_enc = EXCLUDED.access_token_enc,
             refresh_token_enc = EXCLUDED.refresh_token_enc,
             expires_at = EXCLUDED.expires_at,
             email = EXCLUDED.email`,
      [userId, providerKey, profile.providerUserId, profile.email, enc(tokens.accessToken), enc(tokens.refreshToken ?? null), expiresAt],
    );

    // For link-from-authenticated flows, don't issue new session tokens —
    // the user is already signed in and we just want to drop them back where
    // they came from with a "linked ✓" indicator.
    if (ctx.linkUserId) {
      return {
        linked: true,
        provider: providerKey,
        redirectAfter: ctx.redirectAfter || '/settings/account',
      };
    }

    // Sign-in flow: issue tokens (or an MFA challenge).
    const me = await this.auth.meOrThrow(userId!);
    const mfa = await this.db.query<{ mfa_enabled: boolean }>(
      'SELECT mfa_enabled FROM users WHERE id=$1',
      [userId],
    );
    if (mfa.rowCount && mfa.rows[0].mfa_enabled) {
      const challenge = this.jwt.sign(
        { sub: userId, typ: 'mfa_challenge' },
        { expiresIn: '5m' },
      );
      return { mfaRequired: true, challenge, redirectAfter: ctx.redirectAfter || null };
    }
    const pair: TokenPair = this.auth.issueTokens(me);
    return { mfaRequired: false, user: me, tokens: pair, redirectAfter: ctx.redirectAfter || null };
  }

  async listIdentities(userId: string) {
    const r = await this.db.query<{ provider: string; email: string | null; linked_at: Date }>(
      'SELECT provider, email, linked_at FROM oauth_identities WHERE user_id=$1 ORDER BY linked_at',
      [userId],
    );
    return r.rows;
  }

  async unlink(userId: string, provider: ProviderKey) {
    await this.db.query('DELETE FROM oauth_identities WHERE user_id=$1 AND provider=$2', [userId, provider]);
    return { ok: true };
  }
}

export function mockMode(): boolean {
  return process.env.OAUTH_MOCK === 'true';
}
