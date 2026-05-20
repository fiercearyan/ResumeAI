'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const { setSession, hydrate, accessToken, hydrated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (hydrated && accessToken) router.replace('/dashboard'); }, [hydrated, accessToken, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api.login(email, password);
      setSession(r.tokens, r.user);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Welcome back to ResumeAI.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">{busy ? 'Logging in…' : 'Log in'}</Button>
          </form>
          <p className="text-sm text-muted-fg pt-4">
            No account? <Link className="text-primary underline" href="/signup">Sign up</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
