import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AlertsService } from './alerts.service';
import type {
  FaceObservedPayload,
  GateScanPayload,
  CheckInOutPayload,
  GateOverridePayload,
} from '../../platform/events/app-events';

/**
 * Rule-based + statistical detectors. Each method subscribes to one event
 * type and raises an Alert when its predicate fires. No fabricated CV —
 * everything here is computed from real event-stream data we already have.
 *
 * Tailgating / crowd / camera detectors arrive in Phase 5 alongside the
 * surveillance + occupancy engines.
 */
@Injectable()
export class Detectors {
  private readonly log = new Logger('Detectors');

  /** sliding window of recent rejected scans, keyed by gate */
  private scanFails = new Map<string, number[]>();

  constructor(private readonly alerts: AlertsService) {}

  // ── Blacklisted face at a gate ──────────────────────────────────
  @OnEvent('face.observed')
  async onFace(p: FaceObservedPayload) {
    if (p.matched && p.blacklisted) {
      await this.alerts.raise({
        type: 'blacklist-face',
        severity: 5,
        branchId: p.branchId,
        actorType: p.kind ?? 'visitor',
        actorId: p.matchedId,
        actorName: p.matchedName,
        evidence: { distance: p.distance, ts: p.ts },
        isolate: true, // always its own incident
      });
      return;
    }
    // Unknown face during a window with no expected visitor → low-severity flag
    if (!p.matched) {
      await this.alerts.raise({
        type: 'unknown-face',
        severity: 2,
        branchId: p.branchId,
        actorType: 'unknown',
        evidence: { distance: p.distance, ts: p.ts },
      });
    }
  }

  // ── Gate scan signals ───────────────────────────────────────────
  @OnEvent('gate.scan')
  async onScan(p: GateScanPayload) {
    if (p.outcome === 'rejected') {
      // unauthorized-entry: a real visit that's not approved/checked-in
      if (p.reason && /approval|pending|reject|blacklist/i.test(p.reason)) {
        await this.alerts.raise({
          type: 'unauthorized-entry',
          severity: 4,
          branchId: p.branchId,
          actorType: 'visitor',
          actorId: p.visitorId,
          actorName: p.visitorName,
          evidence: { reason: p.reason, gateId: p.gateId, ts: p.ts },
        });
      }
      // scan-spam: 3+ rejected scans within 10s at the same gate
      this.recordFail(p.gateId ?? 'unknown', p);
    }
  }

  private async recordFail(gateId: string, p: GateScanPayload) {
    const now = Date.now();
    const win = (this.scanFails.get(gateId) ?? []).filter((t) => now - t < 10_000);
    win.push(now);
    this.scanFails.set(gateId, win);
    if (win.length >= 3) {
      this.scanFails.set(gateId, []); // reset after firing
      await this.alerts.raise({
        type: 'scan-spam',
        severity: 3,
        branchId: p.branchId,
        actorType: 'unknown',
        evidence: { gateId, count: win.length, ts: p.ts },
      });
    }
  }

  // ── Gateman override of a denied entry ──────────────────────────
  @OnEvent('gate.override')
  async onOverride(p: GateOverridePayload) {
    await this.alerts.raise({
      type: 'manual-override',
      severity: 3,
      branchId: p.branchId,
      actorType: p.kind,
      actorId: p.actorId,
      actorName: p.actorName,
      evidence: { overriddenBy: p.byEmail, byUserId: p.byUserId, reason: p.reason, ts: p.ts },
    });
  }

  // ── After-hours check-in ────────────────────────────────────────
  @OnEvent('visit.checked_in')
  @OnEvent('worker.checked_in')
  async onCheckIn(p: CheckInOutPayload) {
    const hour = new Date(p.ts).getHours();
    // Default business window 06:00–22:00; tenant override comes later via DetectorConfig
    if (hour < 6 || hour >= 22) {
      await this.alerts.raise({
        type: 'after-hours',
        severity: 3,
        branchId: p.branchId,
        actorType: p.kind,
        actorId: p.actorId,
        actorName: p.actorName,
        evidence: { hour, ts: p.ts },
      });
    }
  }
}
