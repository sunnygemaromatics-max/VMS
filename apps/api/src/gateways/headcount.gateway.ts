import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { VisitStatus } from '@prisma/client';
import { PrismaService } from '../platform/prisma/prisma.service';
import type {
  ApprovalDecisionPayload,
  CheckInOutPayload,
  NoticePostedPayload,
  NoticeRemovedPayload,
  SosClearedPayload,
  SosTriggeredPayload,
  WalkInPayload,
} from '../platform/events/app-events';

/**
 * WebSocket adapter. Today this gateway both maintains the socket.io server
 * AND listens to the event bus, fanning every domain event out to dashboards.
 *
 * Producers MUST emit events via EventBus, not call this gateway's broadcast*
 * methods. The broadcast* methods remain only as a backward-compat shim while
 * remaining call sites migrate.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class HeadcountGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private connectedClients = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    this.connectedClients.add(client.id);
    const headcount = await this.calculateHeadcount();
    client.emit('headcount_update', headcount);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('request_headcount')
  async handleHeadcountRequest() {
    const headcount = await this.calculateHeadcount();
    this.server.emit('headcount_update', headcount);
  }

  private async calculateHeadcount() {
    const [activeVisits, activeWorkers] = await Promise.all([
      this.prisma.visit.findMany({
        where: { status: VisitStatus.CHECKED_IN, actualExit: null },
        select: { id: true, visitor: { select: { company: true } } },
      }),
      this.prisma.attendance.count({ where: { checkOut: null } }),
    ]);

    const visitors = activeVisits.filter((v) => v.visitor.company).length;
    const employees = activeVisits.filter((v) => !v.visitor.company).length;

    return {
      total: visitors + employees + activeWorkers,
      visitors,
      workers: activeWorkers,
      employees,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Event subscribers ────────────────────────────────────────────

  @OnEvent('headcount.invalidated')
  async onHeadcountInvalidated() {
    const headcount = await this.calculateHeadcount();
    this.server.emit('headcount_update', headcount);
  }

  @OnEvent('visit.walked_in')
  onWalkIn(payload: WalkInPayload) {
    this.server.emit('notification', {
      kind: 'walk-in',
      title: `${payload.visitorName} just walked in`,
      body: `${payload.purpose} · host ${payload.hostName}`,
      visitId: payload.visitId,
      ts: payload.ts,
    });
  }

  @OnEvent('visit.decided')
  onApprovalDecided(payload: ApprovalDecisionPayload) {
    this.server.emit('notification', {
      kind: 'approval',
      title: `${payload.visitorName} ${payload.status.toLowerCase()}`,
      body: `Host: ${payload.hostName}`,
      visitId: payload.visitId,
      ts: payload.ts,
    });
  }

  @OnEvent('visit.checked_in')
  @OnEvent('worker.checked_in')
  onCheckedIn(payload: CheckInOutPayload) {
    this.server.emit('notification', {
      kind: 'check-in',
      title: `${payload.actorName} checked in`,
      ts: payload.ts,
    });
  }

  @OnEvent('visit.checked_out')
  @OnEvent('worker.checked_out')
  onCheckedOut(payload: CheckInOutPayload) {
    this.server.emit('notification', {
      kind: 'check-out',
      title: `${payload.actorName} checked out`,
      ts: payload.ts,
    });
  }

  @OnEvent('sos.triggered')
  onSosTriggered(payload: SosTriggeredPayload) {
    this.server.emit('sos', {
      actorEmail: payload.actorEmail,
      actorName: payload.actorName,
      branchName: payload.branchName,
      message: payload.message,
      ts: payload.ts,
    });
  }

  @OnEvent('sos.cleared')
  onSosCleared(payload: SosClearedPayload) {
    this.server.emit('sos_clear', { ts: payload.ts });
  }

  @OnEvent('notice.posted')
  onNoticePosted(payload: NoticePostedPayload) {
    this.server.emit('notice_new', payload.notice);
  }

  @OnEvent('notice.removed')
  onNoticeRemoved(payload: NoticeRemovedPayload) {
    this.server.emit('notice_removed', { id: payload.id });
  }

  // ── Backward-compat shims (do not add new callers) ───────────────
  // Existing producers still invoke these; PR 2.2 migrates them to
  // EventBus.emit() one module at a time without breakage.

  async broadcastHeadcountUpdate() {
    const headcount = await this.calculateHeadcount();
    this.server.emit('headcount_update', headcount);
  }

  broadcastNotification(payload: {
    kind: 'walk-in' | 'approval' | 'check-in' | 'check-out';
    title: string;
    body?: string;
    visitId?: string;
  }) {
    this.server.emit('notification', { ...payload, ts: new Date().toISOString() });
  }

  broadcastSos(payload: {
    actorEmail: string;
    actorName: string;
    branchName?: string;
    message?: string;
  }) {
    this.server.emit('sos', { ...payload, ts: new Date().toISOString() });
  }

  broadcastSosClear() {
    this.server.emit('sos_clear', { ts: new Date().toISOString() });
  }

  broadcastNotice(notice: unknown) {
    this.server.emit('notice_new', notice);
  }

  broadcastNoticeRemoved(id: string) {
    this.server.emit('notice_removed', { id });
  }
}
