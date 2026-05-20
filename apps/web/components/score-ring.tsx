'use client';
import { cn } from '@/lib/utils';

export function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const colorClass =
    clamped >= 80 ? 'text-success' : clamped >= 60 ? 'text-warning' : 'text-danger';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={10}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
          className={cn('transition-[stroke-dashoffset] duration-1000', colorClass)}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className={cn('text-3xl font-bold', colorClass)}>{Math.round(clamped)}</div>
          <div className="text-xs text-muted-fg">/ 100</div>
        </div>
      </div>
    </div>
  );
}

export function SectionBar({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const color =
    v >= 80 ? 'bg-success' : v >= 60 ? 'bg-warning' : 'bg-danger';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-fg">{label}</span>
        <span className="font-medium">{v.toFixed(0)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full transition-all duration-700', color)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
