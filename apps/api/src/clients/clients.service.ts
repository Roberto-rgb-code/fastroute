import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  list(enterpriseId: string) {
    return this.prisma.client.findMany({
      where: { enterpriseId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { stops: true, checklistItems: true } },
      },
    });
  }

  get(enterpriseId: string, id: string) {
    return this.prisma.client.findFirstOrThrow({
      where: { id, enterpriseId },
      include: { checklistItems: { orderBy: { position: 'asc' } }, stops: true },
    });
  }

  create(enterpriseId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        name: dto.name.trim(),
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        pickupMinutes: dto.pickupMinutes ?? 0,
        deliverMinutes: dto.deliverMinutes ?? 10,
        enterpriseId,
        checklistItems: dto.checklistItems
          ? {
              create: dto.checklistItems.map((c, i) => ({
                label: c.label,
                required: c.required ?? false,
                photo: c.photo ?? false,
                position: i,
              })),
            }
          : undefined,
      },
      include: { checklistItems: true },
    });
  }

  update(enterpriseId: string, id: string, dto: UpdateClientDto) {
    const { checklistItems, ...rest } = dto;
    return this.prisma.client.update({ where: { id, enterpriseId }, data: rest });
  }

  remove(enterpriseId: string, id: string) {
    return this.prisma.client.delete({ where: { id, enterpriseId } });
  }
}
