import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { PLANS, PlanKey } from './plans';

const STRIPE_MOCK = process.env.STRIPE_MOCK !== 'false'; // mock by default in dev
const WEB_URL = process.env.WEB_PUBLIC_URL || 'http://localhost:3000';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  async getStatus(userId: string) {
    const [user, customer] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { plan: true, email: true } }),
      this.prisma.billingCustomer.findUnique({ where: { userId } }),
    ]);
    return {
      plan: user?.plan || 'free',
      catalog: PLANS,
      customer: customer
        ? {
            status: customer.status,
            currentPeriodEnd: customer.currentPeriodEnd,
            stripeCustomerId: customer.stripeCustomerId,
            stripeSubscriptionId: customer.stripeSubscriptionId,
          }
        : null,
      mock: STRIPE_MOCK,
    };
  }

  /**
   * Create a checkout session.
   *
   * In mock mode, returns a synthetic URL on our own backend that, when
   * visited, instantly upgrades the user to Pro and bounces to /settings/billing.
   * In real mode, would call stripe.checkout.sessions.create() — left as a
   * single explicit branch.
   */
  async createCheckout(userId: string, target: PlanKey) {
    const plan = PLANS[target];
    if (!plan || plan.key === 'free') {
      throw new BadRequestException('Choose a paid plan to upgrade.');
    }

    if (STRIPE_MOCK) {
      // No hosted Stripe page in mock mode — apply the upgrade directly and
      // hand back a success URL. Feels identical to a real checkout from the
      // FE's perspective (navigate to URL, land on success page).
      const sub = `mock_sub_${randomUUID()}`;
      await this.applyPlanChange(userId, sub, target, 'active');
      return { url: `${WEB_URL}/settings/billing?upgraded=${target}`, mock: true };
    }

    // Real-mode placeholder. Wire stripe.checkout.sessions.create here when keys are configured.
    throw new BadRequestException('Real Stripe checkout requires STRIPE_SECRET_KEY and a webhook secret.');
  }

  async createPortal(userId: string) {
    if (STRIPE_MOCK) {
      // Mock portal — cancel immediately and return the success URL.
      const customer = await this.prisma.billingCustomer.findUnique({ where: { userId } });
      await this.applyPlanChange(userId, customer?.stripeSubscriptionId || 'mock', 'free', 'canceled');
      return { url: `${WEB_URL}/settings/billing?canceled=1`, mock: true };
    }
    throw new BadRequestException('Real Stripe portal requires STRIPE_SECRET_KEY.');
  }

  /** Mock-mode handoff: visited from the synthetic checkout URL. Upgrades immediately. */
  async mockComplete(userId: string, sub: string, plan: PlanKey) {
    if (!STRIPE_MOCK) throw new BadRequestException('Mock complete is disabled when STRIPE_MOCK=false');
    if (!PLANS[plan] || plan === 'free') throw new BadRequestException('Invalid plan');
    await this.applyPlanChange(userId, sub, plan, 'active');
    return `${WEB_URL}/settings/billing?upgraded=${plan}`;
  }

  async mockCancel(userId: string) {
    if (!STRIPE_MOCK) throw new BadRequestException('Mock cancel is disabled when STRIPE_MOCK=false');
    const customer = await this.prisma.billingCustomer.findUnique({ where: { userId } });
    await this.applyPlanChange(userId, customer?.stripeSubscriptionId || 'mock', 'free', 'canceled');
    return `${WEB_URL}/settings/billing?canceled=1`;
  }

  /** Stripe webhook handler — only mock events for now. Real-mode signature verification noted inline. */
  async handleWebhook(rawBody: string, _signature: string | undefined) {
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid webhook body');
    }
    // In real Stripe mode you'd verify the signature here:
    //   const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
    switch (event?.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const userId = event.data?.object?.metadata?.user_id;
        const plan = event.data?.object?.metadata?.plan || 'pro';
        const sub = event.data?.object?.id;
        const status = event.data?.object?.status || 'active';
        if (userId && PLANS[plan as PlanKey]) {
          await this.applyPlanChange(userId, sub, plan as PlanKey, status);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const userId = event.data?.object?.metadata?.user_id;
        if (userId) {
          await this.applyPlanChange(userId, event.data?.object?.id, 'free', 'canceled');
        }
        break;
      }
    }
    return { ok: true };
  }

  // ---- helpers ----------------------------------------------------------

  private async applyPlanChange(userId: string, sub: string, plan: PlanKey, status: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { plan } }),
      this.prisma.billingCustomer.upsert({
        where: { userId },
        update: {
          stripeSubscriptionId: sub,
          plan,
          status,
          currentPeriodEnd: plan === 'free' ? null : new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
        create: {
          userId,
          stripeCustomerId: `mock_cus_${userId.slice(0, 8)}`,
          stripeSubscriptionId: sub,
          plan,
          status,
          currentPeriodEnd: plan === 'free' ? null : new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      }),
    ]);
  }

  private async upsertCustomer(userId: string, data: {
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    plan: PlanKey;
    status: string;
  }) {
    await this.prisma.billingCustomer.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }
}
