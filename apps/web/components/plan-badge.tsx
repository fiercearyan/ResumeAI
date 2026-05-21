'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

export function PlanBadge() {
  const { accessToken } = useAuth();
  const q = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => api.getBillingStatus(),
    enabled: !!accessToken,
    refetchOnWindowFocus: false,
    staleTime: 10_000,
  });
  const plan = q.data?.plan || 'free';
  const isPro = plan === 'pro';
  return (
    <Link
      href="/settings/billing"
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
        isPro
          ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-sm'
          : 'bg-muted text-muted-fg hover:bg-muted/80',
      )}
      title={isPro ? 'You\'re on the Pro plan' : 'Free plan — click to upgrade'}
    >
      <Sparkles size={12} /> {isPro ? 'Pro' : 'Free'}
    </Link>
  );
}
