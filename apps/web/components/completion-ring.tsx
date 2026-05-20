'use client';
import { cn } from '@/lib/utils';

/**
 * Compact completion ring with three colour bands:
 *  - < 30   orange (warning)
 *  - 30-99  amber  (yellow)
 *  - = 100  green  (success)
 * Smoothly animates stroke-dashoffset on value change.
 */
export function CompletionRing({
  value,
  size = 40,
  strokeWidth = 4,
  showLabel = true,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const color =
    clamped >= 100
      ? 'text-success'
      : clamped >= 30
      ? 'text-amber-500'
      : 'text-warning';

  const fontSize = Math.max(10, Math.floor(size * 0.32));

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`Profile ${clamped}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn('transition-[stroke-dashoffset] duration-700 ease-out', color)}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      {showLabel && (
        <span
          className={cn('absolute font-semibold tabular-nums', color)}
          style={{ fontSize }}
        >
          {clamped}
        </span>
      )}
    </div>
  );
}
