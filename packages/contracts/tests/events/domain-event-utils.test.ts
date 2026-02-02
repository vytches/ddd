import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDomainEvent } from '../../src/events/domain-event-utils';

describe('createDomainEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create event with required fields', () => {
    const event = createDomainEvent('UserCreated', { name: 'John' });

    expect(event.eventName).toBe('UserCreated');
    expect(event.payload).toEqual({ name: 'John' });
  });

  it('should generate eventId automatically in metadata', () => {
    const event = createDomainEvent('TestEvent', {});

    expect(event.metadata).toBeDefined();
    expect(event.metadata!.eventId).toBeDefined();
    expect(typeof event.metadata!.eventId).toBe('string');
    expect(event.metadata!.eventId!.length).toBeGreaterThan(0);
  });

  it('should set timestamp in metadata to current time', () => {
    const event = createDomainEvent('TestEvent', {});

    expect(event.metadata!.timestamp).toEqual(new Date('2024-01-15T10:30:00.000Z'));
  });

  it('should include custom metadata when provided', () => {
    const event = createDomainEvent(
      'TestEvent',
      {},
      {
        correlationId: 'corr-123',
        causationId: 'cause-456',
      }
    );

    expect(event.metadata!.correlationId).toBe('corr-123');
    expect(event.metadata!.causationId).toBe('cause-456');
  });

  it('should create unique eventIds for multiple events', () => {
    const event1 = createDomainEvent('TestEvent', {});
    const event2 = createDomainEvent('TestEvent', {});

    expect(event1.metadata!.eventId).not.toBe(event2.metadata!.eventId);
  });

  it('should handle complex payload objects', () => {
    const complexPayload = {
      user: {
        id: '123',
        profile: {
          name: 'John',
          settings: {
            notifications: true,
          },
        },
      },
      items: [1, 2, 3],
    };

    const event = createDomainEvent('ComplexEvent', complexPayload);

    expect(event.payload).toEqual(complexPayload);
  });

  it('should handle empty payload', () => {
    const event = createDomainEvent('EmptyPayloadEvent', {});

    expect(event.payload).toEqual({});
  });

  it('should handle null payload', () => {
    const event = createDomainEvent('NullPayloadEvent', null);

    expect(event.payload).toBeNull();
  });

  it('should handle primitive payload', () => {
    const event = createDomainEvent('PrimitiveEvent', 'simple string');

    expect(event.payload).toBe('simple string');
  });

  it('should handle array payload', () => {
    const event = createDomainEvent('ArrayEvent', [1, 2, 3]);

    expect(event.payload).toEqual([1, 2, 3]);
  });

  it('should override default metadata with provided values', () => {
    const customEventId = 'custom-event-id';
    const event = createDomainEvent('TestEvent', {}, { eventId: customEventId });

    expect(event.metadata!.eventId).toBe(customEventId);
  });
});
