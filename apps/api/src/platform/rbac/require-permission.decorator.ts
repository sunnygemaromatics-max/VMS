import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@vms/shared';

/**
 * Annotate a controller handler with one or more permissions required to invoke it.
 * Combined with PermissionGuard. AND semantics — all listed permissions must
 * be present in the JWT.perms claim.
 *
 * @example
 *   @RequirePermission('visit:approve')
 *   @RequirePermission('visit:approve', 'visit:approve_bulk')
 */
export const PERMISSION_METADATA_KEY = 'rbac:permissions';
export const RequirePermission = (...perms: Permission[]) =>
  SetMetadata(PERMISSION_METADATA_KEY, perms);
