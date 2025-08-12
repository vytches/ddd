/* eslint-disable @typescript-eslint/no-explicit-any */

import type { IDomainEvent, IEventProcessor } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import { LibUtils } from '@vytches/ddd-utils';

import type { IProjectionEngine } from './projection-interfaces';
import type { ProjectionEngineRegistry } from './projection-registry';

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
    event: IDomainEvent
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

  private ensureExtendedEvent(event: IDomainEvent): IDomainEvent {
    if ('metadata' in event) {
      return event as IDomainEvent;
    }

    return {
      ...event,
      metadata: {
        eventId: LibUtils.getUUID(),
        timestamp: new Date(),
      },
    } as IDomainEvent;
  }
}
