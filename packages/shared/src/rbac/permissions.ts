/**
 * Permission catalog — declarative, code-owned.
 *
 * Naming rule: `<domain>:<verb>[:scope]` (lowercase, colon-separated).
 * Wildcards never expanded at compile time — the engine resolves them.
 *
 * Adding a permission:
 *   1. Add the literal to PERMISSIONS below
 *   2. Add it to one or more role bundles in role-bundles.ts
 *   3. Annotate the handler with @RequirePermission('domain:verb')
 */

export const PERMISSIONS = [
  // Visitors
  'visitor:read',
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

  // Workforce
  'worker:read',
  'worker:write',
  'worker:terminate',
  'contractor:read',
  'contractor:write',
  'attendance:read',
  'attendance:override',
  'shift:read',
  'shift:write',

  // Intelligence (Phase 4+)
  'anomaly:read',
  'anomaly:ack',
  'anomaly:dismiss',
  'anomaly:escalate',
  'risk:read',
  'risk:override',
  'face:enroll',
  'face:identify',

  // Surveillance (Phase 5+)
  'camera:view',
  'camera:control',
  'clip:export',
  'incident:read',
  'incident:resolve',
  'zone:read',
  'zone:write',

  // Collaboration
  'notice:read',
  'notice:post:branch',
  'notice:post:org',
  'notice:post:global',
  'sos:trigger',
  'sos:clear',

  // Watchlists / documents (Phase 5)
  'watchlist:read',
  'watchlist:manage',
  'watchlist:add_entry',
  'watchlist:export',
  'document:template:read',
  'document:template:write',
  'document:send',

  // Admin
  'user:read',
  'user:write',
  'user:invite',
  'user:deactivate',
  'role:read',
  'role:write',
  'branch:read',
  'branch:write',
  'org:read',
  'org:write',
  'audit:read',
  'audit:export',

  // Search
  'search:cross_branch',

  // Self
  'self:profile',
  'self:totp',
  'self:device',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_SET: ReadonlySet<Permission> = new Set(PERMISSIONS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_SET.has(value as Permission);
}
