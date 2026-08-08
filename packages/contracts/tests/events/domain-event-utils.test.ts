import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDomainEvent, enrichEvent } from '../../src/events/domain-event-utils';

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

  it('exposes eventId and occurredOn at the top level, mirroring metadata', () => {
    // Class based events carry these directly; code that handles both shapes
    // should not have to know which one it was handed.
    const event = createDomainEvent('TestEvent', {});

    expect(event.eventId).toBe(event.metadata!.eventId);
    expect(event.occurredOn).toEqual(event.metadata!.timestamp);
    expect(event.occurredOn).toEqual(new Date('2024-01-15T10:30:00.000Z'));
  });
});

describe('enrichEvent', () => {
  it('replaces the payload while keeping identity', () => {
    const original = createDomainEvent('UserRegistered', { email: 'someone@example.test' });

    const enriched = enrichEvent(original, { payload: { email: '<encrypted>' } });

    expect(enriched.payload).toEqual({ email: '<encrypted>' });
    expect(enriched.eventId).toBe(original.eventId);
    expect(enriched.occurredOn).toBe(original.occurredOn);
    expect(enriched.eventName).toBe('UserRegistered');
  });

  it('merges metadata without dropping what was already there', () => {
    const original = createDomainEvent('UserRegistered', {}, { correlationId: 'corr-1' });

    const enriched = enrichEvent(original, { metadata: { userSpecificKeyId: 'key-42' } });

    expect(enriched.metadata).toMatchObject({
      correlationId: 'corr-1',
      userSpecificKeyId: 'key-42',
    });
    expect(enriched.metadata!.eventId).toBe(original.metadata!.eventId);
  });

  it('leaves the original untouched', () => {
    const original = createDomainEvent('UserRegistered', { email: 'someone@example.test' });

    enrichEvent(original, { payload: { email: '<encrypted>' } });

    expect(original.payload).toEqual({ email: 'someone@example.test' });
  });

  it('accepts a frozen event and returns a mutable copy', () => {
    // getDomainEvents() hands out deep frozen events.
    const original = Object.freeze(createDomainEvent('UserRegistered', { email: 'a@b.test' }));

    const enriched = enrichEvent(original, { metadata: { userSpecificKeyId: 'key-42' } });

    expect(Object.isFrozen(enriched)).toBe(false);
    expect(enriched.metadata!.userSpecificKeyId).toBe('key-42');
  });

  it('preserves the prototype so instanceof keeps working', () => {
    class UserRegistered {
      readonly eventName = 'UserRegistered';
      constructor(
        public readonly payload: { email: string },
        public readonly eventId = 'fixed-id'
      ) {}
    }

    const original = new UserRegistered({ email: 'someone@example.test' });

    const enriched = enrichEvent(original, { payload: { email: '<encrypted>' } });

    expect(enriched).toBeInstanceOf(UserRegistered);
    expect(enriched.eventId).toBe('fixed-id');
    expect(enriched.payload).toEqual({ email: '<encrypted>' });
  });

  it('does not call the event constructor, so custom signatures are safe', () => {
    let constructorCalls = 0;

    class OrderPlaced {
      readonly eventName = 'OrderPlaced';
      readonly payload: { orderId: string; total: number };
      constructor(orderId: string, total: number) {
        constructorCalls++;
        this.payload = { orderId, total };
      }
    }

    const original = new OrderPlaced('order-1', 100);
    constructorCalls = 0;

    const enriched = enrichEvent(original, { metadata: { userSpecificKeyId: 'key-42' } });

    expect(constructorCalls).toBe(0);
    expect(enriched.payload).toEqual({ orderId: 'order-1', total: 100 });
  });
});
