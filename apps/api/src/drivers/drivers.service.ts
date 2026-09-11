import { Injectable } from '@nestjs/common';
import { DriverStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  list(enterpriseId: string) {
    return this.prisma.driver.findMany({
      where: { enterpriseId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { routes: true } } },
    });
  }

  create(enterpriseId: string, dto: CreateDriverDto) {
    return this.prisma.driver.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone,
        licenseId: dto.licenseId,
        photoUrl: dto.photoUrl,
        status: dto.status ?? DriverStatus.AVAILABLE,
        enterpriseId,
      },
    });
  }

  update(enterpriseId: string, id: string, dto: UpdateDriverDto) {
    return this.prisma.driver.update({
      where: { id, enterpriseId },
      data: dto,
    });
  }

  remove(enterpriseId: string, id: string) {
    return this.prisma.driver.delete({ where: { id, enterpriseId } });
  }
}
