'use client';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function PreferencesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['prefs'], queryFn: api.getPreferences });
  const [form, setForm] = useState<any>(null);

  useEffect(() => { if (q.data && !form) setForm(q.data); }, [q.data, form]);

  const save = useMutation({
    mutationFn: () => api.updatePreferences(form),
    onSuccess: (next) => {
      qc.setQueryData(['prefs'], next);
      setForm(next);
    },
  });

  if (!form) return <div className="p-8">Loading…</div>;
  const update = (k: string) => (e: any) => setForm({ ...form, [k]: typeof form[k] === 'boolean' ? e.target.checked : e.target.value });

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
        <p className="text-muted-fg">Used by the auto-apply worker to fill common form fields and pace your applications.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Surfaced into Greenhouse form fields.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <Input placeholder="First name" value={form.firstName || ''} onChange={update('firstName')} />
          <Input placeholder="Last name" value={form.lastName || ''} onChange={update('lastName')} />
          <Input placeholder="Phone (E.164)" value={form.phone || ''} onChange={update('phone')} />
          <Input placeholder="City" value={form.city || ''} onChange={update('city')} />
          <Input placeholder="Country code (US)" value={form.countryCode || ''} onChange={update('countryCode')} />
          <Input placeholder="Work auth (e.g. US citizen)" value={form.workAuth || ''} onChange={update('workAuth')} />
          <Input placeholder="LinkedIn URL" value={form.linkedinUrl || ''} onChange={update('linkedinUrl')} />
          <Input placeholder="GitHub URL" value={form.githubUrl || ''} onChange={update('githubUrl')} />
          <Input placeholder="Portfolio URL" value={form.portfolioUrl || ''} onChange={update('portfolioUrl')} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.needsSponsorship} onChange={update('needsSponsorship')} />
            I require sponsorship
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-apply controls</CardTitle>
          <CardDescription>Defaults for new applications. Each application can override the mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.autoApplyEnabled} onChange={update('autoApplyEnabled')} />
            Auto-apply enabled
          </label>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-fg block mb-1">Default mode</label>
              <select className="w-full h-10 rounded-md border bg-transparent px-3 text-sm" value={form.defaultMode || 'review'} onChange={(e) => setForm({ ...form, defaultMode: e.target.value })}>
                <option value="review">Review (recommended)</option>
                <option value="auto">Auto-submit</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-fg block mb-1">Min ATS score</label>
              <Input type="number" value={form.minAtsScore ?? 80} onChange={(e) => setForm({ ...form, minAtsScore: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-xs text-muted-fg block mb-1">Daily cap</label>
              <Input type="number" value={form.dailyApplyCap ?? 5} onChange={(e) => setForm({ ...form, dailyApplyCap: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save preferences'}
        </Button>
        {save.isSuccess && <span className="text-sm text-success self-center">Saved.</span>}
        {save.isError && <span className="text-sm text-danger self-center">{(save.error as any)?.message}</span>}
      </div>
    </div>
  );
}
