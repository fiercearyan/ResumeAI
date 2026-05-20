'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Github, Linkedin, KeyRound, Download, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function AccountSettings() {
  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Account &amp; security</h1>
        <p className="text-muted-fg text-sm">Multi-factor authentication, connected accounts, and your data.</p>
      </header>
      <MfaSection />
      <ConnectedAccountsSection />
      <DangerZone />
    </div>
  );
}

// ---------- MFA ----------

function MfaSection() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const qc = useQueryClient();
  const mfaEnabled = !!me.data?.mfaEnabled;
  const [phase, setPhase] = useState<'idle' | 'enroll' | 'disable'>('idle');
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startEnroll() {
    setError(null);
    try {
      const r = await api.mfaEnrollStart();
      setOtpauthUrl(r.otpauthUrl);
      setSecret(r.secret);
      setPhase('enroll');
    } catch (e: any) { setError(e?.message || 'Could not start enrollment'); }
  }

  async function confirmEnroll() {
    setError(null);
    try {
      const r = await api.mfaEnrollConfirm(code.trim());
      setBackupCodes(r.backupCodes);
      setCode('');
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch (e: any) { setError(e?.message || 'Invalid code'); }
  }

  async function disable() {
    setError(null);
    try {
      await api.mfaDisable(code.trim());
      setPhase('idle');
      setCode('');
      qc.invalidateQueries({ queryKey: ['me'] });
    } catch (e: any) { setError(e?.message || 'Invalid code'); }
  }

  const qrSrc = otpauthUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpauthUrl)}`
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {mfaEnabled
            ? <ShieldCheck size={20} className="text-success" />
            : <ShieldAlert size={20} className="text-warning" />}
          <CardTitle>Two-factor authentication</CardTitle>
        </div>
        <CardDescription>
          Adds a TOTP code on every login. Strongly recommended if you enable auto-apply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!mfaEnabled && phase === 'idle' && (
          <Button onClick={startEnroll}><KeyRound size={16} /> Enable MFA</Button>
        )}
        {!mfaEnabled && phase === 'enroll' && !backupCodes && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-[180px_1fr] gap-4 items-center">
              {qrSrc && <img src={qrSrc} alt="Scan with your authenticator" className="rounded border" />}
              <div className="text-sm space-y-2">
                <p>Scan the QR with Google Authenticator, 1Password, or Authy. Or paste this secret:</p>
                <code className="block bg-muted px-2 py-1 rounded text-xs break-all">{secret}</code>
                <p>Then enter the 6-digit code below to finish enrollment.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" className="max-w-[160px]" />
              <Button onClick={confirmEnroll} disabled={code.trim().length < 6}>Confirm</Button>
              <Button variant="outline" onClick={() => setPhase('idle')}>Cancel</Button>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}
        {!mfaEnabled && backupCodes && (
          <div className="space-y-2">
            <p className="text-sm text-success font-medium">MFA enabled. Save these backup codes somewhere safe — each one can be used once if you lose your device.</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {backupCodes.map((c) => (
                <code key={c} className="px-2 py-1 bg-muted rounded text-xs text-center">{c}</code>
              ))}
            </div>
            <Button variant="outline" onClick={() => { setBackupCodes(null); setPhase('idle'); }}>Done</Button>
          </div>
        )}
        {mfaEnabled && phase === 'idle' && (
          <div className="space-y-2">
            <Badge variant="success">MFA enabled</Badge>
            <div className="text-sm">
              <Button variant="outline" onClick={() => setPhase('disable')}>Disable MFA</Button>
            </div>
          </div>
        )}
        {mfaEnabled && phase === 'disable' && (
          <div className="space-y-2">
            <p className="text-sm">Enter a current 6-digit code (or a backup code) to disable MFA:</p>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" className="max-w-[200px]" />
              <Button onClick={disable} variant="destructive">Disable</Button>
              <Button variant="outline" onClick={() => setPhase('idle')}>Cancel</Button>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Connected accounts ----------

function ConnectedAccountsSection() {
  const qc = useQueryClient();
  const identities = useQuery({ queryKey: ['identities'], queryFn: api.listIdentities });
  const providers = useQuery({ queryKey: ['oauth-providers'], queryFn: api.listProviders });
  const unlink = useMutation({
    mutationFn: (p: string) => api.unlinkIdentity(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identities'] }),
  });

  const linked = new Map((identities.data || []).map((i: any) => [i.provider, i]));
  const all = providers.data?.providers || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>Sign in with another provider. Each can be linked to one ResumeAI account at a time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {all.map((p: any) => {
          const Icon = p.key === 'github' ? Github : p.key === 'linkedin' ? Linkedin : KeyRound;
          const ident = linked.get(p.key);
          return (
            <div key={p.key} className="flex items-center justify-between p-3 rounded border">
              <div className="flex items-center gap-3">
                <Icon size={18} />
                <div>
                  <div className="font-medium capitalize">{p.key}</div>
                  <div className="text-xs text-muted-fg">
                    {!p.enabled
                      ? 'Provider not configured on this server'
                      : ident
                      ? `Linked${ident.email ? ` · ${ident.email}` : ''}`
                      : 'Not linked'}
                  </div>
                </div>
              </div>
              {p.enabled && (
                ident ? (
                  <Button size="sm" variant="outline" onClick={() => unlink.mutate(p.key)}>Unlink</Button>
                ) : (
                  <Button size="sm" onClick={() => (window.location.href = api.oauthStartUrl(p.key, '/settings/account'))}>
                    Link
                  </Button>
                )
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ---------- Danger zone ----------

function DangerZone() {
  const router = useRouter();
  const { accessToken, clear } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function downloadExport() {
    fetch(api.exportMeUrl(), { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'resumeai-export.json';
        document.body.appendChild(a); a.click(); a.remove();
      });
  }

  async function deleteAccount() {
    setBusy(true); setError(null);
    try {
      await api.deleteMe();
      clear();
      router.replace('/');
    } catch (e: any) { setError(e?.message || 'Delete failed'); setBusy(false); }
  }

  return (
    <Card className="border-danger/30">
      <CardHeader>
        <CardTitle className="text-danger">Danger zone</CardTitle>
        <CardDescription>Export everything we have on file, or wipe your account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={downloadExport}><Download size={16} /> Download my data (JSON)</Button>
        </div>
        {!confirming ? (
          <Button variant="destructive" onClick={() => setConfirming(true)}>
            <Trash2 size={16} /> Delete my account
          </Button>
        ) : (
          <div className="p-3 rounded border border-danger/40 bg-danger/5 space-y-2">
            <p className="text-sm">This wipes your resumes, JDs, scores, applications, and parsed documents from every store. It cannot be undone.</p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={deleteAccount} disabled={busy}>
                {busy ? 'Deleting…' : 'Yes, delete everything'}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
