import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStopDto } from './dto/create-stop.dto';
import { UpdateStopDto } from './dto/update-stop.dto';

@Injectable()
export class StopsService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(enterpriseId: string, dto: CreateStopDto) {
    return this.prisma.stop.create({ data: { ...dto, enterpriseId } });
  }

  update(enterpriseId: string, id: string, dto: UpdateStopDto) {
    return this.prisma.stop.update({ where: { id, enterpriseId }, data: dto });
  }

  /** Archivar en lugar de borrar cuando tiene historial (RN-STP-03). */
  async remove(enterpriseId: string, id: string) {
    const used = await this.prisma.event.count({ where: { stopId: id } });
    if (used > 0) {
      return this.prisma.stop.update({ where: { id, enterpriseId }, data: { isArchived: true } });
    }
    return this.prisma.stop.delete({ where: { id, enterpriseId } });
  }
}
