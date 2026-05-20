'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send } from 'lucide-react';

const STATUSES = [
  { key: 'queued', label: 'Queued' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'awaiting_user', label: 'Awaiting you' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'failed', label: 'Failed' },
];

function StatusBadge({ status }: { status: string }) {
  const variant: any =
    status === 'submitted' ? 'success' :
    status === 'failed' ? 'danger' :
    status === 'awaiting_user' ? 'warning' :
    'outline';
  return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
}

export default function ApplicationsPage() {
  const q = useQuery({ queryKey: ['applications'], queryFn: () => api.listApplications(), refetchInterval: 4_000 });
  const apps = q.data || [];
  const grouped = STATUSES.map((s) => ({ ...s, items: apps.filter((a: any) => a.status === s.key) }));

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auto-apply tracker</h1>
          <p className="text-muted-fg">
            Greenhouse postings only in Phase 3. Review mode pauses before submit — you approve manually.
          </p>
        </div>
      </header>

      {apps.length === 0 && !q.isLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Send size={18} /> No applications yet</CardTitle>
            <CardDescription>
              From a score page, click <em>Apply with this resume</em> on a Greenhouse posting.
              Your scored JD must have a public posting URL (boards.greenhouse.io).
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {grouped.map((col) => (
          <Card key={col.key} className="bg-muted/20">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-muted-fg">{col.label}</CardTitle>
              <CardDescription>{col.items.length} application{col.items.length === 1 ? '' : 's'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {col.items.map((a: any) => (
                <Link
                  key={a.id}
                  href={`/applications/${a.id}`}
                  className="block p-3 rounded border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="text-sm font-medium truncate">{a.jd.title}</div>
                  <div className="text-xs text-muted-fg truncate">
                    {a.jd.company || a.platform} · {a.platform}
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <StatusBadge status={a.status} />
                    <span className="text-xs text-muted-fg">{a.mode}</span>
                  </div>
                </Link>
              ))}
              {col.items.length === 0 && <p className="text-xs text-muted-fg">—</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
