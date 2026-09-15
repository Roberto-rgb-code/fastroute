import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type AppNotificationType =
  | 'route.started'
  | 'route.completed'
  | 'route.paused'
  | 'route.cancelled'
  | 'stop.completed'
  | 'incident'
  | 'message';

export interface AppNotificationPayload {
  id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  routeId?: string;
  href?: string;
  createdAt: string;
}

// pusher es CJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Pusher = require('pusher') as typeof import('pusher');

@Injectable()
export class PusherNotifyService {
  private readonly logger = new Logger(PusherNotifyService.name);
  private pusher: InstanceType<typeof Pusher> | null = null;

  constructor() {
    const appId = process.env.PUSHER_APP_ID?.trim();
    const key = process.env.PUSHER_KEY?.trim();
    const secret = process.env.PUSHER_SECRET?.trim();
    const cluster = process.env.PUSHER_CLUSTER?.trim() || 'us2';
    if (appId && key && secret) {
      this.pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
    }
  }

  async notify(
    enterpriseId: string,
    partial: Omit<AppNotificationPayload, 'id' | 'createdAt'> & { id?: string },
  ): Promise<void> {
    if (!this.pusher || !enterpriseId) return;
    const payload: AppNotificationPayload = {
      id: partial.id ?? randomUUID(),
      createdAt: new Date().toISOString(),
      type: partial.type,
      title: partial.title,
      body: partial.body,
      routeId: partial.routeId,
      href: partial.href,
    };
    try {
      await this.pusher.trigger(`enterprise-${enterpriseId}`, 'notification', payload);
    } catch (e) {
      this.logger.warn(`Pusher notification: ${String(e)}`);
    }
  }
}
