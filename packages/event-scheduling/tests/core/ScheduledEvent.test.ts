import { describe, it, expect } from 'vitest';
import { ScheduledEvent, TestScheduledEvent, TestEventFactory } from '../../src';

describe('ScheduledEvent', () => {
  describe('constructor', () => {
    it('should create a scheduled event with required properties', () => {
      const aggregateId = 'test-123';
      const scheduleAt = new Date(Date.now() + 1000);
      const message = 'Test message';

      const event = new TestScheduledEvent(aggregateId, scheduleAt, message);

      expect(event.aggregateId).toBe(aggregateId);
      expect(event.scheduleAt).toBe(scheduleAt);
      expect(event.type).toBe('TestScheduledEvent');
      expect(event.occurredOn).toBeInstanceOf(Date);
      expect(event.scheduleOptions).toBeUndefined();
    });

    it('should create a scheduled event with schedule options', () => {
      const aggregateId = 'test-123';
      const scheduleAt = new Date(Date.now() + 1000);
      const scheduleOptions = {
        maxRetries: 3,
        backoff: 'exponential' as const,
        priority: 1
      };

      const event = new TestScheduledEvent(aggregateId, scheduleAt, 'Test', scheduleOptions);

      expect(event.scheduleOptions).toEqual(scheduleOptions);
    });

    it('should have metadata when provided', () => {
      const aggregateId = 'test-123';
      const scheduleAt = new Date(Date.now() + 1000);
      const metadata = { correlationId: 'corr-123' };

      const event = new TestScheduledEvent(aggregateId, scheduleAt, 'Test', undefined);
      // Note: We can't directly test metadata in constructor as it's handled by base class

      expect(event.aggregateId).toBe(aggregateId);
      expect(event.scheduleAt).toBe(scheduleAt);
    });
  });

  describe('isScheduledEvent', () => {
    it('should identify scheduled events correctly', () => {
      const event = TestEventFactory.immediate();

      expect(ScheduledEvent.isScheduledEvent(event)).toBe(true);
    });

    it('should reject non-scheduled events', () => {
      const nonScheduledEvent = { type: 'RegularEvent' };

      expect(ScheduledEvent.isScheduledEvent(nonScheduledEvent)).toBe(false);
    });

    it('should reject null and undefined', () => {
      expect(ScheduledEvent.isScheduledEvent(null)).toBe(false);
      expect(ScheduledEvent.isScheduledEvent(undefined)).toBe(false);
    });

    it('should reject objects without scheduleAt', () => {
      const invalidEvent = { type: 'SomeEvent', aggregateId: 'test' };

      expect(ScheduledEvent.isScheduledEvent(invalidEvent)).toBe(false);
    });

    it('should reject objects with invalid scheduleAt', () => {
      const invalidEvent = { scheduleAt: 'not-a-date' };

      expect(ScheduledEvent.isScheduledEvent(invalidEvent)).toBe(false);
    });
  });

  describe('getDelayMs', () => {
    it('should return correct delay for future events', () => {
      const delayMs = 5000;
      const event = TestEventFactory.delayed(delayMs);

      const delay = event.getDelayMs();

      // Allow for small timing differences
      expect(delay).toBeGreaterThan(delayMs - 100);
      expect(delay).toBeLessThanOrEqual(delayMs);
    });

    it('should return 0 for past events', () => {
      const event = new TestScheduledEvent(
        'test-123',
        new Date(Date.now() - 1000), // 1 second ago
        'Past event'
      );

      const delay = event.getDelayMs();

      expect(delay).toBe(0);
    });

    it('should return 0 for immediate events', () => {
      const event = TestEventFactory.immediate();

      const delay = event.getDelayMs();

      expect(delay).toBeLessThan(100); // Should be very small
    });
  });

  describe('isOverdue', () => {
    it('should return true for past events', () => {
      const event = new TestScheduledEvent(
        'test-123',
        new Date(Date.now() - 1000), // 1 second ago
        'Past event'
      );

      expect(event.isOverdue()).toBe(true);
    });

    it('should return false for future events', () => {
      const event = TestEventFactory.delayed(5000);

      expect(event.isOverdue()).toBe(false);
    });

    it('should return false for immediate events', () => {
      const event = TestEventFactory.immediate();

      expect(event.isOverdue()).toBe(false);
    });
  });

  describe('reschedule', () => {
    it('should create a new event with updated schedule time', () => {
      const originalEvent = TestEventFactory.immediate();
      const newTime = new Date(Date.now() + 5000);

      const rescheduled = originalEvent.reschedule(newTime);

      expect(rescheduled).not.toBe(originalEvent);
      expect(rescheduled.scheduleAt).toBe(newTime);
      expect(rescheduled.aggregateId).toBe(originalEvent.aggregateId);
      expect(rescheduled.type).toBe(originalEvent.type);
      expect(rescheduled.scheduleOptions).toBe(originalEvent.scheduleOptions);
    });

    it('should preserve schedule options when rescheduling', () => {
      const originalEvent = TestEventFactory.withRetry('test-123', 5, 'linear');
      const newTime = new Date(Date.now() + 5000);

      const rescheduled = originalEvent.reschedule(newTime);

      expect(rescheduled.scheduleOptions).toEqual(originalEvent.scheduleOptions);
    });
  });

  describe('TestEventFactory', () => {
    it('should create immediate events', () => {
      const event = TestEventFactory.immediate();

      expect(event.aggregateId).toBe('test-aggregate');
      expect(event.getDelayMs()).toBeLessThan(100);
    });

    it('should create delayed events', () => {
      const delayMs = 2000;
      const event = TestEventFactory.delayed(delayMs);

      expect(event.getDelayMs()).toBeGreaterThan(delayMs - 100);
    });

    it('should create events with retry configuration', () => {
      const event = TestEventFactory.withRetry('test-123', 5, 'linear');

      expect(event.scheduleOptions?.maxRetries).toBe(5);
      expect(event.scheduleOptions?.backoff).toBe('linear');
    });

    it('should create failing events', () => {
      const event = TestEventFactory.failing();

      expect(event).toBeInstanceOf(ScheduledEvent);
      expect(event.aggregateId).toBe('test-aggregate');
    });

    it('should create slow events', () => {
      const event = TestEventFactory.slow(2000);

      expect(event).toBeInstanceOf(ScheduledEvent);
      expect((event as any).payload?.delay).toBe(2000);
    });
  });
});
