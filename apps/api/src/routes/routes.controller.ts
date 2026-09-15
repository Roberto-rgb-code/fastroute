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
import { todayBusinessDay } from '../common/business-day.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import {
  CancelRouteDto,
  CloseRouteDto,
  DuplicateRouteDto,
  ExpenseDto,
  IncidentDto,
  StartRouteDto,
  SubmitEvidenceDto,
} from './dto/route-ops.dto';
import { RoutesService } from './routes.service';

const DISPATCH = [UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER, UserRole.LOGISTICS] as const;
const ADMIN = [UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER] as const;

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutesController {
  constructor(
    private readonly service: RoutesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('kpis')
  kpis(@CurrentUser() user: User, @Query('day') day?: string, @Query('enterpriseId') eid?: string) {
    return this.service.kpis(resolveEnterpriseId(user, eid), day);
  }

  /** Series para gráficas del dashboard (barras/dona/heatmap/recientes). */
  @Get('series')
  series(@CurrentUser() user: User, @Query('days') days?: string, @Query('enterpriseId') eid?: string) {
    return this.service.series(resolveEnterpriseId(user, eid), days ? Number(days) : 14);
  }

  @Get('today')
  today() {
    return { day: todayBusinessDay(), tz: 'UTC-6' };
  }

  /** Mobile: rutas del conductor autenticado. */
  @Get('mine')
  async mine(@CurrentUser() user: User) {
    const driver = await this.prisma.driver.findFirst({ where: { userId: user.id } });
    if (!driver) throw new NotFoundException('El usuario no es conductor');
    return this.service.driverRoutes(driver.id);
  }

  @Get('incidents')
  incidents(@CurrentUser() user: User, @Query('day') day?: string, @Query('enterpriseId') eid?: string) {
    return this.service.incidentsOfDay(resolveEnterpriseId(user, eid), day);
  }

  /**
   * Rutas del día operativo. `day=YYYY-MM-DD` (default hoy UTC-6). `all=1` sin filtro de fecha.
   */
  @Get()
  list(
    @CurrentUser() user: User,
    @Query('status') status?: RouteStatus,
    @Query('day') day?: string,
    @Query('all') all?: string,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.list(resolveEnterpriseId(user, eid), {
      status,
      day: day ?? todayBusinessDay(),
      all: all === '1' || all === 'true',
    });
  }

  /** Historial operativo: rutas cerradas por rango de fechas. */
  @Get('history')
  @Roles(...DISPATCH)
  history(
    @CurrentUser() user: User,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('driverId') driverId?: string,
    @Query('q') q?: string,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.history(resolveEnterpriseId(user, eid), { from, to, driverId, q });
  }

  @Get(':id')
  get(@CurrentUser() user: User, @Param('id') id: string, @Query('enterpriseId') eid?: string) {
    return this.service.get(resolveEnterpriseId(user, eid), id);
  }

  /** Mobile: ruta + settings efectivos + qué puede hacer el operador. */
  @Get(':id/context')
  context(@CurrentUser() user: User, @Param('id') id: string, @Query('enterpriseId') eid?: string) {
    return this.service.driverContext(resolveEnterpriseId(user, eid), id);
  }

  @Post()
  @Roles(...DISPATCH)
  create(@CurrentUser() user: User, @Body() dto: CreateRouteDto, @Query('enterpriseId') eid?: string) {
    return this.service.create(resolveEnterpriseId(user, eid), dto);
  }

  @Post(':id/duplicate')
  @Roles(...DISPATCH)
  duplicate(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: DuplicateRouteDto,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.duplicate(resolveEnterpriseId(user, eid), id, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body('status') status: RouteStatus,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.changeStatus(resolveEnterpriseId(user, eid), id, status, user);
  }

  /** Checklist de salida: km/gas inicial + evidencias → CHECKLIST_PENDING | ENROUTE. */
  @Post(':id/start')
  start(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: StartRouteDto,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.start(resolveEnterpriseId(user, eid), id, dto, user);
  }

  @Post(':id/approve-checklist')
  @Roles(...ADMIN)
  approveChecklist(@CurrentUser() user: User, @Param('id') id: string, @Query('enterpriseId') eid?: string) {
    return this.service.approveChecklist(resolveEnterpriseId(user, eid), id);
  }

  @Post(':id/cancel')
  @Roles(...ADMIN)
  cancel(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CancelRouteDto,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.cancel(resolveEnterpriseId(user, eid), id, dto);
  }

  /** "Terminar" (cierre manual) → FINISHED. */
  @Post(':id/finish')
  finish(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: Partial<CloseRouteDto>,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.finish(resolveEnterpriseId(user, eid), id, user, dto);
  }

  /** Cierre del destino con km/gas final → COMPLETED. */
  @Post(':id/close')
  close(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CloseRouteDto,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.closeDestination(resolveEnterpriseId(user, eid), id, dto, user);
  }

  @Patch(':id/reorder')
  @Roles(...DISPATCH)
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
    return this.service.updateEvent(resolveEnterpriseId(user, eid), id, eventId, dto, user);
  }

  @Post(':id/events/:eventId/evidence')
  submitEvidence(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() dto: SubmitEvidenceDto,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.submitEvidence(resolveEnterpriseId(user, eid), id, eventId, dto, user);
  }

  @Post(':id/events/:eventId/approve')
  @Roles(...ADMIN)
  approveEvent(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.approveEvent(resolveEnterpriseId(user, eid), id, eventId);
  }

  @Post(':id/events/:eventId/retry')
  @Roles(...ADMIN)
  retryEvent(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.retryEvent(resolveEnterpriseId(user, eid), id, eventId);
  }

  @Post(':id/events/:eventId/notify-client')
  @Roles(...DISPATCH)
  notifyClient(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.notifyClient(resolveEnterpriseId(user, eid), id, eventId);
  }

  @Post(':id/notify-driver')
  @Roles(...DISPATCH)
  notifyDriver(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body('message') message?: string,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.notifyDriver(resolveEnterpriseId(user, eid), id, message);
  }

  @Patch(':id/checklist/:itemId')
  toggleChecklist(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body('done') done: boolean,
    @Body('photoUrl') photoUrl?: string,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.toggleChecklist(resolveEnterpriseId(user, eid), id, itemId, done, photoUrl, user);
  }

  @Post(':id/expenses')
  saveExpense(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ExpenseDto,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.saveExpense(resolveEnterpriseId(user, eid), id, dto, user);
  }

  @Post(':id/expenses/:expenseId/done')
  @Roles(...ADMIN)
  expenseDone(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('expenseId') expenseId: string,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.markExpenseDone(resolveEnterpriseId(user, eid), id, expenseId);
  }

  @Post(':id/incidents')
  addIncident(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: IncidentDto,
    @Query('enterpriseId') eid?: string,
  ) {
    return this.service.addIncident(resolveEnterpriseId(user, eid), id, dto, user);
  }

  @Delete(':id')
  @Roles(...ADMIN)
  remove(@CurrentUser() user: User, @Param('id') id: string, @Query('enterpriseId') eid?: string) {
    return this.service.remove(resolveEnterpriseId(user, eid), id);
  }
}
