'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScoreRing } from '@/components/score-ring';
import { SideBySide } from '@/components/diff-view';
import { useAuth } from '@/lib/auth-store';
import { Download, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function OptimizePage() {
  const { versionId } = useParams<{ versionId: string }>();
  const { accessToken } = useAuth();
  const opt = useQuery({ queryKey: ['optimize', versionId], queryFn: () => api.getOptimize(versionId) });

  // Original version (for the diff): walk parentVersionId.
  const original = useQuery({
    queryKey: ['version-original', opt.data?.parentVersionId],
    queryFn: async () => {
      // The orchestrator currently doesn't expose getVersion separately;
      // we proxy through optimize/:parentId for parsed data.
      if (!opt.data?.parentVersionId) return null;
      return api.getOptimize(opt.data.parentVersionId).catch(() => null);
    },
    enabled: !!opt.data?.parentVersionId,
  });

  const promote = useMutation({
    mutationFn: () => api.promoteVersion(versionId),
  });

  if (opt.isLoading || !opt.data) return <div className="p-8">Loading optimization…</div>;

  const v = opt.data;
  const orig = original.data || null;
  const before = (orig?.parsed) || (v.parsed?._original) || null;
  const after = v.parsed;

  // The original version came from a non-optimized upload, so its mongo doc
  // doesn't include the same shape; fall back to "compare against the optimizer's
  // own snapshot of edits" if needed.
  const summaryBefore = before?.summary || '';
  const summaryAfter = after?.summary || '';

  // Build a flat list of bullet-pair diffs using `applied` records when available.
  const bulletEdits = (v.applied || []).filter((a: any) =>
    a.target === 'experience_bullet' || a.target === 'project_bullet',
  );
  const skillsEdits = (v.applied || []).filter((a: any) => a.target === 'skills');

  const oldOverall = orig?.score?.overall ?? null;
  const newOverall = v.score?.overall ?? null;
  const improvement =
    typeof oldOverall === 'number' && typeof newOverall === 'number'
      ? Number((newOverall - oldOverall).toFixed(2))
      : null;

  function downloadAuth(format: 'pdf' | 'tex') {
    const url = api.downloadOptimizedUrl(versionId, format);
    // Authenticated fetch then trigger browser save.
    fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `resume-${versionId.slice(0, 8)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Optimized resume</h1>
          <p className="text-muted-fg">AI rewrote {bulletEdits.length} bullet{bulletEdits.length === 1 ? '' : 's'} · surfaced {(skillsEdits[0]?.new_items?.length) || 0} skill{((skillsEdits[0]?.new_items?.length) || 0) === 1 ? '' : 's'}.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => downloadAuth('pdf')}><Download size={16} /> PDF</Button>
          {v.s3LatexKey && <Button variant="outline" onClick={() => downloadAuth('tex')}><FileText size={16} /> .tex</Button>}
          <Button onClick={() => promote.mutate()} disabled={promote.isPending || promote.isSuccess}>
            <CheckCircle2 size={16} /> {promote.isSuccess ? 'Promoted' : promote.isPending ? 'Promoting…' : 'Promote to current'}
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Score change</CardTitle>
          <CardDescription>Same JD, re-scored against the optimized resume.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-around gap-6 flex-wrap">
          <div className="text-center">
            <div className="text-xs text-muted-fg uppercase tracking-wider">Original</div>
            <ScoreRing score={oldOverall ?? 0} size={130} />
          </div>
          <ArrowRight size={28} className="text-muted-fg" />
          <div className="text-center">
            <div className="text-xs text-muted-fg uppercase tracking-wider">Optimized</div>
            <ScoreRing score={newOverall ?? 0} size={130} />
          </div>
          <div className={`text-center ${improvement && improvement > 0 ? 'text-success' : 'text-muted-fg'}`}>
            <div className="text-xs uppercase tracking-wider">Δ</div>
            <div className="text-3xl font-bold">
              {improvement === null ? '—' : (improvement > 0 ? '+' : '') + improvement}
            </div>
          </div>
        </CardContent>
      </Card>

      {(summaryBefore || summaryAfter) && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <SideBySide before={summaryBefore} after={summaryAfter} />
          </CardContent>
        </Card>
      )}

      {bulletEdits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Experience bullets ({bulletEdits.length})</CardTitle>
            <CardDescription>Each rewrite preserves the facts. Removed words shown in red, additions in green.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bulletEdits.map((b: any) => (
              <div key={b.id} className="space-y-1">
                <div className="text-xs text-muted-fg">
                  Role #{b.section_index + 1} · bullet #{b.bullet_index + 1}
                  {b.source && <Badge variant="outline" className="ml-2">{b.source}</Badge>}
                </div>
                <SideBySide before={b.original_text || ''} after={b.new_text} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {skillsEdits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Skills surfaced</CardTitle>
            <CardDescription>These already appeared in your resume body but were missing from the skills list.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {skillsEdits[0].new_items.map((s: string) => <Badge key={s} variant="success">+ {s}</Badge>)}
          </CardContent>
        </Card>
      )}

      {v.rejected?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rejected by truth-check ({v.rejected.length})</CardTitle>
            <CardDescription>These AI proposals were dropped because they would have introduced unverifiable facts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {v.rejected.map((r: any) => (
              <div key={r.id} className="text-sm border rounded p-2 bg-danger/5">
                <div className="text-xs text-danger mb-1">{r._rejected_reason || 'rejected'}</div>
                <div className="text-muted-fg line-through">{r.new_text}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
