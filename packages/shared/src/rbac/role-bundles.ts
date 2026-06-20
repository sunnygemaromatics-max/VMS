import type { Permission } from './permissions';

/**
 * Default permission bundle per built-in Role.
 *
 * Tenants may clone these into TenantRole and customize; the engine then
 * resolves effective permissions as: role bundle ∪ tenantRole.permissions
 * ∪ user.extraPermissions − user.deniedPermissions.
 *
 * Wildcard "*" inside a bundle means "every permission" — only used by
 * SUPER_ADMIN. Engine expands it on resolution.
 */

export type RoleName =
  | 'SUPER_ADMIN'
  | 'ORG_ADMIN'
  | 'HR_MANAGER'
  | 'SECURITY_HEAD'
  | 'SECURITY_GUARD'
  | 'RECEPTIONIST'
  | 'CONTRACTOR_SUPERVISOR'
  | 'EMPLOYEE'
  | 'SOC_OPERATOR'
  | 'AUDITOR';

// Reads-all helper bundle
const READ_ALL: Permission[] = [
  'visitor:read',
  'visit:approve', // read approval queue
  'worker:read',
  'contractor:read',
  'attendance:read',
  'shift:read',
  'anomaly:read',
  'risk:read',
  'camera:view',
  'incident:read',
  'zone:read',
  'notice:read',
  'watchlist:read',
  'document:template:read',
  'user:read',
  'role:read',
  'branch:read',
  'org:read',
  'audit:read',
];

const SELF: Permission[] = ['self:profile', 'self:totp', 'self:device'];

export const ROLE_BUNDLES: Record<RoleName, Permission[] | ['*']> = {
  SUPER_ADMIN: ['*'],

  ORG_ADMIN: [
    ...READ_ALL,
    'visitor:write',
    'visitor:blacklist',
    'visitor:vip',
    'visit:approve',
    'visit:reject',
    'visit:checkin',
    'visit:checkout',
    'visit:override',
    'visit:approve_bulk',
    'visit:extend',
    'visit:revoke',
    'visit:escort_assign',
    'worker:write',
    'worker:terminate',
    'contractor:write',
    'attendance:override',
    'shift:write',
    'anomaly:ack',
    'anomaly:dismiss',
    'anomaly:escalate',
    'risk:override',
    'face:enroll',
    'face:identify',
    'camera:control',
    'clip:export',
    'incident:resolve',
    'zone:write',
    'notice:post:branch',
    'notice:post:org',
    'sos:trigger',
    'sos:clear',
    'watchlist:manage',
    'watchlist:add_entry',
    'watchlist:export',
    'document:template:write',
    'document:send',
    'user:write',
    'user:invite',
    'user:deactivate',
    'role:write',
    'branch:write',
    'audit:export',
    'search:cross_branch',
    ...SELF,
  ],

  SECURITY_HEAD: [
    ...READ_ALL,
    'visitor:write',
    'visitor:blacklist',
    'visitor:vip',
    'visit:approve',
    'visit:reject',
    'visit:checkin',
    'visit:checkout',
    'visit:override',
    'visit:approve_bulk',
    'visit:extend',
    'visit:revoke',
    'visit:escort_assign',
    'attendance:override',
    'anomaly:ack',
    'anomaly:dismiss',
    'anomaly:escalate',
    'face:enroll',
    'face:identify',
    'camera:control',
    'clip:export',
    'incident:resolve',
    'notice:post:branch',
    'notice:post:org',
    'sos:trigger',
    'sos:clear',
    'watchlist:manage',
    'watchlist:add_entry',
    'audit:read',
    ...SELF,
  ],

  HR_MANAGER: [
    'visitor:read',
    'worker:read',
    'worker:write',
    'contractor:read',
    'contractor:write',
    'attendance:read',
    'shift:read',
    'shift:write',
    'notice:read',
    'notice:post:branch',
    'audit:read',
    ...SELF,
  ],

  SOC_OPERATOR: [
    'anomaly:read',
    'anomaly:ack',
    'anomaly:dismiss',
    'anomaly:escalate',
    'incident:read',
    'incident:resolve',
    'camera:view',
    'camera:control',
    'clip:export',
    'risk:read',
    'face:identify',
    'audit:read',
    'visitor:read',
    'worker:read',
    'attendance:read',
    'notice:read',
    'sos:clear',
    ...SELF,
  ],

  AUDITOR: [
    ...READ_ALL,
    'audit:export',
    ...SELF,
  ],

  RECEPTIONIST: [
    'visitor:read',
    'visitor:write',
    'visitor:vip',
    'visit:approve',
    'visit:reject',
    'visit:checkin',
    'visit:checkout',
    'visit:extend',
    'face:enroll',
    'face:identify',
    'notice:read',
    'sos:trigger',
    'document:send',
    ...SELF,
  ],

  SECURITY_GUARD: [
    'visitor:read',
    'visit:checkin',
    'visit:checkout',
    'worker:read',
    'attendance:read',
    'face:identify',
    'anomaly:read',
    'incident:read',
    'camera:view',
    'sos:trigger',
    'notice:read',
    ...SELF,
  ],

  CONTRACTOR_SUPERVISOR: [
    'worker:read',
    'attendance:read',
    'shift:read',
    'face:enroll',
    'notice:read',
    ...SELF,
  ],

  EMPLOYEE: [
    'visit:approve', // host-side approval of own visits
    'visit:reject',
    'visitor:read',  // visible only via tenant-scoped queries
    'notice:read',
    ...SELF,
  ],
};
