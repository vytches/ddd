import { Capability } from '@vytches/ddd-contracts';
import type { IAuditCapability, IAuditEvent, IDomainEvent } from '@vytches/ddd-contracts';
import type { IAggregateRoot } from '../aggregate-interfaces';

export class AuditCapability extends Capability<'audit'> implements IAuditCapability {
  override readonly type = 'audit' as const;

  static override get capabilityType(): string {
    return 'audit';
  }
  private aggregate!: IAggregateRoot;
  private auditLog: IAuditEvent[] = [];
  private originalApply?: ((...args: unknown[]) => void) | undefined;

  /**
   * @param {unknown} aggregate - Aggregate to attach this capability to
   */
  attach(aggregate: unknown): void {
    this.aggregate = aggregate as IAggregateRoot;

    // Store original apply method for restoration
    this.originalApply = (
      this.aggregate as unknown as { apply: (...args: unknown[]) => void }
    ).apply;

    // Intercept the apply method to capture events as they're added
    if (this.originalApply) {
      (this.aggregate as unknown as { apply: (...args: unknown[]) => void }).apply = (
        ...args: unknown[]
      ) => {
        // Call original apply method first
        const result = this.originalApply!.call(this.aggregate, ...args);

        // Then record the audit event for the newly added event
        this.recordAuditEvent();

        return result;
      };
    }
  }

  detach?(): void {
    // Restore original apply method
    if (this.aggregate && this.originalApply) {
      (this.aggregate as unknown as { apply: (...args: unknown[]) => void }).apply =
        this.originalApply;
    }

    this.aggregate = undefined!;
    this.auditLog = [];
    this.originalApply = undefined;
  }

  /**
   * @returns {IAuditEvent[]} Copy of the current audit log
   */
  getAuditLog(): IAuditEvent[] {
    return [...this.auditLog];
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * @returns {{totalEvents: number, eventsByType: Record<string, number>, averageTimeBetweenEvents: number}} Audit statistics summary
   */
  getAuditStatistics(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    averageTimeBetweenEvents: number;
  } {
    const eventsByType: Record<string, number> = {};
    let totalTime = 0;

    this.auditLog.forEach((auditEvent, index) => {
      eventsByType[auditEvent.eventName] = (eventsByType[auditEvent.eventName] || 0) + 1;

      if (index > 0) {
        const prevEvent = this.auditLog[index - 1];
        if (prevEvent) {
          const prevTimestamp = new Date(prevEvent.timestamp).getTime();
          const currTimestamp = new Date(auditEvent.timestamp).getTime();
          totalTime += currTimestamp - prevTimestamp;
        }
      }
    });

    const averageTimeBetweenEvents =
      this.auditLog.length > 1 ? totalTime / (this.auditLog.length - 1) : 0;

    return {
      totalEvents: this.auditLog.length,
      eventsByType,
      averageTimeBetweenEvents,
    };
  }

  /**
   * Record an audit event when domain events are added
   */
  private recordAuditEvent(): void {
    const events = this.aggregate.getDomainEvents();
    const lastEvent = events[events.length - 1];

    if (lastEvent) {
      this.recordEvent(lastEvent);
    }
  }

  /**
   * @param {IDomainEvent} event - Domain event to record in audit log
   */
  recordEvent(event: IDomainEvent): void {
    const auditEvent: IAuditEvent = {
      eventId: (event.metadata?.eventId as string) || `audit-${Date.now()}-${Math.random()}`,
      eventName: event.eventName,
      aggregateId: this.aggregate.getId().toString(),
      aggregateType: this.aggregate.constructor.name,
      aggregateVersion: this.aggregate.getVersion(),
      timestamp: new Date(),
      payload: event.payload,
      metadata: {
        ...event.metadata,
        auditCapability: true,
      },
      actor: event.metadata?.userId,
    };

    this.auditLog.push(auditEvent);
  }

  /**
   * @param {string} eventName - Name of events to filter by
   * @returns {IAuditEvent[]} Array of audit events matching the specified name
   */
  getEventsByName(eventName: string): IAuditEvent[] {
    return this.auditLog.filter(event => event.eventName === eventName);
  }

  /**
   * @param {Date} startDate - Start date for time range filter
   * @param {Date} endDate - End date for time range filter
   * @returns {IAuditEvent[]} Array of audit events within the specified time range
   */
  getEventsByTimeRange(startDate: Date, endDate: Date): IAuditEvent[] {
    return this.auditLog.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      return eventTime >= startDate.getTime() && eventTime <= endDate.getTime();
    });
  }

  /**
   * @returns {IAuditEvent | null} First audit event in chronological order or null if none exists
   */
  getFirstEvent(): IAuditEvent | null {
    return this.auditLog[0] || null;
  }

  /**
   * @returns {IAuditEvent | null} Last audit event in chronological order or null if none exists
   */
  getLastEvent(): IAuditEvent | null {
    return this.auditLog[this.auditLog.length - 1] || null;
  }
}
