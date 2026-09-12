import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { resolveEnterpriseId } from '../common/tenant.util';
import { TemplatesService, UpsertTemplateDto } from './templates.service';

@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  @Get()
  list(@CurrentUser() user: User, @Query('enterpriseId') eid?: string) {
    return this.service.list(resolveEnterpriseId(user, eid));
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') id: string, @Query('enterpriseId') eid?: string) {
    return this.service.get(resolveEnterpriseId(user, eid), id);
  }

  @Post()
  @Roles(UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER, UserRole.LOGISTICS)
  create(@CurrentUser() user: User, @Body() dto: UpsertTemplateDto, @Query('enterpriseId') eid?: string) {
    return this.service.create(resolveEnterpriseId(user, eid), dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER, UserRole.LOGISTICS)
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpsertTemplateDto,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.update(resolveEnterpriseId(user, eid), id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER)
  remove(@CurrentUser() user: User, @Param('id') id: string, @Query('enterpriseId') eid?: string) {
    return this.service.remove(resolveEnterpriseId(user, eid), id);
  }
}
