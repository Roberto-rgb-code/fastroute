import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { resolveEnterpriseId } from '../common/tenant.util';
import { EnterpriseSettings } from './enterprise-settings';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get(@CurrentUser() user: User, @Query('enterpriseId') eid?: string) {
    return this.service.get(resolveEnterpriseId(user, eid));
  }

  @Patch()
  @Roles(UserRole.SUPER, UserRole.ADMIN)
  update(
    @CurrentUser() user: User,
    @Body() body: Partial<EnterpriseSettings>,
    @Query('enterpriseId') eid?: string,
  ) {
    // Solo SUPER puede tocar membresía y tope de usuarios (son de plataforma).
    if (user.role !== UserRole.SUPER) {
      delete body.active_membership;
      delete body.max_users_per_ent;
    }
    return this.service.update(resolveEnterpriseId(user, eid), body);
  }
}
