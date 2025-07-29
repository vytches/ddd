/* eslint-disable @typescript-eslint/no-explicit-any */

import type { IDomainEvent, IEventProcessor, IExtendedDomainEvent } from '@vytches/ddd-contracts';
import { LibUtils } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';

import type { IProjectionEngine } from './projection-interfaces';
import type { ProjectionEngineRegistry } from './projection-registry';

/**
 * @llm-summary ProjectionProcessor class for projection processor operations
 * @llm-domain Architecture
 * @llm-complexity Complex
 *
 * @description
 * ProjectionProcessor class implementing architectural component for projection processor operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ProjectionProcessor();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class ProjectionProcessor implements IEventProcessor {
  private logger = Logger.create('ProjectionProcessor');

  constructor(private readonly engineRegistry: ProjectionEngineRegistry) {}

  /**
   * Determines if this processor can handle the given event
   */
  canProcess(event: IDomainEvent): boolean {
    const extendedEvent = this.ensureExtendedEvent(event);
    return this.engineRegistry.getInterestedEngines(extendedEvent).length > 0;
  }

  /**
   * Process a domain event by updating interested projections
   */
  async process(event: IDomainEvent): Promise<void> {
    const extendedEvent = this.ensureExtendedEvent(event);

    const interestedEngines = this.engineRegistry.getInterestedEngines(extendedEvent);
    if (interestedEngines.length === 0) return;

    const promises = interestedEngines.map(engine =>
      this.processWithErrorHandling(engine, extendedEvent)
    );

    await Promise.all(promises);
  }

  private async processWithErrorHandling(
    engine: IProjectionEngine<unknown>,
    event: IExtendedDomainEvent
  ): Promise<void> {
    try {
      await engine.processEvent(event);
    } catch (error) {
      this.logger.error(
        `Error processing event ${event.eventType} in projection ${engine.getProjectionName()}`,
        error as Error
      );
      // Could add configurable error handling strategy
    }
  }

  private ensureExtendedEvent(event: IDomainEvent): IExtendedDomainEvent {
    if ('metadata' in event) {
      return event as IExtendedDomainEvent;
    }

    return {
      ...event,
      metadata: {
        eventId: LibUtils.getUUID(),
        timestamp: new Date(),
      },
    } as IExtendedDomainEvent;
  }
}
