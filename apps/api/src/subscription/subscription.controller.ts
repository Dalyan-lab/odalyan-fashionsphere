import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SubscriptionPlan, UserRole, subscribeSchema, type SubscribeInput } from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionService } from './subscription.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.ADMIN)
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  /** Statut d'abonnement courant (plan, expiration). */
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.subscriptions.me(userId);
  }

  /** Aperçu d'un code promo sur un plan/période. */
  @Post('coupon/preview')
  previewCoupon(
    @CurrentUser('id') userId: string,
    @Body('code') code: string,
    @Body('plan') plan: SubscriptionPlan,
    @Body('period') period: 'monthly' | 'annual',
  ) {
    return this.subscriptions.previewCoupon(userId, code, plan, period ?? 'monthly');
  }

  /** Démarre le passage à un plan : renvoie un lien Paystack (ou activation directe si gratuit/mock). */
  @Post('checkout')
  checkout(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(subscribeSchema)) input: SubscribeInput,
  ) {
    return this.subscriptions.checkout(userId, input);
  }

  /** Déclenche manuellement les rappels d'expiration (admin — sinon quotidien à 09h UTC). */
  @Post('run-reminders')
  @Roles(UserRole.ADMIN)
  runReminders() {
    return this.subscriptions.sendExpiryReminders();
  }
}
