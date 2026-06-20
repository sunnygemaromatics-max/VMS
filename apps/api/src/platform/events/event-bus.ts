import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AppEventName, AppEventPayloads } from './app-events';

/**
 * Thin typed facade over Nest's EventEmitter2. Emits and subscribes
 * are constrained to the event catalog in app-events.ts — adding a
 * new event without updating the catalog is a compile error.
 *
 * Subscribers use the @OnEvent('domain.event') decorator from
 * @nestjs/event-emitter directly; this service is the producer side.
 */
@Injectable()
export class EventBus {
  constructor(private readonly emitter: EventEmitter2) {}

  emit<K extends AppEventName>(name: K, payload: AppEventPayloads[K]): void {
    this.emitter.emit(name, payload);
  }

  /**
   * Async emit — resolves once every listener (sync or promise-returning)
   * has settled. Useful for tests; production code should prefer fire-and-forget
   * emit() and never block the request on listeners.
   */
  async emitAsync<K extends AppEventName>(
    name: K,
    payload: AppEventPayloads[K],
  ): Promise<unknown[]> {
    return this.emitter.emitAsync(name, payload);
  }
}
