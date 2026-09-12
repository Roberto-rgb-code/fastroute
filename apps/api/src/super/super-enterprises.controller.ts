import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateEnterpriseDto } from './dto/create-enterprise.dto';
import { CreateEnterpriseUserDto } from './dto/create-enterprise-user.dto';
import { SuperEnterprisesService } from './super-enterprises.service';

@Controller('super/enterprises')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER)
export class SuperEnterprisesController {
  constructor(private readonly service: SuperEnterprisesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateEnterpriseDto) {
    return this.service.create(dto);
  }

  @Post(':id/users')
  createUser(@Param('id') id: string, @Body() dto: CreateEnterpriseUserDto) {
    return this.service.createUser(id, dto);
  }

  @Patch(':id/active')
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.service.setActive(id, isActive);
  }

  @Get(':id/settings')
  settings(@Param('id') id: string) {
    return this.service.settings(id);
  }

  @Patch(':id/settings')
  updateSettings(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateSettings(id, body);
  }
}
