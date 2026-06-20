import { Injectable } from '@nestjs/common';
import type { Permission, RoleName } from '@vms/shared';
import { resolvePermissions } from '@vms/shared';
import { PrismaService } from '../prisma/prisma.service';

interface ResolveArgs {
  userId: string;
  role: RoleName;
}

/**
 * Computes the effective permission set for a user by composing:
 *   built-in role bundle  ∪  custom TenantRole permissions
 *                          ∪  User.extraPermissions
 *                          −  User.deniedPermissions
 *
 * Called once at login (baked into JWT.perms) and on demand when a
 * permission grant changes within an active session.
 */
@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForUser(args: ResolveArgs): Promise<Set<Permission>> {
    const u = await this.prisma.user.findUnique({
      where: { id: args.userId },
      select: {
        extraPermissions: true,
        deniedPermissions: true,
        tenantRole: { select: { permissions: true } },
      },
    });
    return resolvePermissions({
      role: args.role,
      tenantRolePermissions: this.parseArray(u?.tenantRole?.permissions),
      extraPermissions: this.parseArray(u?.extraPermissions),
      deniedPermissions: this.parseArray(u?.deniedPermissions),
    });
  }

  private parseArray(json: unknown): Permission[] {
    if (!Array.isArray(json)) return [];
    return json.filter((x): x is Permission => typeof x === 'string');
  }
}
