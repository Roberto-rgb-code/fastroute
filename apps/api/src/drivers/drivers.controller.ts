import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { resolveEnterpriseId } from '../common/tenant.util';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly service: DriversService) {}

  @Get()
  list(@CurrentUser() user: User, @Query('enterpriseId') eid?: string) {
    return this.service.list(resolveEnterpriseId(user, eid));
  }

  @Post()
  @Roles(UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER)
  create(@CurrentUser() user: User, @Body() dto: CreateDriverDto, @Query('enterpriseId') eid?: string) {
    return this.service.create(resolveEnterpriseId(user, eid), dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER)
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.update(resolveEnterpriseId(user, eid), id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER, UserRole.ADMIN)
  remove(@CurrentUser() user: User, @Param('id') id: string, @Query('enterpriseId') eid?: string) {
    return this.service.remove(resolveEnterpriseId(user, eid), id);
  }
}
