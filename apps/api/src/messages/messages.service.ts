import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageSender, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { PusherNotifyService } from '../realtime/pusher-notify.service';

// pusher es CJS; el default import falla en algunos builds de Nest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Pusher = require('pusher') as typeof import('pusher');

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private pusher: InstanceType<typeof Pusher> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notify: PusherNotifyService,
  ) {
    const appId = config.get<string>('PUSHER_APP_ID');
    const key = config.get<string>('PUSHER_KEY');
    const secret = config.get<string>('PUSHER_SECRET');
    const cluster = config.get<string>('PUSHER_CLUSTER', 'us2');
    if (appId && key && secret) {
      this.pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
    } else {
      this.logger.warn('Pusher no configurado — chat en tiempo real deshabilitado (demo local OK)');
    }
  }

  /** Verifica que el usuario tenga acceso a la ruta y devuelve enterpriseId. */
  private async assertRouteAccess(user: User, routeId: string): Promise<string> {
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
      select: { id: true, enterpriseId: true, driverId: true },
    });
    if (!route) throw new NotFoundException('Ruta no encontrada');

    if (user.role === UserRole.DRIVER) {
      const driver = await this.prisma.driver.findFirst({ where: { userId: user.id } });
      if (!driver || route.driverId !== driver.id) {
        throw new ForbiddenException('La ruta no pertenece al conductor');
      }
    } else if (user.role !== UserRole.SUPER && route.enterpriseId !== user.enterpriseId) {
      throw new ForbiddenException('La ruta no pertenece a la empresa');
    }
    return route.enterpriseId;
  }

  async list(user: User, routeId: string) {
    await this.assertRouteAccess(user, routeId);
    return this.prisma.message.findMany({
      where: { routeId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async create(user: User, routeId: string, dto: CreateMessageDto) {
    const enterpriseId = await this.assertRouteAccess(user, routeId);
    const sender = user.role === UserRole.DRIVER ? MessageSender.DRIVER : MessageSender.ADMIN;

    const message = await this.prisma.message.create({
      data: {
        body: dto.body.trim(),
        sender,
        routeId,
        enterpriseId,
        userId: user.id,
      },
      include: { user: { select: { id: true, name: true } } },
    });

    if (this.pusher) {
      await this.pusher.trigger(`route-${routeId}`, 'message', message);
      await this.pusher.trigger(`enterprise-${enterpriseId}`, 'message', message);
    }

    if (sender === MessageSender.DRIVER) {
      const route = await this.prisma.route.findUnique({
        where: { id: routeId },
        select: { name: true },
      });
      await this.notify.notify(enterpriseId, {
        type: 'message',
        title: 'Mensaje del conductor',
        body: `${route?.name ?? 'Ruta'}: ${message.body.slice(0, 120)}`,
        routeId,
        href: '/app/messages',
      });
    }

    return message;
  }

  /** Marca como leídos los mensajes de la contraparte. */
  async markRead(user: User, routeId: string) {
    await this.assertRouteAccess(user, routeId);
    // El admin marca leídos los del driver y viceversa.
    const other = user.role === UserRole.DRIVER ? MessageSender.ADMIN : MessageSender.DRIVER;
    await this.prisma.message.updateMany({
      where: { routeId, sender: other, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
