import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { UserRole } from '@odalyan/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';

/** Back-office plateforme — toutes les routes sont réservées au rôle ADMIN. */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

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
