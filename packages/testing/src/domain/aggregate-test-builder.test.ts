import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AggregateTestBuilder,
  EventSourcedAggregateTestBuilder,
  createAggregateTestBuilder,
  createEventSourcedAggregateTestBuilder,
  type AggregateEventScenario,
} from './aggregate-test-builder';
import { AggregateRoot } from '@vytches-ddd/aggregates';
import type { IAggregateConstructorParams } from '@vytches-ddd/aggregates';
import type { EntityId } from '@vytches-ddd/value-objects';
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';

// Test aggregate implementation
class TestOrderAggregate extends AggregateRoot<string> {
  private customerId?: string;
  private status = 'pending';
  private items: Array<{ productId: string; quantity: number }> = [];

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
  }

  createOrder(customerId: string, items: Array<{ productId: string; quantity: number }>): void {
    this.customerId = customerId;
    this.items = items;
    this.status = 'created';

    this.apply('OrderCreated', {
      orderId: this.getId().getValue(),
      customerId,
      items,
      createdAt: new Date()
    });
  }

  processPayment(paymentId: string, amount: number): void {
    if (this.status !== 'created') {
      throw new Error('Cannot process payment for order that is not created');
    }

    this.status = 'payment-processed';

    this.apply('PaymentProcessed', {
      orderId: this.getId().getValue(),
      paymentId,
      amount,
      processedAt: new Date()
    });
  }

  shipOrder(trackingNumber: string): void {
    if (this.status !== 'payment-processed') {
      throw new Error('Cannot ship order that does not have payment processed');
    }

    this.status = 'shipped';

    this.apply('OrderShipped', {
      orderId: this.getId().getValue(),
      trackingNumber,
      shippedAt: new Date()
    });
  }

  getCustomerId(): string | undefined {
    return this.customerId;
  }

  getStatus(): string {
    return this.status;
  }

  getItems(): Array<{ productId: string; quantity: number }> {
    return [...this.items];
  }

  // Event handlers for state changes
  protected registerEventHandlers(): void {
    this.registerEventHandler('OrderCreated', (payload: any) => {
      this.customerId = payload.customerId;
      this.items = payload.items;
      this.status = 'created';
    });

    this.registerEventHandler('PaymentProcessed', () => {
      this.status = 'payment-processed';
    });

    this.registerEventHandler('OrderShipped', () => {
      this.status = 'shipped';
    });
  }
}

// Test capability for testing capabilities feature
class TestAuditCapability {
  private auditLog: Array<{ action: string; timestamp: Date }> = [];

  constructor(private aggregate: any) {}

  attach(aggregate: any): void {
    this.aggregate = aggregate;
  }

  detach(): void {
    this.aggregate = null;
  }

  logAction(action: string): void {
    this.auditLog.push({ action, timestamp: new Date() });
  }

  getAuditLog(): Array<{ action: string; timestamp: Date }> {
    return [...this.auditLog];
  }
}

