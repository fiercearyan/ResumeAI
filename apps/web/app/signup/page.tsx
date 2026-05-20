'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OAuthButtons } from '@/components/oauth-buttons';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

export default function SignupPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const r = await api.signup(email, password, fullName);
      setSession(r.tokens, r.user);
      router.replace('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Start scoring resumes in seconds.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <Input placeholder="Full name (optional)" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={busy} className="w-full">{busy ? 'Creating…' : 'Sign up'}</Button>
          </form>
          <div className="pt-4">
            <OAuthButtons redirect="/dashboard" />
          </div>
          <p className="text-sm text-muted-fg pt-4">
            Already have an account? <Link className="text-primary underline" href="/login">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
