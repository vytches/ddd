/* eslint-disable @typescript-eslint/no-explicit-any */

import type { IRepository, IActor } from '@vytches/ddd-core';
import type { IExtendedDomainEvent } from '@vytches/ddd-contracts';

import type { IEventProcessor } from '../event-processor';
import type { IAuditEvent, IAuditEventMetadata } from './audit-event.interface';
import { AuditActionType, AuditStatus } from './audit-event.interface';

/**
 * @llm-summary Contract for audit event processor options functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * AuditEventProcessorOptions interface implementing architectural component for audit event processor options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteAuditEventProcessorOptions implements AuditEventProcessorOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface AuditEventProcessorOptions {
  /** Audit all domain events */
  auditAll?: boolean;

  /** Only audit specific event types */
  auditEventTypes?: string[];

  /** Default source identifier */
  source?: string;
}

/**
 * @llm-summary AuditEventProcessor class for audit event processor operations
 * @llm-domain Architecture
 * @llm-complexity Complex
 *
 * @description
 * AuditEventProcessor class implementing architectural component for audit event processor operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new AuditEventProcessor();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class AuditEventProcessor implements IEventProcessor {
  constructor(
    private readonly auditRepository: IRepository<any>,
    private readonly options: AuditEventProcessorOptions = {}
  ) {}

  /**
   * Process a domain event by creating an audit event if applicable
   */
  async process(event: IExtendedDomainEvent): Promise<void> {
    // Check if event should be audited
    if (!this.shouldAudit(event)) return;

    // Create and publish audit event
    const auditEvent = this.createAuditEvent(event);
    await this.auditRepository.save(auditEvent);
  }

  /**
   * Determine if an event should be audited based on configuration
   */
  private shouldAudit(event: IExtendedDomainEvent): boolean {
    if (this.options.auditAll) return true;

    if (this.options.auditEventTypes && this.options.auditEventTypes.length > 0) {
      return this.options.auditEventTypes.includes(event.eventType);
    }

    return false;
  }

  /**
   * Create an audit event from a domain event
   */
  private createAuditEvent(domainEvent: IExtendedDomainEvent): IAuditEvent {
    // Determine action type from event name
    let actionType = AuditActionType.OTHER;
    if (domainEvent.eventType.includes('Created')) actionType = AuditActionType.CREATE;
    if (domainEvent.eventType.includes('Updated')) actionType = AuditActionType.UPDATE;
    if (domainEvent.eventType.includes('Deleted')) actionType = AuditActionType.DELETE;

    const metadata: IAuditEventMetadata = {
      previousState: domainEvent?.metadata?._previousState,
      correlationId: domainEvent?.metadata?.correlationId ?? '',
      timestamp: new Date(),
      actionType,
      status: AuditStatus.SUCCESS,
      source: this.options.source || 'domain_event',
      resourceId: domainEvent.metadata?.aggregateId?.toString() || 'unknown',
      resourceType: domainEvent.metadata?.aggregateType || 'unknown',
    };

    if (domainEvent.metadata?.actor) {
      metadata.actor = domainEvent.metadata.actor as IActor;
    }

    return {
      eventType: `AUDIT_${domainEvent.eventType}`,
      payload: domainEvent.payload,
      metadata,
    };
  }

  /**
   * Manually record an audit action
   */
  async recordAction(
    action: AuditActionType | string,
    resourceType: string,
    resourceId: string,
    data?: any
  ): Promise<void> {
    const auditEvent: IAuditEvent = {
      eventType: `AUDIT_${action}`,
      payload: data,
      metadata: {
        timestamp: new Date(),
        actionType: action,
        status: AuditStatus.SUCCESS,
        source: 'manual',
        resourceId,
        resourceType,
      },
    };

    await this.auditRepository.save(auditEvent);
  }
}
