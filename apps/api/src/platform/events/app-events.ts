/**
 * Typed event catalog for the entire API process.
 *
 * Every domain change emits exactly one of these events. Adapters
 * (realtime, push, audit, intelligence, etc.) subscribe to events —
 * they never call each other directly.
 *
 * Naming rule: `<domain>.<past_tense_verb>` (lowercase, dot-separated).
 *
 * Adding a new event:
 *   1. Add `AppEventName` literal + `AppEventPayloads` mapping below
 *   2. Producer calls `eventBus.emit('domain.event', payload)`
 *   3. Subscribers use `@OnEvent('domain.event')`
 */

export interface VisitChangedPayload {
  visitId: string;
  branchId: string;
  visitorName?: string;
  hostName?: string;
  status?: string;
  ts: string;
}

export interface WalkInPayload {
  visitId: string;
  branchId: string;
  visitorName: string;
  hostName: string;
  purpose: string;
  ts: string;
}

export interface CheckInOutPayload {
  branchId: string;
  kind: 'visitor' | 'worker';
  actorName: string;
  actorId: string;
  ts: string;
}

export interface ApprovalDecisionPayload {
  visitId: string;
  branchId: string;
  visitorName: string;
  hostName: string;
  status: 'APPROVED' | 'REJECTED';
  visitorEmail?: string | null;
  ts: string;
}

export interface SosTriggeredPayload {
  actorId: string;
  actorEmail: string;
  actorName: string;
  branchId?: string;
  branchName?: string;
  message?: string;
  ts: string;
}

export interface SosClearedPayload {
  actorId: string;
  ts: string;
}

export interface NoticePostedPayload {
  notice: {
    id: string;
    title: string;
    body: string;
    /** stored as 'info' | 'warning' | 'urgent' but typed string for forward-compat */
    level: string;
    organizationId: string | null;
    branchId: string | null;
    authorName: string;
    createdAt: Date | string;
    expiresAt: Date | string | null;
  };
}

export interface NoticeRemovedPayload {
  id: string;
}

export interface HeadcountInvalidatedPayload {
  branchId?: string;
  reason: string;
  ts: string;
}

/// Emitted whenever a QR scan is attempted at a gate — even rejected ones.
/// Detectors (scan-spam, unauthorized-entry) subscribe to this.
export interface GateScanPayload {
  branchId?: string;
  gateId?: string;
  /// 'approved' | 'rejected' | 'unknown'
  outcome: string;
  /// reason for rejection, when applicable
  reason?: string;
  visitId?: string;
  visitorId?: string;
  visitorName?: string;
  ts: string;
}

/// Emitted by the face pipeline after a 1:N identify.
export interface FaceObservedPayload {
  branchId?: string;
  matched: boolean;
  kind?: 'visitor' | 'worker';
  matchedId?: string;
  matchedName?: string;
  /// true when the matched visitor is blacklisted
  blacklisted?: boolean;
  distance?: number;
  ts: string;
}

/// Emitted when a gateman overrides a denied face-gate entry.
export interface GateOverridePayload {
  branchId?: string;
  kind: 'worker' | 'visitor';
  actorId: string;
  actorName: string;
  byUserId: string;
  byEmail: string;
  reason: string;
  ts: string;
}

/// Emitted by the AlertAggregator once an alert is persisted.
export interface AlertRaisedPayload {
  alertId: string;
  orgId?: string;
  branchId?: string;
  type: string;
  severity: number;
  ts: string;
}

export interface AppEventPayloads {
  'visit.walked_in': WalkInPayload;
  'visit.decided': ApprovalDecisionPayload;
  'visit.checked_in': CheckInOutPayload;
  'visit.checked_out': CheckInOutPayload;
  'worker.checked_in': CheckInOutPayload;
  'worker.checked_out': CheckInOutPayload;
  'sos.triggered': SosTriggeredPayload;
  'sos.cleared': SosClearedPayload;
  'notice.posted': NoticePostedPayload;
  'notice.removed': NoticeRemovedPayload;
  'headcount.invalidated': HeadcountInvalidatedPayload;
  'gate.scan': GateScanPayload;
  'face.observed': FaceObservedPayload;
  'gate.override': GateOverridePayload;
  'alert.raised': AlertRaisedPayload;
}

export type AppEventName = keyof AppEventPayloads;
