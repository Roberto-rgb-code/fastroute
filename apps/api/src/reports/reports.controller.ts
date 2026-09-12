import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { resolveEnterpriseId } from '../common/tenant.util';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER, UserRole.LOGISTICS)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('stops')
  stops(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.stops(resolveEnterpriseId(user, eid), from, to);
  }

  @Get('operations')
  operations(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.operations(resolveEnterpriseId(user, eid), from, to);
  }
}
