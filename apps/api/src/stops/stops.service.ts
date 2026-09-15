import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { CreateStopDto } from './dto/create-stop.dto';
import { UpdateStopDto } from './dto/update-stop.dto';

@Injectable()
export class StopsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocoding: GeocodingService,
  ) {}

  /** RN-STP-03: por defecto oculta archivadas; `includeArchived` para el catálogo completo. */
  list(enterpriseId: string, clientId?: string, includeArchived = false) {
    return this.prisma.stop.findMany({
      where: {
        enterpriseId,
        clientId: clientId ?? undefined,
        isArchived: includeArchived ? undefined : false,
      },
      orderBy: [{ isMain: 'desc' }, { label: 'asc' }],
      include: { client: { select: { id: true, name: true } }, _count: { select: { events: true } } },
    });
  }

  async create(enterpriseId: string, dto: CreateStopDto) {
    const coords = await this.resolveCoords(dto);
    return this.prisma.stop.create({
      data: {
        ...dto,
        lat: coords.lat,
        lng: coords.lng,
        enterpriseId,
      },
    });
  }

  async update(enterpriseId: string, id: string, dto: UpdateStopDto) {
    const data = { ...dto };
    const missingCoords = data.lat == null || data.lng == null || (data.lat === 0 && data.lng === 0);
    if (missingCoords && data.address?.trim()) {
      const coords = await this.geocoding.forward(data.address);
      data.lat = coords.lat;
      data.lng = coords.lng;
    }
    return this.prisma.stop.update({ where: { id, enterpriseId }, data });
  }

  /** Archivar en lugar de borrar cuando tiene historial (RN-STP-03). */
  async remove(enterpriseId: string, id: string) {
    const used = await this.prisma.event.count({ where: { stopId: id } });
    if (used > 0) {
      return this.prisma.stop.update({ where: { id, enterpriseId }, data: { isArchived: true } });
    }
    return this.prisma.stop.delete({ where: { id, enterpriseId } });
  }

  private async resolveCoords(dto: { address: string; lat?: number; lng?: number }) {
    const hasCoords =
      dto.lat != null &&
      dto.lng != null &&
      Number.isFinite(dto.lat) &&
      Number.isFinite(dto.lng) &&
      !(dto.lat === 0 && dto.lng === 0);
    if (hasCoords) {
      return { lat: dto.lat!, lng: dto.lng! };
    }
    if (!dto.address?.trim()) {
      throw new BadRequestException('Se requiere dirección para geocodificar');
    }
    const g = await this.geocoding.forward(dto.address);
    return { lat: g.lat, lng: g.lng };
  }
}
