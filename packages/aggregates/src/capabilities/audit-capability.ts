import { Capability } from '@vytches-ddd/contracts';
import type { IAuditCapability, IAuditEvent, IExtendedDomainEvent } from '@vytches-ddd/contracts';
import type { IAggregateRoot } from '../aggregate-interfaces';

/**
 * @llm-summary AuditCapability class for audit capability operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * AuditCapability class implementing domain pattern implementation for audit capability operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new AuditCapability();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new AuditCapability());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class AuditCapability extends Capability<'audit'> implements IAuditCapability {
  override readonly type = 'audit' as const;

  static override get capabilityType(): string {
    return 'audit';
  }
  private aggregate!: IAggregateRoot;
  private auditLog: IAuditEvent[] = [];
  private originalApply?: ((...args: unknown[]) => void) | undefined;

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

  getAuditLog(): IAuditEvent[] {
    return [...this.auditLog];
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }

  getAuditStatistics(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    averageTimeBetweenEvents: number;
  } {
    const eventsByType: Record<string, number> = {};
    let totalTime = 0;

    this.auditLog.forEach((auditEvent, index) => {
      eventsByType[auditEvent.eventType] = (eventsByType[auditEvent.eventType] || 0) + 1;

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
   * Manually record a domain event for auditing
   */
  recordEvent(event: IExtendedDomainEvent): void {
    const auditEvent: IAuditEvent = {
      eventId: event.metadata?.eventId || `audit-${Date.now()}-${Math.random()}`,
      eventType: event.eventType,
      aggregateId: this.aggregate.getId().getValue(),
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
   * Get audit events by type
   */
  getEventsByType(eventType: string): IAuditEvent[] {
    return this.auditLog.filter(event => event.eventType === eventType);
  }

  /**
   * Get audit events within a time range
   */
  getEventsByTimeRange(startDate: Date, endDate: Date): IAuditEvent[] {
    return this.auditLog.filter(event => {
      const eventTime = new Date(event.timestamp).getTime();
      return eventTime >= startDate.getTime() && eventTime <= endDate.getTime();
    });
  }

  /**
   * Get the first audit event
   */
  getFirstEvent(): IAuditEvent | null {
    return this.auditLog[0] || null;
  }

  /**
   * Get the last audit event
   */
  getLastEvent(): IAuditEvent | null {
    return this.auditLog[this.auditLog.length - 1] || null;
  }
}
