import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class UpsertTemplateDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  /** Orden = posición; primero origen, último destino (RN-TPL-02). */
  @IsArray()
  @IsString({ each: true })
  stopIds!: string[];
}

const INCLUDE = {
  client: { select: { id: true, name: true } },
  stops: { orderBy: { position: 'asc' as const }, include: { stop: true } },
  _count: { select: { routes: true } },
};

/** Distancia haversine (m) para estimar trayectoria sin proveedor externo (RN-TPL-03). */
function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(enterpriseId: string) {
    return this.prisma.routeTemplate.findMany({
      where: { enterpriseId },
      orderBy: { name: 'asc' },
      include: INCLUDE,
    });
  }

  async get(enterpriseId: string, id: string) {
    const t = await this.prisma.routeTemplate.findFirst({ where: { id, enterpriseId }, include: INCLUDE });
    if (!t) throw new NotFoundException('Plantilla no encontrada');
    return t;
  }

  async create(enterpriseId: string, dto: UpsertTemplateDto) {
    const stops = await this.validateStops(enterpriseId, dto.stopIds);
    const est = this.estimate(stops, dto.stopIds);
    const t = await this.prisma.routeTemplate.create({
      data: {
        name: dto.name.trim(),
        enterpriseId,
        clientId: dto.clientId,
        totalDistance: est.distance,
        totalDuration: est.duration,
        stops: { create: dto.stopIds.map((stopId, i) => ({ stopId, position: i + 1 })) },
      },
    });
    return this.get(enterpriseId, t.id);
  }

  async update(enterpriseId: string, id: string, dto: UpsertTemplateDto) {
    await this.get(enterpriseId, id);
    const stops = await this.validateStops(enterpriseId, dto.stopIds);
    const est = this.estimate(stops, dto.stopIds);
    await this.prisma.$transaction([
      this.prisma.templateStop.deleteMany({ where: { templateId: id } }),
      this.prisma.routeTemplate.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          clientId: dto.clientId ?? null,
          totalDistance: est.distance,
          totalDuration: est.duration,
          stops: { create: dto.stopIds.map((stopId, i) => ({ stopId, position: i + 1 })) },
        },
      }),
    ]);
    return this.get(enterpriseId, id);
  }

  async remove(enterpriseId: string, id: string) {
    await this.get(enterpriseId, id);
    await this.prisma.routeTemplate.delete({ where: { id } });
    return { ok: true };
  }

  private async validateStops(enterpriseId: string, stopIds: string[]) {
    if (stopIds.length < 2) throw new BadRequestException('La plantilla requiere origen y destino');
    const stops = await this.prisma.stop.findMany({ where: { id: { in: stopIds }, enterpriseId } });
    if (new Set(stops.map((s) => s.id)).size !== new Set(stopIds).size) {
      throw new BadRequestException('Alguna parada no pertenece a la empresa');
    }
    return stops;
  }

  private estimate(stops: { id: string; lat: number; lng: number }[], order: string[]) {
    const byId = new Map(stops.map((s) => [s.id, s]));
    let distance = 0;
    for (let i = 1; i < order.length; i++) {
      const a = byId.get(order[i - 1]);
      const b = byId.get(order[i]);
      if (a && b) distance += haversine(a, b);
    }
    // ~30 km/h urbano + 10 min por parada intermedia.
    const duration = Math.round(distance / 8.33) + Math.max(0, order.length - 2) * 600;
    return { distance, duration };
  }
}
