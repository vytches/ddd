import type {
  IEventReplayFactory,
  IEventReplay,
  IAdvancedEventReplay,
  IAdvancedEventStore,
} from '@vytches-ddd/contracts';

import { EventReplayEngine } from './event-replay-engine';
import { Logger } from '@vytches-ddd/logging';
import type { ILogger } from '@vytches-ddd/logging';

/**
 * Factory for creating event replay instances
 */
export class EventReplayFactory implements IEventReplayFactory {
  private readonly logger: ILogger;

  constructor(private readonly eventStore: IAdvancedEventStore) {
    this.logger = Logger.forContext('EventReplayFactory');
  }

  /**
   * Create a basic event replay
   */
  createBasicReplay(): IEventReplay {
    this.logger.debug('Creating basic event replay');
    return new EventReplayEngine(this.eventStore);
  }

  /**
   * Create an advanced event replay with session control
   */
  createAdvancedReplay(): IAdvancedEventReplay {
    this.logger.debug('Creating advanced event replay');
    return new EventReplayEngine(this.eventStore);
  }

  /**
   * Create a replay with custom strategy
   */
  createCustomReplay<T extends IEventReplay>(
    strategy: new (eventStore: IAdvancedEventStore) => T
  ): T {
    this.logger.debug('Creating custom event replay', { strategyName: strategy.name });
    return new strategy(this.eventStore);
  }

  /**
   * Create event replay with specific capabilities
   */
  createReplayWithCapabilities(capabilities: {
    enableSessionControl?: boolean;
    enableProgressReporting?: boolean;
    enableErrorRecovery?: boolean;
    enableParallelProcessing?: boolean;
  }): IEventReplay | IAdvancedEventReplay {
    this.logger.debug('Creating event replay with capabilities', { capabilities });

    if (capabilities.enableSessionControl) {
      return this.createAdvancedReplay();
    }

    return this.createBasicReplay();
  }
}

/**
 * Utility function to create event replay factory
 */
export function createEventReplayFactory(eventStore: IAdvancedEventStore): IEventReplayFactory {
  return new EventReplayFactory(eventStore);
}

/**
 * Utility function to create basic event replay
 */
export function createEventReplay(eventStore: IAdvancedEventStore): IEventReplay {
  const factory = new EventReplayFactory(eventStore);
  return factory.createBasicReplay();
}

/**
 * Utility function to create advanced event replay
 */
export function createAdvancedEventReplay(eventStore: IAdvancedEventStore): IAdvancedEventReplay {
  const factory = new EventReplayFactory(eventStore);
  return factory.createAdvancedReplay();
}