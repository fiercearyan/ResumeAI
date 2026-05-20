'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Github, Linkedin, LogIn } from 'lucide-react';

export function OAuthButtons({ redirect = '/dashboard' }: { redirect?: string }) {
  const q = useQuery({ queryKey: ['oauth-providers'], queryFn: api.listProviders });
  const providers = q.data?.providers || [];

  if (!providers.length) return null;

  function start(p: string) {
    window.location.href = api.oauthStartUrl(p, redirect);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-fg uppercase tracking-wider">
        <span className="flex-1 h-px bg-border" /> or continue with <span className="flex-1 h-px bg-border" />
      </div>
      <div className="grid gap-2">
        {providers.map((p) => {
          if (!p.enabled) return null;
          const Icon = p.key === 'github' ? Github : p.key === 'linkedin' ? Linkedin : LogIn;
          const label = p.key === 'google' ? 'Continue with Google' : p.key === 'github' ? 'Continue with GitHub' : 'Continue with LinkedIn';
          return (
            <Button key={p.key} variant="outline" onClick={() => start(p.key)} className="w-full">
              <Icon size={16} /> {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
