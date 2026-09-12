import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EnterpriseSettings, normalizeSettings } from './enterprise-settings';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(enterpriseId: string): Promise<EnterpriseSettings> {
    const ent = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId },
      select: { settings: true },
    });
    if (!ent) throw new NotFoundException('Empresa no encontrada');
    return normalizeSettings(ent.settings);
  }

  async update(enterpriseId: string, patch: Partial<EnterpriseSettings>): Promise<EnterpriseSettings> {
    const current = await this.get(enterpriseId);
    const next = normalizeSettings({ ...current, ...patch });
    await this.prisma.enterprise.update({
      where: { id: enterpriseId },
      data: { settings: next as unknown as Prisma.InputJsonValue },
    });
    return next;
  }
}
