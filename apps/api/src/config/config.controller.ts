import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Claves de cliente (Mapbox, Pusher, etc.) — públicas en el navegador; no requieren JWT. */
@Controller('config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('client')
  clientConfig() {
    return {
      mapbox: {
        token: this.config.get<string>('MAPBOX_ACCESS_TOKEN') ?? '',
        styleUrl:
          this.config.get<string>('MAPBOX_STYLE_URL') ?? 'mapbox://styles/mapbox/streets-v12',
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
