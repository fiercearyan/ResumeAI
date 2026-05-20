'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { CompletionRing } from './completion-ring';
import { cn } from '@/lib/utils';

/**
 * Top-right chip rendered in AppShell on every authenticated page:
 *   [ avatar ]  Hi, {FirstName}    ( ring with % )
 * Avatar = initials on a deterministic-coloured circle.
 * Click navigates to /profile.
 */
export function ProfileChip() {
  const { user, accessToken } = useAuth();
  const q = useQuery({
    queryKey: ['profile-summary'],
    queryFn: () => api.getProfile(),
    enabled: !!accessToken,
    refetchOnWindowFocus: false,
    // The ring is updated by mutations on the profile page via invalidate.
    staleTime: 10_000,
  });

  const fullName: string | null =
    q.data?.profile?.fullName || user?.fullName || null;
  const firstName =
    (fullName && fullName.trim().split(/\s+/)[0]) ||
    (user?.email && user.email.split('@')[0]) ||
    'there';
  const pct: number = q.data?.profile?.completionPct ?? 0;

  const initials = computeInitials(fullName, user?.email);
  const avatarColour = colourForKey((user?.id || user?.email || 'x') as string);

  return (
    <Link
      href="/profile"
      className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-muted/60 transition-colors"
      title={`Profile ${pct}% complete`}
    >
      <span
        className="grid place-items-center h-9 w-9 rounded-full text-white text-sm font-semibold shadow-sm"
        style={{ background: avatarColour }}
      >
        {initials}
      </span>
      <span className={cn('hidden sm:inline text-sm', 'text-fg')}>
        Hi, <span className="font-medium">{firstName}</span>
      </span>
      <CompletionRing value={pct} size={40} />
    </Link>
  );
}

function computeInitials(fullName: string | null | undefined, email?: string): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/);
    const a = parts[0]?.[0] || '';
    const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (a + b).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

// Deterministic pleasant gradient pair from a stable hash.
function colourForKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  const hue1 = h % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 52%), hsl(${hue2}, 75%, 45%))`;
}
