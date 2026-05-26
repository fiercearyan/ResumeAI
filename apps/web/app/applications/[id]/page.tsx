'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { CheckCircle2, Ban, ExternalLink, HelpCircle, Sparkles } from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const variant: any =
    status === 'submitted' ? 'success' :
    status === 'failed' ? 'danger' :
    status === 'awaiting_user' ? 'warning' :
    'outline';
  return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
}

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['application', id],
    queryFn: () => api.getApplication(id),
    refetchInterval: 3_000,
  });
  const approve = useMutation({
    mutationFn: () => api.approveApplication(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['application', id] }),
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelApplication(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['application', id] }),
  });

  if (q.isLoading || !q.data) return <div className="p-8">Loading…</div>;
  const { application, events } = q.data;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {application.jd.title}
          </h1>
          <p className="text-muted-fg">
            {application.jd.company || application.platform} · {application.platform} · mode {application.mode}
            {application.jd.sourceUrl && (
              <a href={application.jd.sourceUrl} target="_blank" className="ml-2 text-primary inline-flex items-center gap-1">
                source <ExternalLink size={12} />
              </a>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={application.status} />
          {application.status === 'awaiting_user' && (
            <>
              <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
                <CheckCircle2 size={16} /> Approve &amp; submit
              </Button>
              <Button variant="outline" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                <Ban size={16} /> Cancel
              </Button>
            </>
          )}
        </div>
      </header>

      {application.lastError && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="p-4 text-sm text-danger">{application.lastError}</CardContent>
        </Card>
      )}

      <PendingQuestionsCard applicationId={id} status={application.status} onAnswered={() => qc.invalidateQueries({ queryKey: ['application', id] })} />

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>Every step the worker took, in order.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative border-l ml-2">
            {events.map((e: any) => (
              <li key={e.id} className="mb-4 ml-4">
                <div className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ${e.ok ? 'bg-success' : 'bg-danger'}`} />
                <div className="text-xs text-muted-fg">{new Date(e.at).toLocaleString()}</div>
                <div className="text-sm font-medium">{e.step}</div>
                {e.message && <div className="text-xs text-muted-fg">{e.message}</div>}
                {e.screenshotUrl && (
                  <a href={e.screenshotUrl} target="_blank" className="block mt-2">
                    <img src={e.screenshotUrl} alt={e.step} className="max-w-md border rounded shadow-sm" />
                  </a>
                )}
              </li>
            ))}
            {events.length === 0 && <p className="text-sm text-muted-fg">No events yet — worker hasn't picked this up.</p>}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function PendingQuestionsCard({
  applicationId, status, onAnswered,
}: { applicationId: string; status: string; onAnswered: () => void }) {
  const q = useQuery({
    queryKey: ['app-questionnaire', applicationId],
    queryFn: () => api.getApplicationQuestionnaire(applicationId),
    refetchInterval: status === 'awaiting_user' ? 3_000 : false,
    enabled: status === 'awaiting_user' || status === 'submitted',
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () => {
      const list = Object.entries(answers)
        .map(([label, ans]) => ({ questionText: label, answerText: ans.trim() }))
        .filter((p) => p.answerText.length > 0);
      return api.answerPending(applicationId, list);
    },
    onSuccess: () => {
      setAnswers({});
      onAnswered();
    },
  });

  if (!q.data) return null;
  const payload = q.data.payload || {};
  const pending = payload.pending || [];
  const filled = payload.filled || [];
  if (!pending.length && !filled.length) return null;

  return (
    <Card className={pending.length > 0 ? 'border-warning/40' : ''}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <HelpCircle size={16} /> Application questionnaire
        </CardTitle>
        <CardDescription>
          {pending.length > 0
            ? `${pending.length} unanswered question${pending.length === 1 ? '' : 's'} — answer them once and we'll reuse the same answers on every future Greenhouse application.`
            : `All ${filled.length} form fields autofilled. You can review the screenshots below.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending.length > 0 && (
          <div className="space-y-3">
            {pending.map((p: any) => (
              <div key={p.label} className="space-y-1">
                <label className="text-sm font-medium flex items-center gap-2">
                  {p.label}
                  {p.required && <Badge variant="warning">required</Badge>}
                  {p.kind && <span className="text-xs text-muted-fg">{p.kind}</span>}
                </label>
                {p.kind === 'select' && Array.isArray(p.options) ? (
                  <select
                    className="w-full h-10 rounded-md border bg-transparent px-3 text-sm"
                    value={answers[p.label] || ''}
                    onChange={(e) => setAnswers({ ...answers, [p.label]: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {p.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : p.kind === 'textarea' ? (
                  <Textarea
                    value={answers[p.label] || ''}
                    onChange={(e) => setAnswers({ ...answers, [p.label]: e.target.value })}
                  />
                ) : (
                  <Input
                    value={answers[p.label] || ''}
                    onChange={(e) => setAnswers({ ...answers, [p.label]: e.target.value })}
                  />
                )}
              </div>
            ))}
            <div className="flex gap-2 items-center pt-1">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                <Sparkles size={16} /> {save.isPending ? 'Saving…' : 'Save answers & resume'}
              </Button>
              <span className="text-xs text-muted-fg">
                Saved answers are reused automatically next time.
              </span>
            </div>
          </div>
        )}
        {filled.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-fg">Show autofilled fields ({filled.length})</summary>
            <ul className="mt-2 space-y-1">
              {filled.map((f: any) => (
                <li key={f.label} className="flex items-center justify-between gap-2 text-xs border-b py-1">
                  <span className="truncate">{f.label}</span>
                  <span className="text-muted-fg shrink-0">{f.source} · {(f.confidence * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
