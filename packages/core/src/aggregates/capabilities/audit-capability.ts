/* eslint-disable @typescript-eslint/no-explicit-any */
import { LibUtils } from '@vytches-ddd/utils';

import type {
  IAggregateRoot,
  IAuditCapability,
} from '../aggregate-interfaces';
import type { IAuditEvent } from '@vytches-ddd/contracts';
import {
  CAPABILITY_NAMES,
} from '../aggregate-interfaces';
import { AggregateError } from '../aggregate-errors';

/**
 * Audit capability implementation
 * Tracks all changes to the aggregate for audit purposes
 */
export class AuditCapability implements IAuditCapability {
  private aggregate!: IAggregateRoot<any>;
  private _auditLog: IAuditEvent[] = [];

  attach(aggregate: IAggregateRoot<any>): void {
    this.aggregate = aggregate;
    // Hook into apply method to capture audit info
    this.interceptApplyMethod();
  }

  detach?(): void {
    this.aggregate = null as any;
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
    return this._auditLog.filter((entry) => entry.eventType === eventType);
  }

  /**
   * Gets audit entries by actor
   */
  getAuditLogByActor(actorId: string): ReadonlyArray<IAuditEvent> {
    return this._auditLog.filter((entry) => entry.actor?.id === actorId);
  }

  /**
   * Gets audit entries within a date range
   */
  getAuditLogByDateRange(
    startDate: Date,
    endDate: Date,
  ): ReadonlyArray<IAuditEvent> {
    return this._auditLog.filter(
      (entry) => entry.timestamp >= startDate && entry.timestamp <= endDate,
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
    const eventTypes = [
      ...new Set(this._auditLog.map((entry) => entry.eventType)),
    ];
    const actors = [
      ...new Set(
        this._auditLog.map((entry) => entry.actor?.id).filter(Boolean),
      ),
    ];

    return {
      totalEntries: this._auditLog.length,
      eventTypes,
      actors,
      firstEntry: this._auditLog[0]?.timestamp,
      lastEntry: this._auditLog[this._auditLog.length - 1]?.timestamp,
    };
  }

  private interceptApplyMethod(): void {
    const originalApply = (this.aggregate as any).apply?.bind(this.aggregate);

    if (!originalApply) {
      throw AggregateError.cannotInterceptApplyMethod(
        this.aggregate.getId().getValue(),
      );
    }

    (this.aggregate as any).apply = (
      eventTypeOrEvent: any,
      payload?: any,
      metadata?: any,
    ) => {
      // Note: State capture would require serializer function
      // For now, we'll track changes without state snapshots

      // Call original apply
      const result = originalApply(eventTypeOrEvent, payload, metadata);

      // Create audit log entry
      this.createAuditEntry(eventTypeOrEvent, payload, metadata);

      return result;
    };
  }

  private createAuditEntry(
    eventTypeOrEvent: any,
    payload?: any,
    metadata?: any,
  ): void {
    const eventType =
      typeof eventTypeOrEvent === 'string'
        ? eventTypeOrEvent
        : eventTypeOrEvent.eventType;

    const auditEvent: IAuditEvent = {
      eventId: LibUtils.getUUID(),
      timestamp: new Date(),
      aggregateId: this.aggregate.getId().getValue(),
      aggregateType: this.aggregate.constructor.name,
      aggregateVersion: this.aggregate.getVersion(),
      eventType,
      payload,
      metadata,
      actor: metadata?.actor,
      previousState: this.getPreviousStateFromSnapshot(),
    };

    this._auditLog.push(auditEvent);
  }

  private getPreviousStateFromSnapshot(): any | null {
    const snapshotCapability = this.aggregate.getCapability(
      CAPABILITY_NAMES.SNAPSHOT,
    );
    if (snapshotCapability && 'getPreviousState' in snapshotCapability) {
      return (snapshotCapability as any).getPreviousState();
    }
    return null;
  }
}
