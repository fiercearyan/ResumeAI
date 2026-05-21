import { Body, Controller, Get, Post, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { Request } from 'express';
import { AuthGuard } from '../common/auth.guard';
import { BillingService } from './billing.service';
import { PlanKey } from './plans';

class CheckoutDto { @IsIn(['pro']) plan!: 'pro'; }

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private billing: BillingService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('status')
  status(@Req() req: any) {
    return this.billing.getStatus(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('checkout')
  checkout(@Req() req: any, @Body() body: CheckoutDto) {
    return this.billing.createCheckout(req.user.id, body.plan as PlanKey);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('portal')
  portal(@Req() req: any) {
    return this.billing.createPortal(req.user.id);
  }

  /**
   * Stripe webhook — NOT auth-gated; signature-verified instead.
   * In mock mode any POST works (used by integration tests).
   */
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: Request) {
    const raw = typeof (req as any).body === 'string' ? (req as any).body : JSON.stringify((req as any).body || {});
    return this.billing.handleWebhook(raw, req.headers['stripe-signature'] as string | undefined);
  }
}