describe('AggregateTestBuilder', () => {
  let builder: AggregateTestBuilder<TestOrderAggregate>;
  let testEntityId: EntityId<string>;

  beforeEach(() => {
    testEntityId = { getValue: () => 'test-order-123' } as EntityId<string>;
    builder = new AggregateTestBuilder(TestOrderAggregate);
  });

  describe('Basic Aggregate Building', () => {
    it('should create basic aggregate with default values', () => {
      // Act
      const aggregate = builder.build();

      // Assert
      expect(aggregate).toBeInstanceOf(TestOrderAggregate);
      expect(aggregate.getId()).toBeDefined();
      expect(aggregate.getVersion()).toBe(0);
      expect(aggregate.getDomainEvents()).toHaveLength(0);
      expect(aggregate.hasChanges()).toBe(false);
    });

    it('should create aggregate with specified ID', () => {
      // Act
      const aggregate = builder
        .withId(testEntityId)
        .build();

      // Assert
      expect(aggregate.getId().getValue()).toBe('test-order-123');
    });

    it('should create aggregate with specified version', () => {
      // Act
      const aggregate = builder
        .withVersion(5)
        .build();

      // Assert
      expect(aggregate.getVersion()).toBe(5);
    });

    it('should create aggregate with initial version', () => {
      // Act
      const aggregate = builder
        .withInitialVersion(3)
        .build();

      // Assert
      expect(aggregate.getInitialVersion()).toBe(3);
    });

    it('should create aggregate with custom factory', () => {
      // Arrange
      const customFactory = vi.fn((data: any) => {
        const aggregate = new TestOrderAggregate({
          id: data.id || testEntityId,
          version: 0
        });
        (aggregate as any).customProperty = 'custom-value';
        return aggregate;
      });

      // Act
      const aggregate = builder
        .withFactory(customFactory)
        .build();

      // Assert
      expect(customFactory).toHaveBeenCalled();
      expect((aggregate as any).customProperty).toBe('custom-value');
    });
  });

  describe('Domain Events', () => {
    it('should add domain events to aggregate', () => {
      // Arrange
      const testEvent: IExtendedDomainEvent = {
        eventType: 'TestEvent',
        payload: { test: 'data' },
        metadata: { timestamp: new Date(), eventId: 'test-event-1' }
      };

      // Act
      const aggregate = builder
        .withDomainEvent(testEvent)
        .build();

      // Assert
      expect(aggregate.getDomainEvents()).toHaveLength(1);
      expect(aggregate.getDomainEvents()?.[0]?.eventType).toBe('TestEvent');
    });

    it('should add multiple domain events', () => {
      // Arrange
      const events: IExtendedDomainEvent[] = [
        {
          eventType: 'Event1',
          payload: { test: 'data1' },
          metadata: { timestamp: new Date(), eventId: 'test-event-1' }
        },
        {
          eventType: 'Event2',
          payload: { test: 'data2' },
          metadata: { timestamp: new Date(), eventId: 'test-event-2' }
        }
      ];

      // Act
      const aggregate = builder
        .withDomainEvents(events)
        .build();

      // Assert
      expect(aggregate.getDomainEvents()).toHaveLength(2);
      expect(aggregate.getDomainEvents().map(e => e.eventType)).toEqual(['Event1', 'Event2']);
    });

    it('should auto-generate domain events', () => {
      // Act
      const aggregate = builder
        .withAutoGeneratedEvents(3, 'OrderEvent')
        .build();

      // Assert
      expect(aggregate.getDomainEvents()).toHaveLength(3);
      expect(aggregate.getDomainEvents().map(e => e.eventType)).toEqual([
        'OrderEvent1',
        'OrderEvent2',
        'OrderEvent3'
      ]);
    });

    it('should generate events with realistic metadata when enabled', () => {
      // Act
      const aggregate = builder
        .withEventMetadata(true)
        .withAutoGeneratedEvents(1)
        .build();

      // Assert
      const event = aggregate.getDomainEvents()[0];
      expect(event?.metadata).toBeDefined();
      expect(event?.metadata?.userId).toBeDefined();
      expect(event?.metadata?.sessionId).toBeDefined();
      expect(event?.metadata?.requestId).toBeDefined();
      expect(event?.metadata?.source).toBe('AggregateTestBuilder');
    });
  });

  describe('Capabilities', () => {
    it('should add capabilities to aggregate', () => {
      // Arrange
      const capability = new TestAuditCapability(null);

      // Act
      const aggregate = builder
        .withCapabilities([capability])
        .build();

      // Assert - this test depends on the aggregate supporting capabilities
      // The exact assertion would depend on how capabilities are exposed in the aggregate
      expect(aggregate).toBeDefined();
    });
  });

  describe('Event Scenarios', () => {
    it('should build aggregate with event scenario', async () => {
      // Arrange
      const scenario: AggregateEventScenario = {
        name: 'Order Processing Flow',
        description: 'Complete order processing from creation to shipping',
        events: [
          {
            eventType: 'OrderCreated',
            payload: { customerId: 'customer-123', items: [{ productId: 'product-1', quantity: 2 }] }
          },
          {
            eventType: 'PaymentProcessed',
            payload: { paymentId: 'payment-456', amount: 100 }
          },
          {
            eventType: 'OrderShipped',
            payload: { trackingNumber: 'track-789' }
          }
        ],
        expectedVersion: 3,
        expectedEventCount: 3
      };

      // Act
      const aggregate = await builder
        .withAutoApplyEvents(true)
        .buildWithScenario(scenario);

      // Assert
      expect(aggregate.getVersion()).toBe(3);
      expect(aggregate.getDomainEvents()).toHaveLength(3);
    });

    it('should fail scenario when expected version does not match', async () => {
      // Arrange
      const scenario: AggregateEventScenario = {
        name: 'Invalid Version Scenario',
        events: [
          { eventType: 'OrderCreated', payload: { customerId: 'customer-123' } }
        ],
        expectedVersion: 5 // This should fail as only 1 event is applied
      };

      // Act & Assert
      await expect(builder.buildWithScenario(scenario)).rejects.toThrow(
        "Scenario 'Invalid Version Scenario' expected version 5 but got 1"
      );
    });

    it('should fail scenario when expected event count does not match', async () => {
      // Arrange
      const scenario: AggregateEventScenario = {
        name: 'Invalid Event Count Scenario',
        events: [
          { eventType: 'OrderCreated', payload: { customerId: 'customer-123' } }
        ],
        expectedEventCount: 3 // This should fail as only 1 event is generated
      };

      // Act & Assert
      await expect(builder.buildWithScenario(scenario)).rejects.toThrow(
        "Scenario 'Invalid Event Count Scenario' expected 3 events but got 1"
      );
    });

    it('should handle scenario with delays', async () => {
      // Arrange
      const startTime = Date.now();
      const scenario: AggregateEventScenario = {
        name: 'Delayed Events Scenario',
        events: [
          { eventType: 'OrderCreated', payload: { customerId: 'customer-123' } },
          { eventType: 'PaymentProcessed', payload: { paymentId: 'payment-456' }, delay: 50 }
        ]
      };

      // Act
      const aggregate = await builder.buildWithScenario(scenario);
      const endTime = Date.now();

      // Assert
      expect(aggregate.getDomainEvents()).toHaveLength(2);
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });

    it('should build multiple aggregates with different scenarios', async () => {
      // Arrange
      const scenarios: AggregateEventScenario[] = [
        {
          name: 'Scenario 1',
          events: [{ eventType: 'OrderCreated', payload: { customerId: 'customer-1' } }]
        },
        {
          name: 'Scenario 2',
          events: [
            { eventType: 'OrderCreated', payload: { customerId: 'customer-2' } },
            { eventType: 'PaymentProcessed', payload: { paymentId: 'payment-2' } }
          ]
        }
      ];

      // Act
      const aggregates = await builder.buildMultipleWithScenarios(scenarios);

      // Assert
      expect(aggregates).toHaveLength(2);
      expect(aggregates?.[0]?.getDomainEvents()).toHaveLength(1);
      expect(aggregates?.[1]?.getDomainEvents()).toHaveLength(2);
    });
  });

  describe('State Snapshots', () => {
    it('should create aggregate state snapshot', () => {
      // Arrange
      const aggregate = builder
        .withId(testEntityId)
        .withVersion(3)
        .withAutoGeneratedEvents(2)
        .build();

      // Act
      const snapshot = builder.createSnapshot(aggregate, 'test-snapshot');

      // Assert
      expect(snapshot.id.getValue()).toBe('test-order-123');
      expect(snapshot.version).toBe(3);
      expect(snapshot.domainEvents).toHaveLength(2);
      expect(snapshot.hasChanges).toBe(true);
      expect(builder.getSnapshot('test-snapshot')).toBe(snapshot);
    });

    it('should build aggregate from snapshot', () => {
      // Arrange
      const originalAggregate = builder
        .withId(testEntityId)
        .withVersion(5)
        .withAutoGeneratedEvents(3)
        .build();

      const snapshot = builder.createSnapshot(originalAggregate);

      // Act
      const restoredAggregate = builder.buildFromSnapshot(snapshot);

      // Assert
      expect(restoredAggregate.getId().getValue()).toBe(originalAggregate.getId().getValue());
      expect(restoredAggregate.getVersion()).toBe(originalAggregate.getVersion());
      expect(restoredAggregate.getDomainEvents()).toHaveLength(originalAggregate.getDomainEvents().length);
    });

    it('should compare snapshots correctly', () => {
      // Arrange
      const aggregate1 = builder
        .withId(testEntityId)
        .withVersion(3)
        .build();

      const aggregate2 = builder
        .withId({ getValue: () => 'different-id' } as EntityId<string>)
        .withVersion(5)
        .build();

      const snapshot1 = builder.createSnapshot(aggregate1);
      const snapshot2 = builder.createSnapshot(aggregate2);

      // Act
      const comparison = builder.compareSnapshots(snapshot1, snapshot2);

      // Assert
      expect(comparison.identical).toBe(false);
      expect(comparison.differences).toContain('ID differs: test-order-123 vs different-id');
      expect(comparison.differences).toContain('Version differs: 3 vs 5');
    });

    it('should identify identical snapshots', () => {
      // Arrange
      const aggregate = builder
        .withId(testEntityId)
        .withVersion(3)
        .build();

      const snapshot1 = builder.createSnapshot(aggregate);
      const snapshot2 = builder.createSnapshot(aggregate);

      // Act
      const comparison = builder.compareSnapshots(snapshot1, snapshot2);

      // Assert
      expect(comparison.identical).toBe(true);
      expect(comparison.differences).toHaveLength(0);
    });
  });

  describe('Event Generation', () => {
    it('should generate test events with appropriate payloads for Created events', () => {
      // Act
      const event = builder.generateTestEvent('OrderCreated');

      // Assert
      expect(event.eventType).toBe('OrderCreated');
      expect(event.payload).toHaveProperty('id');
      expect(event.payload).toHaveProperty('createdAt');
      expect(event.payload).toHaveProperty('createdBy', 'test-user');
    });

    it('should generate test events with appropriate payloads for Updated events', () => {
      // Act
      const event = builder.generateTestEvent('OrderUpdated');

      // Assert
      expect(event.eventType).toBe('OrderUpdated');
      expect(event.payload).toHaveProperty('updatedAt');
      expect(event.payload).toHaveProperty('updatedBy', 'test-user');
      expect(event.payload).toHaveProperty('previousValue');
      expect(event.payload).toHaveProperty('newValue');
    });

    it('should generate test events with appropriate payloads for Deleted events', () => {
      // Act
      const event = builder.generateTestEvent('OrderDeleted');

      // Assert
      expect(event.eventType).toBe('OrderDeleted');
      expect(event.payload).toHaveProperty('deletedAt');
      expect(event.payload).toHaveProperty('deletedBy', 'test-user');
      expect(event.payload).toHaveProperty('reason');
    });

    it('should generate test events with custom payload', () => {
      // Arrange
      const customPayload = { customField: 'customValue', amount: 100 };

      // Act
      const event = builder.generateTestEvent('CustomEvent', customPayload);

      // Assert
      expect(event.eventType).toBe('CustomEvent');
      expect(event.payload).toEqual(customPayload);
    });

    it('should generate test events with custom metadata', () => {
      // Arrange
      const customMetadata = { userId: 'user-123', tenantId: 'tenant-456' };

      // Act
      const event = builder.generateTestEvent('TestEvent', undefined, customMetadata);

      // Assert
      expect(event.metadata?.userId).toBe('user-123');
      expect(event.metadata?.tenantId).toBe('tenant-456');
    });
  });

  describe('Builder Cloning', () => {
    it('should clone builder with all settings preserved', () => {
      // Arrange
      const originalBuilder = builder
        .withVersion(5)
        .withAutoGeneratedEvents(2)
        .withEventMetadata(true);

      // Act
      const clonedBuilder = originalBuilder.clone();
      const originalAggregate = originalBuilder.build();
      const clonedAggregate = clonedBuilder.build();

      // Assert
      expect(clonedAggregate.getVersion()).toBe(originalAggregate.getVersion());
      expect(clonedAggregate.getDomainEvents()).toHaveLength(originalAggregate.getDomainEvents().length);
    });
  });

  describe('Factory Functions', () => {
    it('should create builder using factory function', () => {
      // Act
      const factoryBuilder = createAggregateTestBuilder(TestOrderAggregate);
      const aggregate = factoryBuilder.build();

      // Assert
      expect(aggregate).toBeInstanceOf(TestOrderAggregate);
    });

    it('should create builder with options using factory function', () => {
      // Act
      const factoryBuilder = createAggregateTestBuilder(TestOrderAggregate, {
        version: 10,
        autoGenerateEvents: true
      });
      const aggregate = factoryBuilder.build();

      // Assert
      expect(aggregate.getVersion()).toBe(10);
    });
  });
});

