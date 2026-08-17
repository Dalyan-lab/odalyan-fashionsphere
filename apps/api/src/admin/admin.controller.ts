import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { UserRole } from '@odalyan/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { MailService } from '../mail/mail.service';
import { PayoutService } from '../payout/payout.service';

/** Back-office plateforme — toutes les routes sont réservées au rôle ADMIN. */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly mail: MailService,
    private readonly payouts: PayoutService,
  ) {}

  /**
   * Diagnostic de la messagerie : dit si le SMTP est configuré et avec quels
   * réglages. Le mot de passe n'est jamais renvoyé.
   */
  @Get('mail/status')
  mailStatus() {
    return this.mail.status();
  }

  /**
   * Envoie un email de test et renvoie le résultat réel.
   *
   * Indispensable au diagnostic : les envois de l'application avalent leurs
   * erreurs pour ne jamais faire échouer une commande, ce qui rend une
   * configuration SMTP fausse totalement invisible depuis l'extérieur.
   */
  /**
   * Diagnostic réseau du SMTP, exécuté depuis le serveur.
   *
   * Un « Connection timeout » ne dit pas si c'est la résolution, la route IPv6
   * ou le port qui bloque. Cette sonde le dit.
   */
  @Get('mail/probe')
  mailProbe() {
    return this.mail.probe();
  }

  @Post('mail/test')
  async mailTest(@Body('to') to?: string) {
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      throw new BadRequestException('Adresse de destination invalide.');
    }
    return this.mail.sendTest(to);
  }

  /** Boutiques ayant un montant versable, avec leurs coordonnées. */
  @Get('payouts/pending')
  pendingPayouts() {
    return this.payouts.pending();
  }

  /** Tous les versements, du plus récent au plus ancien. */
  @Get('payouts')
  allPayouts() {
    return this.admin.listPayouts();
  }

  /** Crée le versement d'une boutique en y rattachant ses commandes versables. */
  @Post('payouts/:shopId')
  createPayout(@Param('shopId') shopId: string) {
    return this.payouts.create(shopId);
  }

  /** Confirme qu'un versement a bien été effectué, avec sa référence. */
  @Patch('payouts/:id/paid')
  markPayoutPaid(
    @Param('id') id: string,
    @Body('transferRef') transferRef?: string,
    @Body('note') note?: string,
  ) {
    return this.payouts.markPaid(id, transferRef, note);
  }

  /** Annule un versement non payé et rend ses commandes au solde disponible. */
  @Delete('payouts/:id')
  cancelPayout(@Param('id') id: string) {
    return this.payouts.cancel(id);
  }

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('shops')
  shops() {
    return this.admin.listShops();
  }

  @Get('users')
  users() {
    return this.admin.listUsers();
  }

  @Get('orders')
  orders(@Query('limit') limit?: string) {
    return this.admin.listOrders(limit ? Number(limit) : 50);
  }

  @Patch('users/:id/role')
  setUserRole(
    @CurrentUser('id') actingUserId: string,
    @Param('id') id: string,
    @Body('role') role: PrismaUserRole,
  ) {
    return this.admin.setUserRole(actingUserId, id, role);
  }
}
