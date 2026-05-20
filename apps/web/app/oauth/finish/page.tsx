'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * OAuth callback finisher.
 *
 * The auth service redirects here with tokens (or an MFA challenge) in the
 * URL hash fragment. We parse, store in auth-store, optionally prompt for MFA,
 * then navigate to the `next` query param.
 */
export default function OAuthFinish() {
  const router = useRouter();
  const sp = useSearchParams();
  const { setSession } = useAuth();
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) { setError('No tokens returned'); return; }
    const params = new URLSearchParams(hash);

    // Authenticated link flow finished — the session is unchanged.
    if (params.get('linked') === '1') {
      router.replace(sp.get('next') || '/settings/account');
      return;
    }

    const challenge = params.get('mfa_challenge');
    if (challenge) {
      setMfaChallenge(challenge);
      return;
    }
    const access = params.get('access');
    const refresh = params.get('refresh');
    const userRaw = params.get('user');
    if (!access || !refresh || !userRaw) { setError('Invalid OAuth response'); return; }
    try {
      const user = JSON.parse(decodeURIComponent(userRaw));
      setSession({ accessToken: access, refreshToken: refresh }, user);
      router.replace(sp.get('next') || '/dashboard');
    } catch {
      setError('Failed to parse OAuth response');
    }
  }, [router, sp, setSession]);

  async function submitMfa() {
    if (!mfaChallenge) return;
    setBusy(true); setError(null);
    try {
      const r = await api.mfaVerify(mfaChallenge, code.trim());
      setSession({ accessToken: r.tokens.accessToken, refreshToken: r.tokens.refreshToken }, r.user);
      router.replace(sp.get('next') || '/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Invalid code');
    } finally { setBusy(false); }
  }

  if (mfaChallenge) {
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Two-factor authentication</CardTitle>
            <CardDescription>Enter the 6-digit code from your authenticator app — or a backup code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123 456"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') submitMfa(); }}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button onClick={submitMfa} disabled={busy || !code.trim()} className="w-full">
              {busy ? 'Verifying…' : 'Verify'}
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          {error ? <p className="text-danger">{error}</p> : <p className="text-muted-fg">Signing you in…</p>}
        </CardContent>
      </Card>
    </main>
  );
}
