import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishLocationDto } from './dto/publish-location.dto';

// pusher es CJS; el default import falla en algunos builds de Nest.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Pusher = require('pusher') as typeof import('pusher');

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private pusher: InstanceType<typeof Pusher> | null = null;

  constructor(private readonly config: ConfigService) {
    const appId = config.get<string>('PUSHER_APP_ID');
    const key = config.get<string>('PUSHER_KEY');
    const secret = config.get<string>('PUSHER_SECRET');
    const cluster = config.get<string>('PUSHER_CLUSTER', 'us2');

    if (appId && key && secret) {
      this.pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
      this.logger.log(`Pusher listo (cluster ${cluster})`);
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
