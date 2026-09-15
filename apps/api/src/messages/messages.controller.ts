import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';

const CHAT_ROLES = [
  UserRole.SUPER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.LOGISTICS,
  UserRole.DRIVER,
] as const;

/** Chat por ruta: web (admin/logística) ↔ mobile (conductor). */
@Controller('routes/:routeId/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  @Roles(...CHAT_ROLES)
  list(@CurrentUser() user: User, @Param('routeId') routeId: string) {
    return this.messages.list(user, routeId);
  }

  @Post()
  @Roles(...CHAT_ROLES)
  create(@CurrentUser() user: User, @Param('routeId') routeId: string, @Body() dto: CreateMessageDto) {
    return this.messages.create(user, routeId, dto);
  }

  @Post('read')
  @Roles(...CHAT_ROLES)
  markRead(@CurrentUser() user: User, @Param('routeId') routeId: string) {
    return this.messages.markRead(user, routeId);
  }
}
