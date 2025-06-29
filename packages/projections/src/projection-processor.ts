/* eslint-disable @typescript-eslint/no-explicit-any */

import type { IDomainEvent, IEventProcessor, IExtendedDomainEvent } from '@vytches-ddd/contracts';
import { LibUtils } from '@vytches-ddd/utils';

import type { IProjectionEngine } from './projection-interfaces';
import type { ProjectionEngineRegistry } from './projection-registry';

export class ProjectionProcessor implements IEventProcessor {
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
    engine: IProjectionEngine<any>,
    event: IExtendedDomainEvent
  ): Promise<void> {
    try {
      await engine.processEvent(event);
    } catch (error) {
      console.error(
        `Error processing event ${event.eventType} in projection ${engine.getProjectionName()}:`,
        error
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
