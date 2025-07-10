import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventTestHarness, type EventTestHarnessOptions, type EventTestScenario } from '../../src/event-test-harness';
import { DomainEvent } from '@vytches-ddd/events';
import type { IDomainEvent } from '@vytches-ddd/contracts';

// Re-export IIntegrationEvent interface from event-test-harness
type IIntegrationEvent = import('./event-test-harness').IIntegrationEvent;

// Test event implementations
class TestOrderCreatedEvent extends DomainEvent<{ orderId: string; customerId: string }> {
  constructor(payload: { orderId: string; customerId: string }, metadata?: any) {
    super(payload, metadata);
  }
}

class TestPaymentProcessedEvent extends DomainEvent<{ paymentId: string; amount: number }> {
  constructor(payload: { paymentId: string; amount: number }, metadata?: any) {
    super(payload, metadata);
  }
}

class TestOrderShippedEvent extends DomainEvent<{ orderId: string; trackingNumber: string }> {
  constructor(payload: { orderId: string; trackingNumber: string }, metadata?: any) {
    super(payload, metadata);
  }
}

// Test integration event
class TestExternalNotificationEvent implements IIntegrationEvent {
  readonly eventId = 'test-id';
  readonly eventType = 'TestExternalNotificationEvent';
  readonly occurredOn = new Date();

  constructor(public readonly payload: { message: string }) {}
}

// Test aggregate for testing
class TestOrderAggregate {
  private events: IDomainEvent[] = [];

  constructor(private orderId: string) {}

  createOrder(customerId: string): void {
    this.events.push(new TestOrderCreatedEvent({
      orderId: this.orderId,
      customerId
    }));
  }

  processPayment(paymentId: string, amount: number): void {
    this.events.push(new TestPaymentProcessedEvent({
      paymentId,
      amount
    }));
  }

  getDomainEvents(): IDomainEvent[] {
    return [...this.events];
  }

  commit(): void {
    this.events = [];
  }
}

