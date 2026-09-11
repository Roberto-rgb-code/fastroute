import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStopDto } from './dto/create-stop.dto';
import { UpdateStopDto } from './dto/update-stop.dto';

@Injectable()
export class StopsService {
  constructor(private readonly prisma: PrismaService) {}

  list(enterpriseId: string, clientId?: string) {
    return this.prisma.stop.findMany({
      where: { enterpriseId, clientId: clientId ?? undefined },
      orderBy: { label: 'asc' },
    });
  }

  create(enterpriseId: string, dto: CreateStopDto) {
    return this.prisma.stop.create({ data: { ...dto, enterpriseId } });
  }

  update(enterpriseId: string, id: string, dto: UpdateStopDto) {
    return this.prisma.stop.update({ where: { id, enterpriseId }, data: dto });
  }

  remove(enterpriseId: string, id: string) {
    return this.prisma.stop.delete({ where: { id, enterpriseId } });
  }
}