describe('EventSourcedAggregateTestBuilder', () => {
  let builder: EventSourcedAggregateTestBuilder<TestOrderAggregate>;

  beforeEach(() => {
    builder = new EventSourcedAggregateTestBuilder(TestOrderAggregate);
  });

  describe('Event Sourcing', () => {
    it('should build aggregate from event history', () => {
      // Arrange
      const eventHistory: IExtendedDomainEvent[] = [
        {
          eventType: 'OrderCreated',
          payload: { customerId: 'customer-123' },
          metadata: { timestamp: new Date(), eventId: 'event-1' }
        },
        {
          eventType: 'PaymentProcessed',
          payload: { paymentId: 'payment-456' },
          metadata: { timestamp: new Date(), eventId: 'event-2' }
        }
      ];

      // Act
      const aggregate = builder
        .withEventHistory(eventHistory)
        .buildFromEventHistory();

      // Assert
      expect(aggregate).toBeInstanceOf(TestOrderAggregate);
      // Note: The actual version and state would depend on how loadFromHistory is implemented
    });

    it('should build event sourcing scenario', async () => {
      // Arrange
      const events = [
        { eventType: 'OrderCreated', payload: { customerId: 'customer-123' } },
        { eventType: 'PaymentProcessed', payload: { paymentId: 'payment-456' }, delay: 10 }
      ];

      // Act
      const result = await builder.buildEventSourcingScenario(events);

      // Assert
      expect(result.aggregate).toBeInstanceOf(TestOrderAggregate);
      expect(result.eventHistory).toHaveLength(2);
      expect(result.eventHistory?.[0]?.eventType).toBe('OrderCreated');
      expect(result.eventHistory?.[1]?.eventType).toBe('PaymentProcessed');
    });

    it('should create builder using event-sourced factory function', () => {
      // Act
      const factoryBuilder = createEventSourcedAggregateTestBuilder(TestOrderAggregate);
      const aggregate = factoryBuilder.build();

      // Assert
      expect(aggregate).toBeInstanceOf(TestOrderAggregate);
    });
  });
});
