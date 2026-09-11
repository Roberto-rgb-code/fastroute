import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  list(enterpriseId: string) {
    return this.prisma.vehicle.findMany({
      where: { enterpriseId },
      orderBy: { plate: 'asc' },
      include: { _count: { select: { routes: true } } },
    });
  }

  create(enterpriseId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({ data: { ...dto, enterpriseId } });
  }

  update(enterpriseId: string, id: string, dto: UpdateVehicleDto) {
    return this.prisma.vehicle.update({ where: { id, enterpriseId }, data: dto });
  }

  remove(enterpriseId: string, id: string) {
    return this.prisma.vehicle.delete({ where: { id, enterpriseId } });
  }
}
