import { describe, it, expect } from 'vitest';
import type { IEventMetadata } from '@vytches/ddd-contracts';
import { DomainEvent } from '../src/domain/domain-event';

// Test event classes
class UserCreatedEvent extends DomainEvent<{ userId: string; email: string }> {
  constructor(
    payload: { userId: string; email: string },
    metadata?: IEventMetadata,
    eventName?: string
  ) {
    super(payload, metadata, eventName);
  }
}

class OrderPlacedEvent extends DomainEvent<{ orderId: string; amount: number }> {}

describe('DomainEvent', () => {
  describe('Event Type Handling', () => {
    it('should use constructor name as default eventName', () => {
      const event = new UserCreatedEvent({
        userId: 'user-123',
        email: 'test@example.com',
      });

      expect(event.eventName).toBe('UserCreatedEvent');
      expect(event.eventName).toBe(event.constructor.name);
    });

    it('should allow custom eventName override', () => {
      const event = new UserCreatedEvent(
        {
          userId: 'user-123',
          email: 'test@example.com',
        },
        undefined,
        'UserCreated'
      );

      expect(event.eventName).toBe('UserCreated');
      expect(event.eventName).not.toBe(event.constructor.name);
    });

    it('should preserve custom eventName when using withMetadata', () => {
      const originalEvent = new UserCreatedEvent(
        {
          userId: 'user-123',
          email: 'test@example.com',
        },
        { contextId: 'user-context' },
        'UserCreated'
      );

      const clonedEvent = originalEvent.withMetadata({
        correlationId: 'corr-456',
      });

      expect(clonedEvent.eventName).toBe('UserCreated');
      expect(clonedEvent.eventName).toBe(originalEvent.eventName);
      expect(clonedEvent.metadata?.correlationId).toBe('corr-456');
      expect(clonedEvent.metadata?.contextId).toBe('user-context');
    });

    it('should preserve default constructor.name when using withMetadata', () => {
      const originalEvent = new OrderPlacedEvent({
        orderId: 'order-123',
        amount: 100,
      });

      const clonedEvent = originalEvent.withMetadata({
        correlationId: 'corr-789',
      });

      expect(clonedEvent.eventName).toBe('OrderPlacedEvent');
      expect(clonedEvent.eventName).toBe(originalEvent.eventName);
      expect(clonedEvent.metadata?.correlationId).toBe('corr-789');
    });

    it('should handle empty string as custom eventName', () => {
      const event = new UserCreatedEvent(
        {
          userId: 'user-123',
          email: 'test@example.com',
        },
        undefined,
        ''
      );

      // Empty string is a valid explicit value, so it should be used
      expect(event.eventName).toBe('');
    });

    it('should handle undefined eventName parameter', () => {
      const event = new UserCreatedEvent(
        {
          userId: 'user-123',
          email: 'test@example.com',
        },
        undefined,
        undefined
      );

      expect(event.eventName).toBe('UserCreatedEvent');
    });
  });

  describe('Event Properties', () => {
    it('should generate unique event IDs', () => {
      const event1 = new UserCreatedEvent({
        userId: 'user-123',
        email: 'test@example.com',
      });

      const event2 = new UserCreatedEvent({
        userId: 'user-456',
        email: 'test2@example.com',
      });

      expect(event1.eventId).toBeDefined();
      expect(event2.eventId).toBeDefined();
      expect(event1.eventId).not.toBe(event2.eventId);
    });

    it('should set occurredOn timestamp', () => {
      const before = new Date();
      const event = new UserCreatedEvent({
        userId: 'user-123',
        email: 'test@example.com',
      });
      const after = new Date();

      expect(event.occurredOn).toBeInstanceOf(Date);
      expect(event.occurredOn.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(event.occurredOn.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should include payload', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
      };

      const event = new UserCreatedEvent(payload);

      expect(event.payload).toEqual(payload);
    });

    it('should include metadata', () => {
      const metadata = {
        contextId: 'user-context',
        correlationId: 'corr-123',
      };

      const event = new UserCreatedEvent(
        {
          userId: 'user-123',
          email: 'test@example.com',
        },
        metadata
      );

      expect(event.metadata?.contextId).toBe('user-context');
      expect(event.metadata?.correlationId).toBe('corr-123');
      expect(event.metadata?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with existing code that does not use eventName parameter', () => {
      const event = new UserCreatedEvent({
        userId: 'user-123',
        email: 'test@example.com',
      });

      expect(event.eventName).toBe('UserCreatedEvent');
      expect(event.payload?.userId).toBe('user-123');
    });

    it('should work with events that only pass payload and metadata', () => {
      const event = new UserCreatedEvent(
        {
          userId: 'user-123',
          email: 'test@example.com',
        },
        { contextId: 'user-context' }
      );

      expect(event.eventName).toBe('UserCreatedEvent');
      expect(event.metadata?.contextId).toBe('user-context');
    });
  });

  describe('Real-World Usage Scenarios', () => {
    it('should support event versioning with custom eventName', () => {
      // V1 event
      const eventV1 = new UserCreatedEvent(
        {
          userId: 'user-123',
          email: 'test@example.com',
        },
        { eventVersion: 1 },
        'user.created'
      );

      // V2 event
      const eventV2 = new UserCreatedEvent(
        {
          userId: 'user-456',
          email: 'test2@example.com',
        },
        { eventVersion: 2 },
        'user.created.v2'
      );

      expect(eventV1.eventName).toBe('user.created');
      expect(eventV2.eventName).toBe('user.created.v2');
      expect(eventV1.metadata?.eventVersion).toBe(1);
      expect(eventV2.metadata?.eventVersion).toBe(2);
    });

    it('should support namespaced event types', () => {
      const event = new UserCreatedEvent(
        {
          userId: 'user-123',
          email: 'test@example.com',
        },
        undefined,
        'auth.user.created'
      );

      expect(event.eventName).toBe('auth.user.created');
    });

    it('should support short event names', () => {
      const event = new UserCreatedEvent(
        {
          userId: 'user-123',
          email: 'test@example.com',
        },
        undefined,
        'UserCreated'
      );

      expect(event.eventName).toBe('UserCreated');
    });
  });
});
