'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OAuthButtons } from '@/components/oauth-buttons';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const { setSession, hydrate, accessToken, hydrated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (hydrated && accessToken) router.replace('/dashboard'); }, [hydrated, accessToken, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r: any = await api.login(email, password);
      if (r.mfaRequired) {
        setMfaChallenge(r.challenge);
      } else {
        setSession(r.tokens, r.user);
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa() {
    if (!mfaChallenge) return;
    setBusy(true); setError(null);
    try {
      const r = await api.mfaVerify(mfaChallenge, mfaCode.trim());
      setSession({ accessToken: r.tokens.accessToken, refreshToken: r.tokens.refreshToken }, r.user);
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e?.message || 'Invalid code');
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mfaChallenge ? 'Two-factor authentication' : 'Log in'}</CardTitle>
          <CardDescription>
            {mfaChallenge
              ? 'Enter the 6-digit code from your authenticator app — or a backup code.'
              : 'Welcome back to ResumeAI.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!mfaChallenge ? (
            <form onSubmit={submit} className="space-y-4">
              <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">{busy ? 'Logging in…' : 'Log in'}</Button>
            </form>
          ) : (
            <div className="space-y-4">
              <Input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123 456"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') submitMfa(); }}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button onClick={submitMfa} disabled={busy || !mfaCode.trim()} className="w-full">
                {busy ? 'Verifying…' : 'Verify'}
              </Button>
            </div>
          )}

          {!mfaChallenge && (
            <div className="pt-4">
              <OAuthButtons redirect="/dashboard" />
            </div>
          )}

          <p className="text-sm text-muted-fg pt-4">
            No account? <Link className="text-primary underline" href="/signup">Sign up</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
