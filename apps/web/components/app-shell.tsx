'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { FileText, Briefcase, LayoutDashboard, LogOut, Moon, Sun, Send, Settings } from 'lucide-react';
import { useState } from 'react';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/resumes', label: 'Resumes', icon: FileText },
  { href: '/jobs', label: 'Job descriptions', icon: Briefcase },
  { href: '/applications', label: 'Auto-apply', icon: Send },
  { href: '/settings/preferences', label: 'Preferences', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { accessToken, hydrate, hydrated, clear, user } = useAuth();
  const [dark, setDark] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (hydrated && !accessToken) router.replace('/login');
  }, [hydrated, accessToken, router]);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setDark(next);
  }

  if (!hydrated || !accessToken) return null;

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r flex flex-col">
        <div className="p-5 text-lg font-semibold tracking-tight">ResumeAI</div>
        <nav className="px-3 space-y-1">
          {nav.map((item) => {
            const active = path === item.href || path?.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm',
                  active ? 'bg-muted text-fg' : 'text-muted-fg hover:bg-muted hover:text-fg',
                )}
              >
                <Icon size={16} /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4 border-t space-y-2">
          <div className="text-xs text-muted-fg truncate">{user?.email}</div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={toggleTheme} className="flex-1">
              {dark ? <Sun size={14} /> : <Moon size={14} />} {dark ? 'Light' : 'Dark'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { clear(); router.replace('/login'); }}
              className="flex-1"
            >
              <LogOut size={14} /> Sign out
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
