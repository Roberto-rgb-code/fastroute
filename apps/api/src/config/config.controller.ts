import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** Exposes public client config (map/realtime keys) to authenticated apps. */
@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('client')
  clientConfig() {
    return {
      mapbox: {
        token: this.config.get<string>('MAPBOX_ACCESS_TOKEN') ?? '',
      },
      googleMaps: {
        apiKey: this.config.get<string>('GOOGLE_MAPS_API_KEY') ?? '',
      },
      pusher: {
        key: this.config.get<string>('PUSHER_KEY') ?? '',
        cluster: this.config.get<string>('PUSHER_CLUSTER', 'us2'),
      },
    };
  }
}
