import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GeocodeQueryDto, ReverseGeocodeDto } from './dto/geocode.dto';
import { GeocodingService } from './geocoding.service';

@Controller('geocode')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER, UserRole.LOGISTICS)
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  /** Forward: dirección → lat/lng (geopy + Nominatim, gratis). */
  @Post()
  forward(@Body() dto: GeocodeQueryDto) {
    return this.geocoding.forward(dto.query, dto.country ?? 'mx');
  }

  /** Reverse: lat/lng → dirección legible. */
  @Post('reverse')
  reverse(@Body() dto: ReverseGeocodeDto) {
    return this.geocoding.reverse(dto.lat, dto.lng);
  }
}
