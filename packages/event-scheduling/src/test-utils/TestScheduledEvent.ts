import { ScheduledEvent } from '../core/ScheduledEvent.js';
import type { IScheduleOptions } from '@vytches-ddd/contracts';
import { BackoffStrategy } from '@vytches-ddd/contracts';

/**
 * Test scheduled event for testing purposes
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
 * Test scheduled event that always fails
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
 * Test scheduled event with long processing time
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
 * Test helpers for creating scheduled events
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
    return new TestScheduledEvent(
      aggregateId,
      new Date(Date.now() + delayMs),
      message
    );
  }

  /**
   * Create a test event with retry configuration
   */
  static withRetry(
    aggregateId = 'test-aggregate',
    maxRetries = 3,
    backoff: BackoffStrategy = BackoffStrategy.EXPONENTIAL
  ): TestScheduledEvent {
    return new TestScheduledEvent(
      aggregateId,
      new Date(),
      'Test with retry',
      { maxRetries, backoff }
    );
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
  static slow(
    delayMs = 1000,
    aggregateId = 'test-aggregate'
  ): SlowScheduledEvent {
    return new SlowScheduledEvent(aggregateId, new Date(), delayMs);
  }
}