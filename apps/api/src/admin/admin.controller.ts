import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { UserRole } from '@odalyan/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';
import { MailService } from '../mail/mail.service';

/** Back-office plateforme — toutes les routes sont réservées au rôle ADMIN. */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly mail: MailService,
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
