import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  /** Si role = DRIVER, vincula/crea el operador. */
  @IsOptional()
  @IsString()
  driverId?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

const SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  enterpriseId: true,
  createdAt: true,
  driver: { select: { id: true, name: true, status: true } },
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  list(enterpriseId: string) {
    return this.prisma.user.findMany({
      where: { enterpriseId },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: SELECT,
    });
  }

  /** RN-MEM-02: respeta max_users_per_ent (0 = sin tope). */
  async create(enterpriseId: string, dto: CreateUserDto) {
    if (dto.role === UserRole.SUPER) throw new BadRequestException('No se pueden crear usuarios SUPER aquí');
    const s = await this.settings.get(enterpriseId);
    if (s.max_users_per_ent > 0) {
      const count = await this.prisma.user.count({ where: { enterpriseId } });
      if (count >= s.max_users_per_ent) {
        throw new BadRequestException(`Límite de usuarios alcanzado (${s.max_users_per_ent})`);
      }
    }
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('El correo ya está registrado');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email, name: dto.name.trim(), role: dto.role, passwordHash, enterpriseId },
      select: SELECT,
    });

    if (dto.role === UserRole.DRIVER) {
      if (dto.driverId) {
        const d = await this.prisma.driver.findFirst({ where: { id: dto.driverId, enterpriseId } });
        if (!d) throw new NotFoundException('Operador no encontrado');
        await this.prisma.driver.update({ where: { id: d.id }, data: { userId: user.id } });
      } else {
        await this.prisma.driver.create({
          data: { name: dto.name.trim(), phone: dto.phone, enterpriseId, userId: user.id },
        });
      }
    }
    return this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: SELECT });
  }

  async update(enterpriseId: string, id: string, dto: UpdateUserDto) {
    const u = await this.prisma.user.findFirst({ where: { id, enterpriseId } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    if (dto.role === UserRole.SUPER) throw new BadRequestException('Rol no permitido');
    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        role: dto.role,
        isActive: dto.isActive,
        passwordHash: dto.password ? await bcrypt.hash(dto.password, 12) : undefined,
      },
      select: SELECT,
    });
  }

  async remove(enterpriseId: string, id: string) {
    const u = await this.prisma.user.findFirst({ where: { id, enterpriseId } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
