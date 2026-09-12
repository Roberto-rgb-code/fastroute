import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeSettings } from '../settings/enterprise-settings';
import { LoginDto } from './dto/login.dto';

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  enterpriseId: string | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { enterprise: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.enterpriseId && user.enterprise && !user.enterprise.isActive) {
      throw new UnauthorizedException('Empresa desactivada');
    }
    // RN-MEM-01: membresía inactiva bloquea el panel (SUPER siempre entra).
    if (
      user.role !== UserRole.SUPER &&
      user.enterprise &&
      !normalizeSettings(user.enterprise.settings).active_membership
    ) {
      throw new UnauthorizedException('Tu periodo de prueba ha terminado');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      enterpriseId: user.enterpriseId,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        enterpriseId: user.enterpriseId,
        enterpriseName: user.enterprise?.name ?? null,
      },
    };
  }

  async validatePayload(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { enterprise: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    if (
      user.role !== UserRole.SUPER &&
      user.enterprise &&
      (!user.enterprise.isActive || !normalizeSettings(user.enterprise.settings).active_membership)
    ) {
      throw new UnauthorizedException('Tu periodo de prueba ha terminado');
    }
    return user;
  }
}
