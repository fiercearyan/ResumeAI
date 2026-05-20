'use client';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ResumeDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const resume = useQuery({ queryKey: ['resume', id], queryFn: () => api.getResume(id) });
  const jds = useQuery({ queryKey: ['jds'], queryFn: api.listJds });
  const [selected, setSelected] = useState<string>('');
  const score = useMutation({
    mutationFn: () => api.runScore(resume.data!.currentVersionId, selected),
    onSuccess: (s) => router.push(`/score/${s.id}`),
  });

  if (resume.isLoading || !resume.data) return <div className="p-8">Loading…</div>;
  const r = resume.data;
  const parsed = r.parsed || {};

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {parsed?.profile?.name || 'Parsed resume'}
        </h1>
        <p className="text-muted-fg">
          {r.sourceType.toUpperCase()} · {parsed?.profile?.email} · {parsed?.profile?.phone}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Score against a job description</CardTitle>
          <CardDescription>Pick a saved JD or add one first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jds.data?.length ? (
            <select
              className="w-full h-10 rounded-md border bg-transparent px-3 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select a job description…</option>
              {jds.data.map((j: any) => (
                <option key={j.id} value={j.id}>
                  {j.title} {j.company ? `· ${j.company}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-muted-fg">No JDs yet. Add one from the Job descriptions tab.</p>
          )}
          <div className="flex gap-2">
            <Button disabled={!selected || score.isPending} onClick={() => score.mutate()}>
              {score.isPending ? 'Scoring…' : 'Run ATS score'}
            </Button>
            {score.isError && (
              <span className="text-sm text-danger self-center">
                {(score.error as any)?.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="grid md:grid-cols-2 gap-4">
        {parsed.summary && (
          <Card>
            <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent className="whitespace-pre-line text-sm text-muted-fg">{parsed.summary}</CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle className="text-base">Skills</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {[...(parsed.skills || []), ...(parsed.skills_extracted || [])]
              .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
              .slice(0, 40)
              .map((s: string) => <Badge key={s}>{s}</Badge>)}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Experience</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(parsed.experience || []).map((e: any, i: number) => (
              <div key={i} className="border-l-2 border-muted pl-3">
                <div className="font-medium">
                  {e.title} {e.company ? `· ${e.company}` : ''}{' '}
                  <span className="text-muted-fg text-xs ml-1">{e.start} – {e.end}</span>
                </div>
                <ul className="list-disc list-inside text-sm text-muted-fg space-y-1 mt-1">
                  {(e.bullets || []).map((b: string, bi: number) => <li key={bi}>{b}</li>)}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Education</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {(parsed.education || []).map((e: any, i: number) => <li key={i}>{e.raw || e.summary}</li>)}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
