/**
 * Plan catalog + quota policy.
 *
 * Adding a new plan is two edits: add it to PLANS, optionally adjust quotas.
 */
export type PlanKey = 'free' | 'pro';

export interface Plan {
  key: PlanKey;
  label: string;
  priceUsd: number;
  features: string[];
  quotas: { optimizePerDay: number; applyPerDay: number };
}

export const PLANS: Record<PlanKey, Plan> = {
  free: {
    key: 'free',
    label: 'Free',
    priceUsd: 0,
    features: [
      'Unlimited ATS scoring',
      'Up to 5 resume optimizations / day',
      'Up to 5 auto-applications / day',
      'Greenhouse driver',
    ],
    quotas: { optimizePerDay: 5, applyPerDay: 5 },
  },
  pro: {
    key: 'pro',
    label: 'Pro',
    priceUsd: 19,
    features: [
      'Unlimited optimizations',
      'Unlimited auto-applications',
      'All drivers as they ship',
      'Priority Claude model on rewrites',
      'Email + push notifications',
    ],
    // -1 = unlimited
    quotas: { optimizePerDay: -1, applyPerDay: -1 },
  },
};

export function isUnlimited(n: number) { return n < 0; }
