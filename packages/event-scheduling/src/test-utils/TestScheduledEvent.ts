import { ScheduledEvent } from '../core/ScheduledEvent';
import type { IScheduleOptions } from '@vytches-ddd/contracts';
import { BackoffStrategy } from '@vytches-ddd/contracts';

/**
 * @llm-summary TestScheduledEvent class for test scheduled event operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * TestScheduledEvent class implementing core domain functionality for test scheduled event operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TestScheduledEvent();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new TestScheduledEvent());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class TestScheduledEvent extends ScheduledEvent<{ message: string }> {
  constructor(
    aggregateId: string,
    scheduleAt: Date,
    message = 'Test message',
    scheduleOptions?: IScheduleOptions
  ) {
    super(aggregateId, scheduleAt, { message }, scheduleOptions);
  }
}

/**
 * @llm-summary FailingScheduledEvent class for failing scheduled event operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * FailingScheduledEvent class implementing core domain functionality for failing scheduled event operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new FailingScheduledEvent();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new FailingScheduledEvent());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class FailingScheduledEvent extends ScheduledEvent<{ message: string }> {
  constructor(
    aggregateId: string,
    scheduleAt: Date,
    message = 'Failing test message',
    scheduleOptions?: IScheduleOptions
  ) {
    super(aggregateId, scheduleAt, { message }, scheduleOptions);
  }
}

/**
 * @llm-summary SlowScheduledEvent class for slow scheduled event operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * SlowScheduledEvent class implementing core domain functionality for slow scheduled event operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SlowScheduledEvent();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SlowScheduledEvent());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SlowScheduledEvent extends ScheduledEvent<{ delay: number }> {
  constructor(
    aggregateId: string,
    scheduleAt: Date,
    delay = 1000,
    scheduleOptions?: IScheduleOptions
  ) {
    super(aggregateId, scheduleAt, { delay }, scheduleOptions);
  }
}

/**
 * @llm-summary TestEventFactory class for test event factory operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * TestEventFactory class implementing core domain functionality for test event factory operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TestEventFactory();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new TestEventFactory());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class TestEventFactory {
  /**
   * Create a test event scheduled for immediate execution
   */
  static immediate(aggregateId = 'test-aggregate', message = 'Test message'): TestScheduledEvent {
    return new TestScheduledEvent(aggregateId, new Date(), message);
  }

  /**
   * Create a test event scheduled for future execution
   */
  static delayed(
    delayMs: number,
    aggregateId = 'test-aggregate',
    message = 'Delayed test message'
  ): TestScheduledEvent {
    return new TestScheduledEvent(aggregateId, new Date(Date.now() + delayMs), message);
  }

  /**
   * Create a test event with retry configuration
   */
  static withRetry(
    aggregateId = 'test-aggregate',
    maxRetries = 3,
    backoff: BackoffStrategy = BackoffStrategy.EXPONENTIAL
  ): TestScheduledEvent {
    return new TestScheduledEvent(aggregateId, new Date(), 'Test with retry', {
      maxRetries,
      backoff,
    });
  }

  /**
   * Create a failing test event
   */
  static failing(aggregateId = 'test-aggregate'): FailingScheduledEvent {
    return new FailingScheduledEvent(aggregateId, new Date());
  }

  /**
   * Create a slow test event
   */
  static slow(delayMs = 1000, aggregateId = 'test-aggregate'): SlowScheduledEvent {
    return new SlowScheduledEvent(aggregateId, new Date(), delayMs);
  }
}
