import type {
  IEventReplayFactory,
  IEventReplay,
  IAdvancedEventReplay,
  IAdvancedEventStore,
} from '@vytches/ddd-contracts';

import { EventReplayEngine } from './event-replay-engine';
import { Logger } from '@vytches/ddd-logging';
import type { ILogger } from '@vytches/ddd-logging';

/**
 * @llm-summary EventReplayFactory class for event replay factory operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * EventReplayFactory class implementing infrastructure service for event replay factory operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EventReplayFactory();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new EventReplayFactory());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary create event replay factory function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * createEventReplayFactory function implementing infrastructure service for create event replay factory operations.
 *
 *
 * @param {IAdvancedEventStore} eventStore - eventStore parameter
 * @returns {IEventReplayFactory} Returns IEventReplayFactory
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = createEventReplayFactory(eventStore);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => createEventReplayFactory(eventStore));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function createEventReplayFactory(eventStore: IAdvancedEventStore): IEventReplayFactory {
  return new EventReplayFactory(eventStore);
}

/**
 * @llm-summary create event replay function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * createEventReplay function implementing infrastructure service for create event replay operations.
 *
 *
 * @param {IAdvancedEventStore} eventStore - eventStore parameter
 * @returns {IEventReplay} Returns IEventReplay
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = createEventReplay(eventStore);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => createEventReplay(eventStore));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function createEventReplay(eventStore: IAdvancedEventStore): IEventReplay {
  const factory = new EventReplayFactory(eventStore);
  return factory.createBasicReplay();
}

/**
 * @llm-summary create advanced event replay function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * createAdvancedEventReplay function implementing infrastructure service for create advanced event replay operations.
 *
 *
 * @param {IAdvancedEventStore} eventStore - eventStore parameter
 * @returns {IAdvancedEventReplay} Returns IAdvancedEventReplay
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = createAdvancedEventReplay(eventStore);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => createAdvancedEventReplay(eventStore));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function createAdvancedEventReplay(eventStore: IAdvancedEventStore): IAdvancedEventReplay {
  const factory = new EventReplayFactory(eventStore);
  return factory.createAdvancedReplay();
}
