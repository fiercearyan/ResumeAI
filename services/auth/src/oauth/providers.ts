/**
 * OAuth provider configuration.
 *
 * Each provider exposes a small adapter the OAuth service uses to:
 *  1. Build the authorize URL.
 *  2. Exchange the auth code for tokens.
 *  3. Fetch a normalized profile { providerUserId, email, fullName }.
 *
 * Values come from environment variables. When `OAUTH_MOCK=true`,
 * the service short-circuits the network calls (see oauth.service).
 */
export type ProviderKey = 'google' | 'github' | 'linkedin';

export interface OAuthProvider {
  key: ProviderKey;
  enabled(): boolean;
  authorizeUrl(state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  fetchProfile(accessToken: string): Promise<NormalizedProfile>;
  redirectUri: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string | null;
  expiresInSec?: number | null;
}

export interface NormalizedProfile {
  providerUserId: string;
  email: string | null;
  fullName: string | null;
}

const REDIRECT_BASE = process.env.OAUTH_REDIRECT_BASE || 'http://localhost:4001/auth/oauth';

function redirect(p: ProviderKey) {
  return `${REDIRECT_BASE}/${p}/callback`;
}

export const google: OAuthProvider = {
  key: 'google',
  redirectUri: redirect('google'),
  enabled: () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
  authorizeUrl(state) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'select_account',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },
  async exchangeCode(code, redirectUri) {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error(`google token exchange failed: ${r.status} ${await r.text()}`);
    const j = await r.json() as any;
    return { accessToken: j.access_token, refreshToken: j.refresh_token ?? null, expiresInSec: j.expires_in ?? null };
  },
  async fetchProfile(accessToken) {
    const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error(`google userinfo failed: ${r.status}`);
    const j = await r.json() as any;
    return { providerUserId: j.sub, email: j.email || null, fullName: j.name || null };
  },
};

export const github: OAuthProvider = {
  key: 'github',
  redirectUri: redirect('github'),
  enabled: () => !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET,
  authorizeUrl(state) {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID || '',
      redirect_uri: this.redirectUri,
      scope: 'read:user user:email',
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  },
  async exchangeCode(code, redirectUri) {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!r.ok) throw new Error(`github token exchange failed: ${r.status} ${await r.text()}`);
    const j = await r.json() as any;
    if (j.error) throw new Error(`github token exchange failed: ${j.error_description || j.error}`);
    return { accessToken: j.access_token, refreshToken: j.refresh_token ?? null, expiresInSec: j.expires_in ?? null };
  },
  async fetchProfile(accessToken) {
    const userR = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    });
    if (!userR.ok) throw new Error(`github user failed: ${userR.status}`);
    const u = await userR.json() as any;
    let email: string | null = u.email || null;
    if (!email) {
      const emR = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
      });
      if (emR.ok) {
        const ems = await emR.json() as any[];
        const primary = ems.find((e: any) => e.primary && e.verified) || ems[0];
        email = primary?.email || null;
      }
    }
    return { providerUserId: String(u.id), email, fullName: u.name || u.login || null };
  },
};

export const linkedin: OAuthProvider = {
  key: 'linkedin',
  redirectUri: redirect('linkedin'),
  // LinkedIn's OAuth app review is slow; treat as not-yet-wired by default.
  enabled: () => !!process.env.LINKEDIN_CLIENT_ID && !!process.env.LINKEDIN_CLIENT_SECRET,
  authorizeUrl(state) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      redirect_uri: this.redirectUri,
      scope: 'openid profile email',
      state,
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  },
  async exchangeCode(code, redirectUri) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID || '',
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
    });
    const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!r.ok) throw new Error(`linkedin token exchange failed: ${r.status}`);
    const j = await r.json() as any;
    return { accessToken: j.access_token, refreshToken: j.refresh_token ?? null, expiresInSec: j.expires_in ?? null };
  },
  async fetchProfile(accessToken) {
    const r = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error(`linkedin userinfo failed: ${r.status}`);
    const j = await r.json() as any;
    return { providerUserId: j.sub, email: j.email || null, fullName: j.name || null };
  },
};

export const providers: Record<ProviderKey, OAuthProvider> = { google, github, linkedin };
