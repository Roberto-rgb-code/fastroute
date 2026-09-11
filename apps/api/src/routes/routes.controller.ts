import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RouteStatus, User, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { resolveEnterpriseId } from '../common/tenant.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RoutesService } from './routes.service';

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutesController {
  constructor(
    private readonly service: RoutesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('kpis')
  kpis(@CurrentUser() user: User, @Query('enterpriseId') eid?: string) {
    return this.service.kpis(resolveEnterpriseId(user, eid));
  }

  /** Mobile: routes for the logged-in driver. */
  @Get('mine')
  async mine(@CurrentUser() user: User) {
    const driver = await this.prisma.driver.findFirst({ where: { userId: user.id } });
    if (!driver) throw new NotFoundException('El usuario no es conductor');
    return this.service.driverRoutes(driver.id);
  }

  @Get()
  list(
    @CurrentUser() user: User,
    @Query('status') status?: RouteStatus,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.list(resolveEnterpriseId(user, eid), status);
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') id: string, @Query('enterpriseId') eid?: string) {
    return this.service.get(resolveEnterpriseId(user, eid), id);
  }

  @Post()
  @Roles(UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER, UserRole.LOGISTICS)
  create(@CurrentUser() user: User, @Body() dto: CreateRouteDto, @Query('enterpriseId') eid?: string) {
    return this.service.create(resolveEnterpriseId(user, eid), dto);
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body('status') status: RouteStatus,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.changeStatus(resolveEnterpriseId(user, eid), id, status);
  }

  @Patch(':id/reorder')
  @Roles(UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER, UserRole.LOGISTICS)
  reorder(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body('eventIds') eventIds: string[],
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.reorderStops(resolveEnterpriseId(user, eid), id, eventIds);
  }

  @Patch(':id/events/:eventId')
  updateEvent(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.updateEvent(resolveEnterpriseId(user, eid), id, eventId, dto);
  }

  @Patch(':id/checklist/:itemId')
  toggleChecklist(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body('done') done: boolean,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.toggleChecklist(resolveEnterpriseId(user, eid), id, itemId, done);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER)
  remove(@CurrentUser() user: User, @Param('id') id: string, @Query('enterpriseId') eid?: string) {
    return this.service.remove(resolveEnterpriseId(user, eid), id);
  }
}
