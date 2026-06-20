// Multi-tenant helpers. SUPER_ADMIN bypasses all org scoping; everyone else
// only sees data inside their own organization.
import { ForbiddenException } from '@nestjs/common';

export interface JwtUser {
  userId: string;
  email: string;
  role: string;
  orgId: string | null;
  branchId: string | null;
  /**
   * Effective permission set baked into the access token at issuance.
   * Optional during the rollout — guards fall back to recomputing if absent.
   */
  perms?: string[];
}

export function isSuperAdmin(user: JwtUser | undefined | null): boolean {
  return user?.role === 'SUPER_ADMIN';
}

export function requireOrg(user: JwtUser | undefined | null): string {
  if (isSuperAdmin(user)) return ''; // sentinel: caller should handle SUPER_ADMIN separately
  if (!user?.orgId) {
    throw new ForbiddenException('Your account is not attached to an organization');
  }
  return user.orgId;
}

// Convenience builders for common Prisma "where" filters.
// Each returns {} for SUPER_ADMIN (no filter), or the right where clause otherwise.

export function branchScope(user: JwtUser | undefined | null) {
  if (isSuperAdmin(user)) return {};
  const orgId = requireOrg(user);
  return { organizationId: orgId };
}

export function contractorScope(user: JwtUser | undefined | null) {
  if (isSuperAdmin(user)) return {};
  return { organizationId: requireOrg(user) };
}

export function workerScope(user: JwtUser | undefined | null) {
  if (isSuperAdmin(user)) return {};
  return { contractor: { organizationId: requireOrg(user) } };
}

export function visitScope(user: JwtUser | undefined | null) {
  if (isSuperAdmin(user)) return {};
  return { branch: { organizationId: requireOrg(user) } };
}

export function attendanceScope(user: JwtUser | undefined | null) {
  if (isSuperAdmin(user)) return {};
  return { branch: { organizationId: requireOrg(user) } };
}

export function userScope(user: JwtUser | undefined | null) {
  if (isSuperAdmin(user)) return {};
  return { branch: { organizationId: requireOrg(user) } };
}

// Visitors don't carry org directly — scope by "has a visit in our org".
export function visitorScope(user: JwtUser | undefined | null) {
  if (isSuperAdmin(user)) return {};
  return { visits: { some: { branch: { organizationId: requireOrg(user) } } } };
}
