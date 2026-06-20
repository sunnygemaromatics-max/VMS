import { PERMISSIONS, type Permission } from './permissions';
import { ROLE_BUNDLES, type RoleName } from './role-bundles';

interface ResolveInput {
  role: RoleName;
  /** Permissions from a TenantRole (custom org role) */
  tenantRolePermissions?: Permission[];
  /** Direct grants on the User row */
  extraPermissions?: Permission[];
  /** Negative grants — override everything else */
  deniedPermissions?: Permission[];
}

/**
 * Resolve the effective permission set for a user.
 *
 *   final = roleBundle ∪ tenantRolePermissions ∪ extraPermissions
 *         − deniedPermissions
 *
 * The "*" wildcard inside a role bundle expands to PERMISSIONS at resolve time.
 * Denies always win.
 */
export function resolvePermissions(input: ResolveInput): Set<Permission> {
  const bundle = ROLE_BUNDLES[input.role];
  const base = new Set<Permission>(
    bundle.includes('*' as never)
      ? (PERMISSIONS as readonly string[] as Permission[])
      : (bundle as Permission[]),
  );

  for (const p of input.tenantRolePermissions ?? []) base.add(p);
  for (const p of input.extraPermissions ?? []) base.add(p);
  for (const p of input.deniedPermissions ?? []) base.delete(p);
  return base;
}

/**
 * O(1) check given a resolved permission set. The string-cast keeps
 * this useful from JS without TS narrowing.
 */
export function can(perms: Set<Permission>, perm: Permission | string): boolean {
  return perms.has(perm as Permission);
}

/**
 * Check that every permission in the array is present.
 */
export function canAll(perms: Set<Permission>, required: Permission[]): boolean {
  return required.every((p) => perms.has(p));
}

/**
 * Check that at least one permission in the array is present.
 */
export function canAny(perms: Set<Permission>, required: Permission[]): boolean {
  return required.some((p) => perms.has(p));
}
