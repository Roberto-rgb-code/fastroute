import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';
import { PublishLocationDto } from './dto/publish-location.dto';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private pusher: Pusher | null = null;

  constructor(private readonly config: ConfigService) {
    const appId = config.get<string>('PUSHER_APP_ID');
    const key = config.get<string>('PUSHER_KEY');
    const secret = config.get<string>('PUSHER_SECRET');
    const cluster = config.get<string>('PUSHER_CLUSTER', 'us2');

    if (appId && key && secret) {
      this.pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
    } else {
      this.logger.warn('Pusher no configurado — tracking en vivo deshabilitado (demo local OK)');
    }
  }

  async publishLocation(enterpriseId: string, dto: PublishLocationDto) {
    const payload = {
      ...dto,
      enterpriseId,
      at: new Date().toISOString(),
    };

    if (this.pusher) {
      await this.pusher.trigger(`enterprise-${enterpriseId}`, 'driver-location', payload);
      if (dto.routeId) {
        await this.pusher.trigger(`route-${dto.routeId}`, 'driver-location', payload);
      }
    }

    return { ok: true, delivered: Boolean(this.pusher), payload };
  }
}
