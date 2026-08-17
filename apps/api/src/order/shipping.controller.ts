import { Body, Controller, Post } from '@nestjs/common';
import { checkoutSchema, type CheckoutInput } from '@odalyan/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { OrderService } from './order.service';

/**
 * Estimation du panier, sans authentification.
 *
 * Séparé d'`OrderController`, dont toutes les routes exigent un compte : un
 * visiteur doit voir les frais de livraison avant d'être forcé de s'inscrire.
 * Découvrir les frais après la création du compte est une cause classique
 * d'abandon.
 */
@Controller('shipping')
export class ShippingController {
  constructor(private readonly orders: OrderService) {}

  @Post('quote')
  quote(@Body(new ZodValidationPipe(checkoutSchema)) input: CheckoutInput) {
    return this.orders.quote(input);
  }
}
