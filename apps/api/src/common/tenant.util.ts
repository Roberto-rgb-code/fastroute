import { ForbiddenException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';

/**
 * Resolves the enterprise scope for a request.
 * SUPER can pass an explicit enterpriseId (query/param); others are locked to their own.
 */
export function resolveEnterpriseId(user: User, requested?: string | null): string {
  if (user.role === UserRole.SUPER) {
    const id = requested ?? user.enterpriseId;
    if (!id) {
      throw new ForbiddenException('SUPER debe indicar enterpriseId');
    }
    return id;
  }
  if (!user.enterpriseId) {
    throw new ForbiddenException('Usuario sin empresa asignada');
  }
  return user.enterpriseId;
}
