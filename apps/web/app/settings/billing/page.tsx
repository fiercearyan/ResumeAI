'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, X, Activity } from 'lucide-react';

export default function BillingPage() {
  const sp = useSearchParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['billing-status'], queryFn: () => api.getBillingStatus() });
  const upgrade = useMutation({
    mutationFn: () => api.startCheckout('pro'),
    onSuccess: (r) => { window.location.href = r.url; },
  });
  const cancel = useMutation({
    mutationFn: () => api.openBillingPortal(),
    onSuccess: (r) => { window.location.href = r.url; },
  });

  useEffect(() => {
    if (sp.get('upgraded') || sp.get('canceled')) {
      qc.invalidateQueries({ queryKey: ['billing-status'] });
    }
  }, [sp, qc]);

  if (q.isLoading || !q.data) return <div className="p-8">Loading billing…</div>;

  const { plan: currentPlan, catalog, customer, mock } = q.data;
  const plans = Object.values(catalog) as Array<any>;

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-muted-fg text-sm">Manage your plan, see usage, and upgrade.</p>
        </div>
        <Badge variant={currentPlan === 'pro' ? 'success' : 'outline'}>
          <Sparkles size={12} /> {currentPlan === 'pro' ? 'Pro' : 'Free'}
        </Badge>
      </header>

      {sp.get('upgraded') && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-4 text-sm text-success">
            ✓ You're now on the <b>{sp.get('upgraded')}</b> plan. Welcome aboard.
          </CardContent>
        </Card>
      )}
      {sp.get('canceled') && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm text-warning">
            Your subscription has been canceled. You're back on the Free plan.
          </CardContent>
        </Card>
      )}

      {mock && (
        <Card className="border-muted bg-muted/30">
          <CardContent className="p-3 text-xs text-muted-fg">
            <strong>Mock mode.</strong> No payment is collected — clicks instantly switch your plan
            so you can exercise the quota guards end-to-end. Set <code>STRIPE_MOCK=false</code> and
            wire <code>STRIPE_SECRET_KEY</code> for real test-mode Stripe.
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {plans.map((p: any) => {
          const isCurrent = p.key === currentPlan;
          const isPro = p.key === 'pro';
          return (
            <Card key={p.key} className={isPro ? 'border-amber-500/40' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {isPro && <Sparkles size={18} className="text-amber-500" />}
                    {p.label}
                  </CardTitle>
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </div>
                <CardDescription>
                  <span className="text-3xl font-bold text-fg">${p.priceUsd}</span>
                  <span className="text-muted-fg"> / month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5">
                  {p.features.map((f: string) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check size={14} className="mt-0.5 text-success shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-muted-fg pt-2 border-t">
                  Daily quotas:
                  <span className="ml-1">
                    {p.quotas.optimizePerDay < 0 ? '∞' : p.quotas.optimizePerDay} optimizations,{' '}
                    {p.quotas.applyPerDay < 0 ? '∞' : p.quotas.applyPerDay} auto-applies
                  </span>
                </div>
                {isPro && !isCurrent && (
                  <Button onClick={() => upgrade.mutate()} disabled={upgrade.isPending} className="w-full">
                    <Sparkles size={16} /> {upgrade.isPending ? 'Upgrading…' : `Upgrade to ${p.label}`}
                  </Button>
                )}
                {isPro && isCurrent && (
                  <Button variant="outline" onClick={() => cancel.mutate()} disabled={cancel.isPending} className="w-full">
                    <X size={16} /> {cancel.isPending ? 'Canceling…' : 'Cancel subscription'}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <LlmUsageCard />

      {customer && (
        <Card>
          <CardHeader><CardTitle className="text-base">Subscription details</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Status: <Badge variant={customer.status === 'active' ? 'success' : 'outline'}>{customer.status}</Badge></div>
            {customer.currentPeriodEnd && (
              <div className="text-muted-fg">Renews {new Date(customer.currentPeriodEnd).toLocaleDateString()}</div>
            )}
            {customer.stripeCustomerId && (
              <div className="text-xs text-muted-fg font-mono">customer: {customer.stripeCustomerId}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LlmUsageCard() {
  const q = useQuery({ queryKey: ['llm-usage'], queryFn: api.getLlmUsage });
  if (!q.data) return null;
  const { last30Days, lifetime, byService, recent } = q.data;
  if (lifetime.callCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Activity size={16} /> LLM usage</CardTitle>
          <CardDescription>Token + cost telemetry. Will populate once you run a scoring or optimization.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Activity size={16} /> LLM usage</CardTitle>
        <CardDescription>Across all Claude calls made on your behalf. Estimated cost — actual provider invoice is authoritative.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-md border">
            <div className="text-xs text-muted-fg uppercase tracking-wider">Last 30 days</div>
            <div className="text-2xl font-semibold">${last30Days.costUsd.toFixed(4)}</div>
            <div className="text-xs text-muted-fg">{last30Days.callCount} calls · {last30Days.inTokens + last30Days.outTokens} tokens</div>
          </div>
          <div className="p-3 rounded-md border">
            <div className="text-xs text-muted-fg uppercase tracking-wider">Lifetime</div>
            <div className="text-2xl font-semibold">${lifetime.costUsd.toFixed(4)}</div>
            <div className="text-xs text-muted-fg">{lifetime.callCount} calls</div>
          </div>
          {byService.slice(0, 2).map((s: any) => (
            <div key={s.service} className="p-3 rounded-md border">
              <div className="text-xs text-muted-fg uppercase tracking-wider">{s.service}</div>
              <div className="text-2xl font-semibold">${s.costUsd.toFixed(4)}</div>
              <div className="text-xs text-muted-fg">{s.callCount} calls</div>
            </div>
          ))}
        </div>
        <div>
          <div className="text-xs text-muted-fg mb-1">Last 20 calls</div>
          <div className="border rounded-md divide-y text-sm">
            {recent.map((r: any, i: number) => (
              <div key={i} className="px-3 py-1.5 flex items-center justify-between gap-3">
                <div className="min-w-0 truncate">
                  <span className="font-medium">{r.service}</span>
                  {r.endpoint && <span className="text-muted-fg"> · {r.endpoint}</span>}
                  <span className="text-xs text-muted-fg ml-2">{r.model}</span>
                </div>
                <div className="text-xs text-muted-fg tabular-nums shrink-0">
                  {r.inTokens + r.outTokens} tok · ${r.costUsd.toFixed(5)} · {new Date(r.at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
