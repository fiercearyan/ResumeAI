'use client';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Ban, ExternalLink } from 'lucide-react';

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
