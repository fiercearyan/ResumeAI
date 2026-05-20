'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

export default function JobsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['jds'], queryFn: api.listJds });
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createJd(mode, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jds'] });
      setValue('');
      setError(null);
    },
    onError: (e: any) => setError(e.message || 'Could not save'),
  });

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Job descriptions</h1>
        <p className="text-muted-fg">Paste a posting URL or the JD text. We'll extract the structured fields.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add a job description</CardTitle>
          <CardDescription>Choose URL or text mode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant={mode === 'url' ? 'default' : 'outline'} size="sm" onClick={() => setMode('url')}>URL</Button>
            <Button variant={mode === 'text' ? 'default' : 'outline'} size="sm" onClick={() => setMode('text')}>Text</Button>
          </div>
          {mode === 'url' ? (
            <Input placeholder="https://boards.greenhouse.io/…" value={value} onChange={(e) => setValue(e.target.value)} />
          ) : (
            <Textarea placeholder="Paste the job description here…" value={value} onChange={(e) => setValue(e.target.value)} />
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button disabled={!value || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Parsing…' : 'Save and parse'}
          </Button>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-lg font-semibold mb-3">Saved JDs</h2>
        {list.isLoading ? (
          <p className="text-muted-fg text-sm">Loading…</p>
        ) : !list.data?.length ? (
          <p className="text-muted-fg text-sm">No JDs yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {list.data.map((j: any) => (
              <Card key={j.id}>
                <CardHeader>
                  <CardTitle className="text-base">{j.title || 'Untitled role'}</CardTitle>
                  <CardDescription>
                    {j.company ?? '—'} {j.location ? `· ${j.location}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {(j.parsedJson?.must_haves || []).slice(0, 8).map((s: string) => (
                      <Badge key={s} variant="default">{s}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-fg">{new Date(j.createdAt).toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
