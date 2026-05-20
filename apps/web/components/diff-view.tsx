'use client';
import { cn } from '@/lib/utils';

/** Word-level diff: returns runs of {value, type: 'same'|'add'|'del'}. */
function diffWords(a: string, b: string) {
  const aw = a.split(/(\s+)/);
  const bw = b.split(/(\s+)/);
  const m = aw.length, n = bw.length;
  // LCS DP
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = aw[i] === bw[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: { value: string; type: 'same' | 'add' | 'del' }[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (aw[i] === bw[j]) { out.push({ value: aw[i], type: 'same' }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ value: aw[i], type: 'del' }); i++; }
    else { out.push({ value: bw[j], type: 'add' }); j++; }
  }
  while (i < m) { out.push({ value: aw[i++], type: 'del' }); }
  while (j < n) { out.push({ value: bw[j++], type: 'add' }); }
  return out;
}

export function InlineDiff({ before, after }: { before: string; after: string }) {
  const runs = diffWords(before || '', after || '');
  return (
    <div className="text-sm leading-relaxed">
      {runs.map((r, idx) => (
        <span
          key={idx}
          className={cn(
            r.type === 'add' && 'bg-success/15 text-success rounded px-0.5',
            r.type === 'del' && 'bg-danger/15 text-danger line-through rounded px-0.5',
          )}
        >
          {r.value}
        </span>
      ))}
    </div>
  );
}

export function SideBySide({ before, after, label }: { before: string; after: string; label?: string }) {
  const changed = before.trim() !== after.trim();
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div className="p-3 rounded border bg-muted/30">
        <div className="text-xs text-muted-fg mb-1">{label || 'Original'}</div>
        <div className="text-sm whitespace-pre-wrap">{before || '—'}</div>
      </div>
      <div className={cn('p-3 rounded border', changed ? 'border-success/40 bg-success/5' : 'bg-muted/30')}>
        <div className="text-xs text-muted-fg mb-1">Optimized{changed ? '' : ' (no change)'}</div>
        {changed ? <InlineDiff before={before} after={after} /> : <div className="text-sm whitespace-pre-wrap">{after || '—'}</div>}
      </div>
    </div>
  );
}
