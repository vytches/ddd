import { LibUtils } from '@vytches-ddd/utils';

import type { IAggregateRoot, IAuditCapability } from '../aggregate-interfaces';
import type { IAuditEvent, IEventMetadata } from '@vytches-ddd/contracts';
import { CAPABILITY_NAMES } from '../aggregate-interfaces';
import { AggregateError } from '../aggregate-errors';

/**
 * Audit capability implementation
 * Tracks all changes to the aggregate for audit purposes
 */
export class AuditCapability implements IAuditCapability {
  private aggregate!: IAggregateRoot;
  private _auditLog: IAuditEvent[] = [];

  attach(aggregate: IAggregateRoot): void {
    this.aggregate = aggregate;
    // Hook into apply method to capture audit info
    this.interceptApplyMethod();
  }

  detach?(): void {
    // Clear reference safely
    this.aggregate = {} as IAggregateRoot;
    this._auditLog = [];
  }

  getAuditLog(): ReadonlyArray<IAuditEvent> {
    return [...this._auditLog];
  }

  clearAuditLog(): void {
    this._auditLog = [];
  }

  /**
   * Gets audit entries for a specific event type
   */
  getAuditLogByEventType(eventType: string): ReadonlyArray<IAuditEvent> {
    return this._auditLog.filter(entry => entry.eventType === eventType);
  }

  /**
   * Gets audit entries by actor
   */
  getAuditLogByActor(actorId: string): ReadonlyArray<IAuditEvent> {
    return this._auditLog.filter(entry => entry.actor?.id === actorId);
  }

  /**
   * Gets audit entries within a date range
   */
  getAuditLogByDateRange(startDate: Date, endDate: Date): ReadonlyArray<IAuditEvent> {
    return this._auditLog.filter(
      entry => entry.timestamp >= startDate && entry.timestamp <= endDate
    );
  }

  /**
   * Gets the last audit entry
   */
  getLastAuditEntry(): IAuditEvent | undefined {
    return this._auditLog[this._auditLog.length - 1];
  }

  /**
   * Gets audit statistics
   */
  getAuditStatistics(): {
    totalEntries: number;
    eventTypes: string[];
    actors: string[];
    firstEntry?: Date | undefined;
    lastEntry?: Date | undefined;
  } {
    const eventTypes = [...new Set(this._auditLog.map(entry => entry.eventType))];
    const actors = [...new Set(this._auditLog.map(entry => entry.actor?.id).filter(Boolean))];

    return {
      totalEntries: this._auditLog.length,
      eventTypes,
      actors,
      firstEntry: this._auditLog[0]?.timestamp,
      lastEntry: this._auditLog[this._auditLog.length - 1]?.timestamp,
    };
  }

  private interceptApplyMethod(): void {
    // Type-safe method interception using known interface
    const aggregateWithApply = this.aggregate as IAggregateRoot & {
      apply?: (eventTypeOrEvent: string | object, payload?: unknown, metadata?: unknown) => unknown;
    };

    const originalApply = aggregateWithApply.apply?.bind(this.aggregate);

    if (!originalApply) {
      throw AggregateError.cannotInterceptApplyMethod(this.aggregate.getId().getValue().toString());
    }

    aggregateWithApply.apply = (eventTypeOrEvent: string | object, payload?: unknown, metadata?: unknown) => {
      // Call original apply
      const result = originalApply(eventTypeOrEvent, payload, metadata);

      // Create audit log entry
      this.createAuditEntry(eventTypeOrEvent, payload, metadata);

      return result;
    };
  }

  private createAuditEntry(eventTypeOrEvent: string | object, payload?: unknown, metadata?: unknown): void {
    const eventType = typeof eventTypeOrEvent === 'string'
      ? eventTypeOrEvent
      : (eventTypeOrEvent as { eventType?: string }).eventType || 'unknown';

    const auditEvent: IAuditEvent = {
      eventId: LibUtils.getUUID(),
      timestamp: new Date(),
      aggregateId: this.aggregate.getId().getValue(),
      aggregateType: this.aggregate.constructor.name,
      aggregateVersion: this.aggregate.getVersion(),
      eventType,
      payload,
      metadata: (metadata || {}) as IEventMetadata,
      actor: (metadata as { actor?: unknown })?.actor,
      previousState: this.getPreviousStateFromSnapshot(),
    };

    this._auditLog.push(auditEvent);
  }

  private getPreviousStateFromSnapshot(): unknown | null {
    const snapshotCapability = this.aggregate.getCapability(CAPABILITY_NAMES.SNAPSHOT);
    if (snapshotCapability && 'getPreviousState' in snapshotCapability) {
      return (snapshotCapability as { getPreviousState(): unknown }).getPreviousState();
    }
    return null;
  }
}
