import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { EventBus } from '../../platform/events/event-bus';

export interface RaiseAlertInput {
  type: string;
  severity: number; // 1..5
  orgId?: string | null;
  branchId?: string | null;
  actorType?: 'visitor' | 'worker' | 'user' | 'unknown';
  actorId?: string | null;
  actorName?: string | null;
  evidence?: Record<string, unknown>;
  /// Forces a brand-new incident instead of grouping (e.g. blacklist hits)
  isolate?: boolean;
}

const CORRELATION_WINDOW_MS = 10 * 60 * 1000;

const KIND_BY_TYPE: Record<string, string> = {
  'blacklist-face': 'security.blacklist',
  'unknown-face': 'security.unknown_face',
  'unauthorized-entry': 'access.unauthorized',
  'after-hours': 'access.after_hours',
  'scan-spam': 'access.scan_spam',
  'tailgating': 'access.tailgating',
  'crowd-threshold': 'safety.crowd',
  'worker-non-compliant': 'compliance.worker',
  'manual-override': 'access.override',
};

/**
 * Persists alerts and rolls correlated alerts into incidents.
 *
 * Correlation key: (branchId, actorId|type) within a 10-minute window.
 * Blacklist hits always open a fresh, isolated incident.
 */
@Injectable()
export class AlertsService {
  private readonly log = new Logger('Alerts');

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBus,
  ) {}

  async raise(input: RaiseAlertInput) {
    const now = new Date();
    const kind = KIND_BY_TYPE[input.type] ?? 'security.generic';

    // Suppress duplicates: same type+actor+branch in the last 60s
    const dup = await this.prisma.alert.findFirst({
      where: {
        type: input.type,
        branchId: input.branchId ?? undefined,
        actorId: input.actorId ?? undefined,
        raisedAt: { gt: new Date(now.getTime() - 60_000) },
      },
      select: { id: true },
    });
    if (dup) return null;

    const incidentId = input.isolate
      ? await this.openIncident(input, kind, now)
      : await this.findOrOpenIncident(input, kind, now);

    const alert = await this.prisma.alert.create({
      data: {
        type: input.type,
        severity: clampSeverity(input.severity),
        orgId: input.orgId ?? null,
        branchId: input.branchId ?? null,
        actorType: input.actorType ?? 'unknown',
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        evidence: (input.evidence ?? {}) as any,
        status: 'open',
        incidentId,
      },
    });

    await this.prisma.incidentTimelineEntry.create({
      data: {
        incidentId,
        kind: 'ALERT_ADDED',
        actorName: input.actorName ?? null,
        payload: { alertId: alert.id, type: input.type, severity: alert.severity } as any,
      },
    });

    // Bump incident severity if this alert is more severe
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: { severity: { set: await this.maxSeverity(incidentId) } },
    });

    this.events.emit('alert.raised', {
      alertId: alert.id,
      orgId: alert.orgId ?? undefined,
      branchId: alert.branchId ?? undefined,
      type: alert.type,
      severity: alert.severity,
      ts: now.toISOString(),
    });

    this.log.warn(`alert ${input.type} sev${alert.severity} → incident ${incidentId}`);
    return alert;
  }

  private async findOrOpenIncident(input: RaiseAlertInput, kind: string, now: Date) {
    const open = await this.prisma.incident.findFirst({
      where: {
        branchId: input.branchId ?? undefined,
        kind,
        status: { in: ['open', 'investigating'] },
        openedAt: { gt: new Date(now.getTime() - CORRELATION_WINDOW_MS) },
      },
      orderBy: { openedAt: 'desc' },
      select: { id: true },
    });
    if (open) return open.id;
    return this.openIncident(input, kind, now);
  }

  private async openIncident(input: RaiseAlertInput, kind: string, now: Date) {
    const inc = await this.prisma.incident.create({
      data: {
        orgId: input.orgId ?? null,
        branchId: input.branchId ?? null,
        severity: clampSeverity(input.severity),
        kind,
        title: titleFor(input),
        status: 'open',
        openedAt: now,
      },
    });
    await this.prisma.incidentTimelineEntry.create({
      data: { incidentId: inc.id, kind: 'NOTE', payload: { opened: kind } as any },
    });
    return inc.id;
  }

  private async maxSeverity(incidentId: string): Promise<number> {
    const agg = await this.prisma.alert.aggregate({
      where: { incidentId },
      _max: { severity: true },
    });
    return agg._max.severity ?? 2;
  }
}

function clampSeverity(s: number): number {
  return Math.max(1, Math.min(5, Math.round(s)));
}

function titleFor(input: RaiseAlertInput): string {
  const who = input.actorName ? ` — ${input.actorName}` : '';
  switch (input.type) {
    case 'blacklist-face':
      return `Blacklisted visitor detected${who}`;
    case 'unknown-face':
      return `Unrecognized face at gate${who}`;
    case 'unauthorized-entry':
      return `Unauthorized entry attempt${who}`;
    case 'after-hours':
      return `After-hours access${who}`;
    case 'scan-spam':
      return `Repeated failed scans at gate`;
    case 'tailgating':
      return `Possible tailgating${who}`;
    case 'crowd-threshold':
      return `Occupancy threshold exceeded`;
    case 'worker-non-compliant':
      return `Non-compliant worker on-site${who}`;
    case 'manual-override':
      return `Gateman override — entry forced${who}`;
    default:
      return `Security alert${who}`;
  }
}
