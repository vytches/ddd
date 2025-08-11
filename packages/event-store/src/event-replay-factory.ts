import type {
  IAdvancedEventReplay,
  IAdvancedEventStore,
  IEventReplay,
  IEventReplayFactory,
} from '@vytches/ddd-contracts';

import type { ILogger } from '@vytches/ddd-logging';
import { Logger } from '@vytches/ddd-logging';
import { EventReplayEngine } from './event-replay-engine';

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

export function createEventReplayFactory(eventStore: IAdvancedEventStore): IEventReplayFactory {
  return new EventReplayFactory(eventStore);
}

export function createEventReplay(eventStore: IAdvancedEventStore): IEventReplay {
  const factory = new EventReplayFactory(eventStore);
  return factory.createBasicReplay();
}

export function createAdvancedEventReplay(eventStore: IAdvancedEventStore): IAdvancedEventReplay {
  const factory = new EventReplayFactory(eventStore);
  return factory.createAdvancedReplay();
}
