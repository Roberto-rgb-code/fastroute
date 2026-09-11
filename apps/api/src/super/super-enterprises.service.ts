import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnterpriseDto } from './dto/create-enterprise.dto';
import { CreateEnterpriseUserDto } from './dto/create-enterprise-user.dto';

@Injectable()
export class SuperEnterprisesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.enterprise.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true } },
      },
    });
  }

  async create(dto: CreateEnterpriseDto) {
    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.prisma.enterprise.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('El slug ya existe');
    }

    return this.prisma.enterprise.create({
      data: {
        name: dto.name.trim(),
        slug,
        settings: (dto.settings ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async createUser(enterpriseId: string, dto: CreateEnterpriseUserDto) {
    const enterprise = await this.prisma.enterprise.findUnique({ where: { id: enterpriseId } });
    if (!enterprise) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const email = dto.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        role: dto.role ?? UserRole.ADMIN,
        passwordHash,
        enterpriseId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        enterpriseId: true,
        createdAt: true,
      },
    });
  }

  async setActive(enterpriseId: string, isActive: boolean) {
    return this.prisma.enterprise.update({
      where: { id: enterpriseId },
      data: { isActive },
    });
  }
}
