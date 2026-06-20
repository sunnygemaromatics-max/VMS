import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission, RoleName } from '@vms/shared';
import { ROLE_BUNDLES, PERMISSIONS } from '@vms/shared';
import { PERMISSION_METADATA_KEY } from './require-permission.decorator';
import type { JwtUser } from '../../common/tenant';

/**
 * Enforces @RequirePermission. Checks against the perms array baked into
 * the JWT. If the JWT lacks `perms` (legacy token issued before Phase 3.2),
 * falls back to the role's default bundle — so unmigrated clients still work.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSION_METADATA_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user: JwtUser | undefined = req.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const perms = effectivePermsFromJwt(user);
    for (const p of required) {
      if (!perms.has(p)) {
        throw new ForbiddenException(`Missing permission: ${p}`);
      }
    }
    return true;
  }
}

function effectivePermsFromJwt(user: JwtUser): Set<string> {
  if (user.perms && user.perms.length > 0) return new Set(user.perms);
  // Fallback: derive from role bundle. SUPER_ADMIN expands wildcard.
  const bundle = ROLE_BUNDLES[user.role as RoleName] as readonly string[] | undefined;
  if (!bundle) return new Set();
  if (bundle.includes('*')) return new Set(PERMISSIONS as readonly string[]);
  return new Set(bundle);
}
