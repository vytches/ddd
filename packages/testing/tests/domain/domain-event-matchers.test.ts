import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DomainEventMatchers,
  createDomainEventMatchers,
  assertEvent,
  assertEventWithPayload,
  assertEventSequence,
  type EventPattern,
  type EventMatchingContext
} from '../../src';
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

describe('DomainEventMatchers', () => {
  let matcher: DomainEventMatchers;
  let mockEvents: IExtendedDomainEvent[];

  beforeEach(() => {
    matcher = new DomainEventMatchers();

    // Create comprehensive mock events for testing
    mockEvents = [
      {
        eventType: 'OrderCreated',
        payload: {
          orderId: 'order-123',
          customerId: 'customer-456',
          amount: 100,
          items: [{ productId: 'product-1', quantity: 2 }]
        },
        metadata: {
          timestamp: new Date('2023-01-01T10:00:00Z'),
          version: 1,
          eventId: 'event-1',
          correlationId: 'corr-123',
          causationId: 'cause-123',
          aggregateId: 'order-123',
          aggregateType: 'Order',
          aggregateVersion: 1,
          userId: 'user-1',
          sessionId: 'session-1'
        }
      },
      {
        eventType: 'PaymentProcessed',
        payload: {
          orderId: 'order-123',
          paymentId: 'payment-789',
          amount: 100,
          method: 'credit_card'
        },
        metadata: {
          timestamp: new Date('2023-01-01T10:05:00Z'),
          version: 1,
          eventId: 'event-2',
          correlationId: 'corr-123',
          causationId: 'cause-124',
          aggregateId: 'order-123',
          aggregateType: 'Order',
          aggregateVersion: 2,
          userId: 'user-1',
          sessionId: 'session-1'
        }
      },
      {
        eventType: 'OrderShipped',
        payload: {
          orderId: 'order-123',
          trackingNumber: 'track-456',
          carrier: 'UPS'
        },
        metadata: {
          timestamp: new Date('2023-01-01T10:10:00Z'),
          version: 1,
          eventId: 'event-3',
          correlationId: 'corr-123',
          causationId: 'cause-125',
          aggregateId: 'order-123',
          aggregateType: 'Order',
          aggregateVersion: 3,
          userId: 'user-1',
          sessionId: 'session-1'
        }
      },
      {
        eventType: 'InventoryUpdated',
        payload: {
          productId: 'product-1',
          previousQuantity: 100,
          newQuantity: 98,
          reason: 'order_fulfillment'
        },
        metadata: {
          timestamp: new Date('2023-01-01T10:15:00Z'),
          version: 1,
          eventId: 'event-4',
          correlationId: 'corr-456',
          causationId: 'cause-126',
          aggregateId: 'product-1',
          aggregateType: 'Product',
          aggregateVersion: 15,
          userId: 'system',
          sessionId: 'system-session'
        }
      }
    ];
  });

  describe('Basic Event Matching', () => {
    it('should find event by type', () => {
      // Act
      const result = matcher.hasEvent(mockEvents, 'OrderCreated');

      // Assert
      expect(result).toBe(true);
    });

    it('should not find non-existent event type', () => {
      // Act
      const result = matcher.hasEvent(mockEvents, 'NonExistentEvent');

      // Assert
      expect(result).toBe(false);
    });

    it('should find event with case sensitivity options', () => {
      // Act
      const resultCaseSensitive = matcher.hasEvent(mockEvents, 'ordercreated', { caseSensitive: false });
      const resultCaseExact = matcher.hasEvent(mockEvents, 'ordercreated', { caseSensitive: true });

      // Assert
      expect(resultCaseSensitive).toBe(true);
      expect(resultCaseExact).toBe(false);
    });

    it('should find event with partial type matching', () => {
      // Act
      const result = matcher.hasEvent(mockEvents, 'Order', { exactType: false });

      // Assert
      expect(result).toBe(true);
    });

    it('should return detailed event match result', () => {
      // Act
      const result = matcher.findEvent(mockEvents, 'OrderCreated');

      // Assert
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.matchedEvent).toBeDefined();
      expect(result.matchedEvent?.eventType).toBe('OrderCreated');
      expect(result.context).toEqual({ index: 0, totalEvents: 4 });
    });

    it('should return failure result for non-matching event', () => {
      // Act
      const result = matcher.findEvent(mockEvents, 'NonExistentEvent');

      // Assert
      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reason).toContain('No event of type \'NonExistentEvent\' found');
      expect(result.matchedEvent).toBeUndefined();
    });

    it('should find all events of specific type', () => {
      // Arrange - add another OrderCreated event
      const additionalEvent: IExtendedDomainEvent = {
        ...mockEvents[0],
        eventType: 'OrderCreated',
        metadata: {
          ...mockEvents?.[0]?.metadata,
          eventId: 'event-5',
          timestamp: new Date('2023-01-01T10:20:00Z')
        },
        payload: { ...mockEvents?.[0]?.payload, orderId: 'order-456' }
      };
      const eventsWithDuplicate = [...mockEvents, additionalEvent];

      // Act
      const foundEvents = matcher.findAllEvents(eventsWithDuplicate, 'OrderCreated');

      // Assert
      expect(foundEvents).toHaveLength(2);
      expect(foundEvents.map(e => e?.metadata?.eventId)).toEqual(['event-1', 'event-5']);
    });

    it('should count events of specific type', () => {
      // Act
      const count = matcher.countEvents(mockEvents, 'OrderCreated');

      // Assert
      expect(count).toBe(1);
    });

    it('should use custom matcher function', () => {
      // Arrange
      const customMatcher = vi.fn((event: IExtendedDomainEvent) =>
        event.payload.amount > 50
      );

      // Act
      const result = matcher.hasEvent(mockEvents, 'OrderCreated', { customMatcher });

      // Assert
      expect(result).toBe(true);
      expect(customMatcher).toHaveBeenCalledWith(mockEvents[0]);
    });
  });

  describe('Payload Matching', () => {
    it('should match event with exact payload', () => {
      // Arrange
      const expectedPayload = {
        orderId: 'order-123',
        customerId: 'customer-456',
        amount: 100,
        items: [{ productId: 'product-1', quantity: 2 }]
      };

      // Act
      const result = matcher.hasEventWithPayload(mockEvents, 'OrderCreated', expectedPayload);

      // Assert
      expect(result).toBe(true);
    });

    it('should match event with partial payload', () => {
      // Arrange
      const partialPayload = { orderId: 'order-123', amount: 100 };

      // Act
      const result = matcher.hasEventWithPayload(mockEvents, 'OrderCreated', partialPayload, {
        partialPayload: true
      });

      // Assert
      expect(result).toBe(true);
    });

    it('should not match event with incorrect payload', () => {
      // Arrange
      const incorrectPayload = { orderId: 'wrong-order', amount: 100 };

      // Act
      const result = matcher.hasEventWithPayload(mockEvents, 'OrderCreated', incorrectPayload);

      // Assert
      expect(result).toBe(false);
    });

    it('should ignore specified fields in payload comparison', () => {
      // Arrange
      const payloadWithIgnoredField = {
        orderId: 'different-order', // This should be ignored
        amount: 100
      };

      // Act
      const result = matcher.hasEventWithPayload(mockEvents, 'OrderCreated', payloadWithIgnoredField, {
        partialPayload: true,
        ignoreFields: ['orderId']
      });

      // Assert
      expect(result).toBe(true);
    });

    it('should return detailed payload match result', () => {
      // Arrange
      const expectedPayload = { orderId: 'order-123' };

      // Act
      const result = matcher.findEventWithPayload(mockEvents, 'OrderCreated', expectedPayload, {
        partialPayload: true
      });

      // Assert
      expect(result.matches).toBe(true);
      expect(result.matchedEvent?.eventType).toBe('OrderCreated');
      expect(result.context).toEqual({ index: 0, totalEvents: 4 });
    });

    it('should validate payload structure', () => {
      // Arrange
      const actualPayload = { orderId: 'order-123', amount: 100 };
      const expectedStructure = { orderId: 'order-123', amount: 100 };

      // Act
      const result = matcher.validatePayloadStructure(actualPayload, expectedStructure);

      // Assert
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
    });

    it('should handle payload validation errors', () => {
      // Arrange
      const invalidPayload = null;
      const expectedStructure = { orderId: 'string' };

      // Act
      const result = matcher.validatePayloadStructure(invalidPayload, expectedStructure);

      // Assert
      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
      expect(result.reason).toContain('Payload structure mismatch');
    });
  });

  describe('Pattern Matching', () => {
    it('should match simple event pattern', () => {
      // Arrange
      const pattern: EventPattern = {
        name: 'Order Creation Pattern',
        eventType: 'OrderCreated',
        payload: { orderId: 'order-123' }
      };

      // Act
      const result = matcher.matchesPattern(mockEvents, pattern);

      // Assert
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.matchedEvent?.eventType).toBe('OrderCreated');
    });

    it('should match regex event pattern', () => {
      // Arrange
      const pattern: EventPattern = {
        name: 'Order Events Pattern',
        eventType: /Order(Created|Shipped)/
      };

      // Act
      const result = matcher.matchesPattern(mockEvents, pattern);

      // Assert
      expect(result.matches).toBe(true);
      expect(result.matchedEvent?.eventType).toBe('OrderCreated');
    });

    it('should match pattern with metadata constraints', () => {
      // Arrange
      const pattern: EventPattern = {
        name: 'Order with User Pattern',
        eventType: 'OrderCreated',
        metadata: { userId: 'user-1', aggregateType: 'Order' }
      };

      // Act
      const result = matcher.matchesPattern(mockEvents, pattern);

      // Assert
      expect(result.matches).toBe(true);
    });

    it('should match pattern with order constraints', () => {
      // Arrange
      const pattern: EventPattern = {
        name: 'Payment After Order Pattern',
        eventType: 'PaymentProcessed',
        order: {
          after: ['OrderCreated']
        }
      };

      // Act
      const result = matcher.matchesPattern(mockEvents, pattern);

      // Assert
      expect(result.matches).toBe(true);
    });

    it('should match pattern with position constraint', () => {
      // Arrange
      const pattern: EventPattern = {
        name: 'First Event Pattern',
        eventType: 'OrderCreated',
        order: { position: 0 }
      };

      // Act
      const result = matcher.matchesPattern(mockEvents, pattern);

      // Assert
      expect(result.matches).toBe(true);
    });

    it('should match pattern with timing constraints', () => {
      // Arrange
      const pattern: EventPattern = {
        name: 'Payment Timing Pattern',
        eventType: 'PaymentProcessed',
        timing: {
          timeWindow: {
            start: new Date('2023-01-01T09:00:00Z'),
            end: new Date('2023-01-01T11:00:00Z')
          }
        }
      };

      // Act
      const result = matcher.matchesPattern(mockEvents, pattern);

      // Assert
      expect(result.matches).toBe(true);
    });

    it('should match pattern with custom validator', () => {
      // Arrange
      const customValidator = vi.fn((event: IExtendedDomainEvent, context: EventMatchingContext) => {
        return event.payload.amount > 50;
      });

      const pattern: EventPattern = {
        name: 'High Value Order Pattern',
        eventType: 'OrderCreated',
        validator: customValidator
      };

      // Act
      const result = matcher.matchesPattern(mockEvents, pattern);

      // Assert
      expect(result.matches).toBe(true);
      expect(customValidator).toHaveBeenCalled();
    });

    it('should not match pattern when constraints are not met', () => {
      // Arrange
      const pattern: EventPattern = {
        name: 'Impossible Pattern',
        eventType: 'NonExistentEvent',
        order: { position: 5 } // Position doesn't exist
      };

      // Act
      const result = matcher.matchesPattern(mockEvents, pattern);

      // Assert
      expect(result.matches).toBe(false);
      expect(result.reason).toContain('No event matching pattern');
    });

    it('should find all events matching pattern', () => {
      // Arrange
      const pattern: EventPattern = {
        name: 'Order Events',
        eventType: /^Order(Created|Shipped)$/
      };

      // Act
      const matchedEvents = matcher.findEventsByPattern(mockEvents, pattern);

      // Assert
      expect(matchedEvents).toHaveLength(2);
      expect(matchedEvents.map(e => e.eventType)).toEqual(['OrderCreated', 'OrderShipped']);
    });
  });

  describe('Sequence Matching', () => {
    it('should match simple event sequence', () => {
      // Arrange
      const expectedSequence = ['OrderCreated', 'PaymentProcessed', 'OrderShipped'];

      // Act
      const result = matcher.hasEventSequence(mockEvents, expectedSequence);

      // Assert
      expect(result).toBe(true);
    });

    it('should match partial sequence in non-strict mode', () => {
      // Arrange
      const expectedSequence = ['OrderCreated', 'OrderShipped'];

      // Act
      const result = matcher.hasEventSequence(mockEvents, expectedSequence, false);

      // Assert
      expect(result).toBe(true);
    });

    it('should not match sequence in strict mode with gaps', () => {
      // Arrange
      const expectedSequence = ['OrderCreated', 'OrderShipped']; // Missing PaymentProcessed

      // Act
      const result = matcher.hasEventSequence(mockEvents, expectedSequence, true);

      // Assert
      expect(result).toBe(false);
    });

    it('should return detailed sequence match result', () => {
      // Arrange
      const expectedSequence = ['OrderCreated', 'PaymentProcessed'];

      // Act
      const result = matcher.findEventSequence(mockEvents, expectedSequence);

      // Assert
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.context).toEqual({
        matchedIndices: [0, 1],
        strict: false
      });
    });

    it('should handle empty sequence', () => {
      // Act
      const result = matcher.findEventSequence(mockEvents, []);

      // Assert
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
    });

    it('should handle sequence longer than available events', () => {
      // Arrange
      const longSequence = ['OrderCreated', 'PaymentProcessed', 'OrderShipped', 'OrderDelivered', 'OrderCompleted'];

      // Act
      const result = matcher.findEventSequence(mockEvents, longSequence);

      // Assert
      expect(result.matches).toBe(false);
      expect(result.reason).toContain('Not enough events');
    });

    it('should validate complex event flow with multiple patterns', () => {
      // Arrange
      const patterns: EventPattern[] = [
        {
          name: 'Order Created',
          eventType: 'OrderCreated'
        },
        {
          name: 'Payment Processed',
          eventType: 'PaymentProcessed',
          order: { after: ['OrderCreated'] }
        }
      ];

      // Act
      const result = matcher.validateEventFlow(mockEvents, patterns);

      // Assert
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
      expect(result.context?.patterns).toEqual(['Order Created', 'Payment Processed']);
    });
  });

  describe('Temporal Analysis', () => {
    it('should filter events within time window', () => {
      // Arrange
      const startTime = new Date('2023-01-01T10:00:00Z');
      const endTime = new Date('2023-01-01T10:05:00Z');

      // Act
      const filteredEvents = matcher.eventsWithinTimeWindow(mockEvents, startTime, endTime);

      // Assert
      expect(filteredEvents).toHaveLength(2); // OrderCreated and PaymentProcessed
      expect(filteredEvents.map(e => e.eventType)).toEqual(['OrderCreated', 'PaymentProcessed']);
    });

    it('should analyze event timing correctly', () => {
      // Act
      const analysis = matcher.analyzeEventTiming(mockEvents);

      // Assert
      expect(analysis.totalDuration).toBe(15 * 60 * 1000); // 15 minutes in milliseconds
      expect(analysis.eventIntervals).toHaveLength(3);
      expect(analysis.averageInterval).toBe(5 * 60 * 1000); // 5 minutes average
      expect(analysis.timeline).toHaveLength(4);
      expect(analysis.timeline?.[0]?.intervalFromPrevious).toBeUndefined();
      expect(analysis.timeline?.[1]?.intervalFromPrevious).toBe(5 * 60 * 1000);
    });

    it('should handle empty events for timing analysis', () => {
      // Act
      const analysis = matcher.analyzeEventTiming([]);

      // Assert
      expect(analysis.totalDuration).toBe(0);
      expect(analysis.averageInterval).toBe(0);
      expect(analysis.eventIntervals).toHaveLength(0);
      expect(analysis.timeline).toHaveLength(0);
    });

    it('should check if events are within time difference', () => {
      // Arrange
      const event1 = mockEvents[0]; // 10:00:00
      const event2 = mockEvents[1]; // 10:05:00

      // Act
      const within5Minutes = matcher.eventsWithinTimeDifference(event1!, event2!, 5 * 60 * 1000);
      const within2Minutes = matcher.eventsWithinTimeDifference(event1!, event2!, 2 * 60 * 1000);

      // Assert
      expect(within5Minutes).toBe(true);
      expect(within2Minutes).toBe(false);
    });
  });

  describe('Metadata Analysis', () => {
    it('should find events by metadata query', () => {
      // Arrange
      const metadataQuery = { userId: 'user-1', aggregateType: 'Order' };

      // Act
      const foundEvents = matcher.findEventsByMetadata(mockEvents, metadataQuery);

      // Assert
      expect(foundEvents).toHaveLength(3); // First 3 events match
      expect(foundEvents.map(e => e.eventType)).toEqual(['OrderCreated', 'PaymentProcessed', 'OrderShipped']);
    });

    it('should group events by metadata field', () => {
      // Act
      const groups = matcher.groupEventsByMetadata(mockEvents, 'aggregateType');

      // Assert
      expect(groups.size).toBe(2);
      expect(groups.get('Order')).toHaveLength(3);
      expect(groups.get('Product')).toHaveLength(1);
    });

    it('should analyze event correlation and causation', () => {
      // Act
      const analysis = matcher.analyzeEventCorrelation(mockEvents);

      // Assert
      expect(analysis.correlationGroups.size).toBe(2);
      expect(analysis.correlationGroups.get('corr-123')).toHaveLength(3);
      expect(analysis.correlationGroups.get('corr-456')).toHaveLength(1);
      expect(analysis.causationChains).toHaveLength(2);
      expect(analysis.orphanedEvents).toHaveLength(0);
    });

    it('should handle events without correlation IDs', () => {
      // Arrange
      const eventsWithoutCorrelation = [
        {
          ...mockEvents[0],
          metadata: { ...mockEvents?.[0]?.metadata, correlationId: undefined as unknown as string }
        }
      ];

      // Act
      const analysis = matcher.analyzeEventCorrelation(eventsWithoutCorrelation as any);

      // Assert
      expect(analysis.correlationGroups.size).toBe(0);
      expect(analysis.orphanedEvents).toHaveLength(1);
    });
  });

  describe('Aggregate-Aware Matching', () => {
    it('should find events for specific aggregate', () => {
      // Act
      const aggregateEvents = matcher.findEventsForAggregate(mockEvents, 'order-123');

      // Assert
      expect(aggregateEvents).toHaveLength(3);
      expect(aggregateEvents.map(e => e.eventType)).toEqual(['OrderCreated', 'PaymentProcessed', 'OrderShipped']);
    });

    it('should validate aggregate event sequence', () => {
      // Arrange
      const expectedSequence = ['OrderCreated', 'PaymentProcessed', 'OrderShipped'];

      // Act
      const result = matcher.validateAggregateEventSequence(mockEvents, 'order-123', expectedSequence);

      // Assert
      expect(result.matches).toBe(true);
      expect(result.score).toBe(1);
    });

    it('should analyze aggregate version progression', () => {
      // Act
      const analysis = matcher.analyzeAggregateVersions(mockEvents, 'order-123');

      // Assert
      expect(analysis.versions).toEqual([1, 2, 3]);
      expect(analysis.isSequential).toBe(true);
      expect(analysis.gaps).toHaveLength(0);
      expect(analysis.duplicates).toHaveLength(0);
    });

    it('should detect version gaps in aggregate', () => {
      // Arrange
      const eventsWithGaps = [
        mockEvents[0], // version 1
        { ...mockEvents[1], metadata: { ...mockEvents?.[1]?.metadata, aggregateVersion: 5 } } // version 5 (gap)
      ] as any[];

      // Act
      const analysis = matcher.analyzeAggregateVersions(eventsWithGaps, 'order-123');

      // Assert
      expect(analysis.isSequential).toBe(false);
      expect(analysis.gaps).toEqual([2, 3, 4]);
    });

    it('should detect duplicate versions in aggregate', () => {
      // Arrange
      const eventsWithDuplicates = [
        mockEvents[0], // version 1
        { ...mockEvents[1], metadata: { ...mockEvents?.[1]?.metadata, aggregateVersion: 1 } } // duplicate version 1
      ] as any[];

      // Act
      const analysis = matcher.analyzeAggregateVersions(eventsWithDuplicates, 'order-123');

      // Assert
      expect(analysis.duplicates).toEqual([1]);
    });
  });

  describe('Factory Functions and Convenience Methods', () => {
    it('should create domain event matchers using factory', () => {
      // Act
      const factoryMatcher = createDomainEventMatchers();

      // Assert
      expect(factoryMatcher).toBeInstanceOf(DomainEventMatchers);
    });

    it('should assert event existence', () => {
      // Act & Assert
      expect(() => assertEvent(mockEvents, 'OrderCreated')).not.toThrow();
      expect(() => assertEvent(mockEvents, 'NonExistentEvent')).toThrow('Event assertion failed');
    });

    it('should assert event with payload', () => {
      // Arrange
      const expectedPayload = { orderId: 'order-123' };

      // Act & Assert
      expect(() => assertEventWithPayload(mockEvents, 'OrderCreated', expectedPayload, { partialPayload: true })).not.toThrow();
      expect(() => assertEventWithPayload(mockEvents, 'OrderCreated', { orderId: 'wrong-order' })).toThrow('Event payload assertion failed');
    });

    it('should assert event sequence', () => {
      // Arrange
      const expectedSequence = ['OrderCreated', 'PaymentProcessed'];

      // Act & Assert
      expect(() => assertEventSequence(mockEvents, expectedSequence)).not.toThrow();
      expect(() => assertEventSequence(mockEvents, ['NonExistent', 'OrderCreated'])).toThrow('Event sequence assertion failed');
    });

    it('should assert strict event sequence', () => {
      // Arrange
      const expectedSequence = ['OrderCreated', 'OrderShipped']; // Missing PaymentProcessed in between

      // Act & Assert
      expect(() => assertEventSequence(mockEvents, expectedSequence, false)).not.toThrow(); // Non-strict passes
      expect(() => assertEventSequence(mockEvents, expectedSequence, true)).toThrow('Event sequence assertion failed'); // Strict fails
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty event arrays', () => {
      // Act
      const result = matcher.hasEvent([], 'OrderCreated');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle null/undefined event payloads', () => {
      // Arrange
      const eventWithNullPayload: IExtendedDomainEvent = {
        ...mockEvents[0],
        payload: null,
        eventType: 'OrderCreated',
      };

      // Act
      const result = matcher.hasEventWithPayload([eventWithNullPayload], 'OrderCreated', null);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle events without metadata', () => {
      // Arrange
      const eventWithoutMetadata: IExtendedDomainEvent = {
        ...mockEvents[0],
        metadata: undefined as any,
        eventType: 'OrderCreated',
      };

      // Act
      const result = matcher.findEventsByMetadata([eventWithoutMetadata], { userId: 'user-1' });

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should handle complex nested payload matching', () => {
      // Arrange
      const complexPayload = {
        order: {
          id: 'order-123',
          items: [
            { productId: 'product-1', details: { name: 'Product 1', price: 50 } }
          ]
        }
      };
      const eventWithComplexPayload: IExtendedDomainEvent = {
        ...mockEvents[0],
        payload: complexPayload,
        eventType: 'OrderCreated',
      };

      const partialMatch = {
        order: {
          id: 'order-123',
          items: [{ productId: 'product-1' }]
        }
      };

      // Act
      const result = matcher.hasEventWithPayload([eventWithComplexPayload], 'OrderCreated', partialMatch, {
        partialPayload: true
      });

      // Assert
      expect(result).toBe(true);
    });

    it('should handle timing constraints with edge cases', () => {
      // Arrange
      const pattern: EventPattern = {
        name: 'Immediate Event',
        eventType: 'OrderCreated', // First event, no previous event to check delay against
        timing: {
          maxDelay: 0 // Must be immediate
        }
      };

      // Act
      const result = matcher.matchesPattern(mockEvents, pattern);

      // Assert
      expect(result.matches).toBe(true); // Should pass because first event has no delay constraint
    });
  });
});