describe('EventTestHarness', () => {
  let harness: EventTestHarness;
  let options: EventTestHarnessOptions;

  beforeEach(async () => {
    options = {
      captureAllEvents: true,
      contextId: 'test-context',
      maxCapturedEvents: 100,
      enableEventLogging: false
    };

    harness = new EventTestHarness(options);
    await harness.initialize();
  });

  afterEach(async () => {
    await harness.teardown();
  });

  describe('Event Publishing', () => {
    it('should publish single event successfully', async () => {
      // Arrange
      const event = new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      });

      // Act
      await harness.publishEvent(event);

      // Assert
      expect(harness.assertions.eventWasPublished('TestOrderCreatedEvent')).toBe(true);
      expect(harness.assertions.getEventCount()).toBe(1);
    });

    it('should publish multiple events successfully', async () => {
      // Arrange
      const events = [
        new TestOrderCreatedEvent({ orderId: 'order-123', customerId: 'customer-456' }),
        new TestPaymentProcessedEvent({ paymentId: 'payment-789', amount: 100 }),
        new TestOrderShippedEvent({ orderId: 'order-123', trackingNumber: 'track-123' })
      ];

      // Act
      await harness.publishEvents(events);

      // Assert
      expect(harness.assertions.getEventCount()).toBe(3);
      expect(harness.assertions.eventWasPublished('TestOrderCreatedEvent')).toBe(true);
      expect(harness.assertions.eventWasPublished('TestPaymentProcessedEvent')).toBe(true);
      expect(harness.assertions.eventWasPublished('TestOrderShippedEvent')).toBe(true);
    });

    it('should publish aggregate events successfully', async () => {
      // Arrange
      const aggregate = new TestOrderAggregate('order-123');
      aggregate.createOrder('customer-456');
      aggregate.processPayment('payment-789', 100);

      // Act
      await harness.publishEventsForAggregate(aggregate);

      // Assert
      expect(harness.assertions.getEventCount()).toBe(2);
      expect(harness.assertions.eventWasPublished('TestOrderCreatedEvent')).toBe(true);
      expect(harness.assertions.eventWasPublished('TestPaymentProcessedEvent')).toBe(true);
      expect(aggregate.getDomainEvents()).toHaveLength(0); // Events should be committed
    });

    it('should add context to events when contextId is specified', async () => {
      // Arrange
      const event = new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      });

      // Act
      await harness.publishEvent(event);

      // Assert
      expect(harness.assertions.eventWasPublishedInContext('TestOrderCreatedEvent', 'test-context')).toBe(true);
    });

    it('should handle integration events correctly', async () => {
      // Arrange
      const event = new TestExternalNotificationEvent({ message: 'Order processed' });

      // Act
      await harness.publishEvent(event);

      // Assert
      expect(harness.assertions.eventWasPublished('TestExternalNotificationEvent')).toBe(true);
      expect(harness.assertions.getEventCount()).toBe(1);
    });
  });

  describe('Event Subscription and Handler Tracking', () => {
    it('should track handler calls when subscribing to events', async () => {
      // Arrange
      let handlerCalled = false;
      const handler = vi.fn(async () => {
        handlerCalled = true;
      });

      harness.subscribeToEvent('TestOrderCreatedEvent', handler);

      // Act
      await harness.publishEvent(new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      }));

      // Assert
      expect(handlerCalled).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(harness.assertions.hasHandlerBeenCalled('TestOrderCreatedEvent')).toBe(true);
      expect(harness.assertions.getHandlerCallCount('TestOrderCreatedEvent')).toBe(1);
    });

    it('should handle context-specific subscriptions', async () => {
      // Arrange
      let contextHandlerCalled = false;
      let allHandlerCalled = false;

      const contextHandler = vi.fn(async () => {
        contextHandlerCalled = true;
      });

      const allHandler = vi.fn(async () => {
        allHandlerCalled = true;
      });

      // Subscribe to specific context
      harness.subscribeToContext('test-context', 'TestOrderCreatedEvent', contextHandler);

      // Subscribe to all contexts
      harness.subscribeToEvent('TestOrderCreatedEvent', allHandler);

      // Act
      await harness.publishEvent(new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      }));

      // Assert
      expect(contextHandlerCalled).toBe(true);
      expect(allHandlerCalled).toBe(true);
      expect(contextHandler).toHaveBeenCalledTimes(1);
      expect(allHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle class-based event handlers', async () => {
      // Arrange
      const handler = {
        handle: vi.fn(async (_event: TestOrderCreatedEvent) => {
          // Handler logic
        })
      };

      harness.registerHandler('TestOrderCreatedEvent', handler);

      // Act
      await harness.publishEvent(new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      }));

      // Assert
      expect(handler.handle).toHaveBeenCalledTimes(1);
      expect(harness.assertions.hasHandlerBeenCalled('TestOrderCreatedEvent')).toBe(true);
    });

    it('should track multiple handler calls correctly', async () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      harness.subscribeToEvent('TestOrderCreatedEvent', handler1);
      harness.subscribeToEvent('TestOrderCreatedEvent', handler2);

      // Act
      await harness.publishEvent(new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      }));

      // Assert
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(harness.assertions.getHandlerCallCount('TestOrderCreatedEvent')).toBe(2);
    });
  });

  describe('Event Assertions', () => {
    beforeEach(async () => {
      // Publish some test events
      await harness.publishEvent(new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      }));

      await harness.publishEvent(new TestPaymentProcessedEvent({
        paymentId: 'payment-789',
        amount: 100
      }));
    });

    it('should correctly identify published events', () => {
      expect(harness.assertions.eventWasPublished('TestOrderCreatedEvent')).toBe(true);
      expect(harness.assertions.eventWasPublished('TestPaymentProcessedEvent')).toBe(true);
      expect(harness.assertions.eventWasPublished('NonExistentEvent')).toBe(false);
    });

    it('should correctly identify events with specific payload', () => {
      const payload = { orderId: 'order-123', customerId: 'customer-456' };
      expect(harness.assertions.eventWasPublishedWithPayload('TestOrderCreatedEvent', payload)).toBe(true);

      const wrongPayload = { orderId: 'order-999', customerId: 'customer-999' };
      expect(harness.assertions.eventWasPublishedWithPayload('TestOrderCreatedEvent', wrongPayload)).toBe(false);
    });

    it('should filter events by type correctly', () => {
      const orderEvents = harness.assertions.getEventsOfType('TestOrderCreatedEvent');
      expect(orderEvents).toHaveLength(1);
      expect(orderEvents[0]?.eventType).toBe('TestOrderCreatedEvent');

      const paymentEvents = harness.assertions.getEventsOfType('TestPaymentProcessedEvent');
      expect(paymentEvents).toHaveLength(1);
      expect(paymentEvents[0]?.eventType).toBe('TestPaymentProcessedEvent');
    });

    it('should filter events by context correctly', () => {
      const contextEvents = harness.assertions.getEventsByContext('test-context');
      expect(contextEvents).toHaveLength(2); // Both events should have the test context
    });

    it('should return all captured events', () => {
      const allEvents = harness.assertions.getAllCapturedEvents();
      expect(allEvents).toHaveLength(2);
    });

    it('should count events correctly', () => {
      expect(harness.assertions.getEventCount()).toBe(2);
      expect(harness.assertions.getEventCountByType('TestOrderCreatedEvent')).toBe(1);
      expect(harness.assertions.getEventCountByType('TestPaymentProcessedEvent')).toBe(1);
      expect(harness.assertions.getEventCountByType('NonExistentEvent')).toBe(0);
    });

    it('should verify event order correctly', () => {
      const correctOrder = ['TestOrderCreatedEvent', 'TestPaymentProcessedEvent'];
      expect(harness.assertions.verifyEventOrder(correctOrder)).toBe(true);

      const wrongOrder = ['TestPaymentProcessedEvent', 'TestOrderCreatedEvent'];
      expect(harness.assertions.verifyEventOrder(wrongOrder)).toBe(false);
    });
  });

  describe('Event Scenarios', () => {
    it('should run simple event scenario successfully', async () => {
      // Arrange
      const handler = vi.fn();
      harness.subscribeToEvent('TestOrderCreatedEvent', handler);
      harness.subscribeToEvent('TestPaymentProcessedEvent', handler);

      const scenario: EventTestScenario = {
        name: 'Order Processing Flow',
        events: [
          new TestOrderCreatedEvent({ orderId: 'order-123', customerId: 'customer-456' }),
          new TestPaymentProcessedEvent({ paymentId: 'payment-789', amount: 100 })
        ],
        expectedHandlerCalls: 2,
        expectedEventTypes: ['TestOrderCreatedEvent', 'TestPaymentProcessedEvent']
      };

      // Act
      await harness.runScenario(scenario);

      // Assert
      expect(handler).toHaveBeenCalledTimes(2);
      expect(harness.assertions.eventWasPublished('TestOrderCreatedEvent')).toBe(true);
      expect(harness.assertions.eventWasPublished('TestPaymentProcessedEvent')).toBe(true);
    });

    it('should fail scenario when expected events are not published', async () => {
      // Arrange
      const scenario: EventTestScenario = {
        name: 'Incomplete Flow',
        events: [
          new TestOrderCreatedEvent({ orderId: 'order-123', customerId: 'customer-456' })
        ],
        expectedHandlerCalls: 1,
        expectedEventTypes: ['TestOrderCreatedEvent', 'TestPaymentProcessedEvent'] // This event won't be published
      };

      // Act & Assert
      await expect(harness.runScenario(scenario)).rejects.toThrow(
        "Expected event type 'TestPaymentProcessedEvent' was not published in scenario 'Incomplete Flow'"
      );
    });

    it('should fail scenario when handler call count is wrong', async () => {
      // Arrange
      const handler = vi.fn();
      harness.subscribeToEvent('TestOrderCreatedEvent', handler);

      const scenario: EventTestScenario = {
        name: 'Wrong Handler Count',
        events: [
          new TestOrderCreatedEvent({ orderId: 'order-123', customerId: 'customer-456' })
        ],
        expectedHandlerCalls: 5, // Wrong count
        expectedEventTypes: ['TestOrderCreatedEvent']
      };

      // Act & Assert
      await expect(harness.runScenario(scenario)).rejects.toThrow(
        "Expected 5 handler calls but got 1 in scenario 'Wrong Handler Count'"
      );
    });

    it('should handle scenario timeout', async () => {
      // Arrange
      const scenario: EventTestScenario = {
        name: 'Timeout Test',
        events: [],
        expectedHandlerCalls: 0,
        expectedEventTypes: [],
        timeout: 50 // Very short timeout
      };

      // Mock a long-running operation
      const originalExecuteScenario = (harness as any).executeScenario;
      (harness as any).executeScenario = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Takes longer than timeout
      });

      // Act & Assert
      await expect(harness.runScenario(scenario)).rejects.toThrow(
        "Scenario 'Timeout Test' timed out"
      );

      // Restore original method
      (harness as any).executeScenario = originalExecuteScenario;
    });
  });

  describe('Configuration Options', () => {
    it('should respect maxCapturedEvents option', async () => {
      // Arrange
      await harness.teardown();

      const limitedHarness = new EventTestHarness({
        captureAllEvents: true,
        maxCapturedEvents: 2
      });
      await limitedHarness.initialize();

      // Act
      for (let i = 0; i < 5; i++) {
        await limitedHarness.publishEvent(new TestOrderCreatedEvent({
          orderId: `order-${i}`,
          customerId: 'customer-456'
        }));
      }

      // Assert
      expect(limitedHarness.assertions.getEventCount()).toBe(2); // Should be limited to 2

      await limitedHarness.teardown();
    });

    it('should work without auto-capture when disabled', async () => {
      // Arrange
      await harness.teardown();

      const noCaptureHarness = new EventTestHarness({
        captureAllEvents: false
      });
      await noCaptureHarness.initialize();

      // Act
      await noCaptureHarness.publishEvent(new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      }));

      // Assert
      expect(noCaptureHarness.assertions.getEventCount()).toBe(0); // No auto-capture

      await noCaptureHarness.teardown();
    });
  });

  describe('Utility Methods', () => {
    it('should clear captured events', async () => {
      // Arrange
      await harness.publishEvent(new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      }));
      expect(harness.assertions.getEventCount()).toBe(1);

      // Act
      harness.clearCapturedEvents();

      // Assert
      expect(harness.assertions.getEventCount()).toBe(0);
    });

    it('should clear handler call counts', async () => {
      // Arrange
      const handler = vi.fn();
      harness.subscribeToEvent('TestOrderCreatedEvent', handler);

      await harness.publishEvent(new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      }));

      expect(harness.assertions.getHandlerCallCount('TestOrderCreatedEvent')).toBe(1);

      // Act
      harness.clearHandlerCallCounts();

      // Assert
      expect(harness.assertions.getHandlerCallCount('TestOrderCreatedEvent')).toBe(0);
    });

    it('should provide access to underlying event bus', () => {
      // Act
      const eventBus = harness.getEventBus();

      // Assert
      expect(eventBus).toBeDefined();
      expect(typeof eventBus.publish).toBe('function');
      expect(typeof eventBus.subscribe).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle handler errors gracefully', async () => {
      // Arrange
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      harness.subscribeToEvent('TestOrderCreatedEvent', errorHandler);

      // Act & Assert
      await expect(harness.publishEvent(new TestOrderCreatedEvent({
        orderId: 'order-123',
        customerId: 'customer-456'
      }))).rejects.toThrow('Handler error');

      // Handler call should still be tracked
      expect(harness.assertions.hasHandlerBeenCalled('TestOrderCreatedEvent')).toBe(true);
    });
  });
});
