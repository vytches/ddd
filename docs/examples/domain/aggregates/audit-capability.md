@global-settings
@strategy: merge
@description: Global description for all aggregate capability examples
@business-context: Standard business context for aggregate capability operations
@author: DDD Team
@since: 1.0.0
@global-settings-end

# AuditCapability - Advanced Example

**Version**: 1.0.0
**Package**: @vytches/ddd-aggregates
**Complexity**: advanced
**Domain**: aggregates
**Patterns**: audit-trails, event-interception, compliance
**Dependencies**: @vytches/ddd-contracts

## Description

Demonstrates audit capability for tracking all aggregate changes and maintaining comprehensive audit trails. Shows automatic event interception and audit statistics generation.

## Business Context

Audit trails are essential for compliance, debugging, and business intelligence. AuditCapability automatically captures all domain events with rich metadata for comprehensive change tracking.

## Code Example

@description: Demonstrates audit capability for comprehensive change tracking and compliance audit trails
@description.cli: ## Enhanced CLI Description\n\nShows automatic event interception and audit statistics generation for compliance requirements
@description.jsdoc: Audit capability for tracking aggregate changes and maintaining audit trails
@business-context: Enables compliance audit trails and comprehensive change tracking in enterprise scenarios
@business-context.cli: Extended context for enterprise audit and compliance patterns
@business-context.jsdoc: Audit trail capability for compliance and change tracking
@since: 1.0.0

@extract: audit-capability:domain:advanced

```typescript
import { AggregateBuilder, AuditCapability } from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-contracts';

// Define audit event interface
interface OrderAuditEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  aggregateVersion: number;
  timestamp: Date;
  payload: unknown;
  metadata: Record<string, unknown>;
  actor?: string;
}

class OrderAggregate extends AggregateRoot<string> {
  private orderData: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; price: number }>;
    status: 'pending' | 'confirmed' | 'shipped';
    total: number;
  };

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.orderData = {
      customerId: '',
      items: [],
      status: 'pending',
      total: 0
    };
  }

  // Business methods that generate events (automatically audited)
  createOrder(customerId: string): void {
    this.orderData.customerId = customerId;
    
    this.addDomainEvent({
      eventType: 'OrderCreated',
      payload: {
        orderId: this.getId().getValue(),
        customerId,
        createdAt: new Date()
      },
      metadata: {
        aggregateId: this.getId().getValue(),
        aggregateType: 'OrderAggregate',
        userId: 'user-123', // Actor information
        correlationId: 'correlation-456'
      }
    });
  }

  addItem(productId: string, quantity: number, price: number): void {
    this.orderData.items.push({ productId, quantity, price });
    this.orderData.total += quantity * price;

    this.addDomainEvent({
      eventType: 'OrderItemAdded',
      payload: {
        orderId: this.getId().getValue(),
        productId,
        quantity,
        price,
        newTotal: this.orderData.total
      },
      metadata: {
        aggregateId: this.getId().getValue(),
        aggregateType: 'OrderAggregate',
        userId: 'user-123',
        operationType: 'add_item'
      }
    });
  }

  confirmOrder(): void {
    this.orderData.status = 'confirmed';

    this.addDomainEvent({
      eventType: 'OrderConfirmed',
      payload: {
        orderId: this.getId().getValue(),
        confirmedAt: new Date(),
        finalTotal: this.orderData.total,
        itemCount: this.orderData.items.length
      },
      metadata: {
        aggregateId: this.getId().getValue(),
        aggregateType: 'OrderAggregate',
        userId: 'admin-789', // Different actor
        businessProcess: 'order_confirmation'
      }
    });
  }

  // Getters
  getOrderData() { return { ...this.orderData }; }
}

// Create aggregate with audit capability
function createOrderWithAudit() {
  const orderId = new EntityId('order-123', 'text');
  
  const orderAggregate = AggregateBuilder
    .create({ id: orderId, version: 0 })
    .withAudit() // Enable audit capability
    .build(OrderAggregate);

  return orderAggregate;
}

// Demonstrate comprehensive audit tracking
function demonstrateAuditTracking() {
  const order = createOrderWithAudit();
  const auditCap = order.getCapability(AuditCapability);
  
  if (!auditCap) {
    throw new Error('Audit capability not available');
  }

  console.log('Initial audit log:', auditCap.getAuditLog().length);

  // Perform business operations (automatically audited)
  order.createOrder('customer-456');
  order.addItem('product-1', 2, 25.00);
  order.addItem('product-2', 1, 50.00);
  order.confirmOrder();

  // Get complete audit log
  const auditLog = auditCap.getAuditLog();
  console.log('Audit log after operations:', {
    totalEvents: auditLog.length,
    events: auditLog.map(event => ({
      eventType: event.eventType,
      timestamp: event.timestamp,
      actor: event.actor,
      aggregateVersion: event.aggregateVersion
    }))
  });

  return { order, auditCap };
}

// Demonstrate audit statistics and analysis
function demonstrateAuditAnalysis() {
  const { order, auditCap } = demonstrateAuditTracking();

  // Get audit statistics
  const stats = auditCap.getAuditStatistics();
  console.log('Audit statistics:', {
    totalEvents: stats.totalEvents,
    eventsByType: stats.eventsByType,
    averageTimeBetweenEvents: `${stats.averageTimeBetweenEvents}ms`
  });

  // Filter events by type
  const orderCreatedEvents = auditCap.getEventsByType('OrderCreated');
  const orderItemEvents = auditCap.getEventsByType('OrderItemAdded');
  
  console.log('Events by type:', {
    orderCreated: orderCreatedEvents.length,
    itemsAdded: orderItemEvents.length
  });

  // Get events within time range
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  
  const recentEvents = auditCap.getEventsByTimeRange(tenMinutesAgo, now);
  console.log('Recent events:', recentEvents.length);

  // Get first and last events
  const firstEvent = auditCap.getFirstEvent();
  const lastEvent = auditCap.getLastEvent();
  
  console.log('Timeline:', {
    firstEvent: firstEvent?.eventType,
    firstTimestamp: firstEvent?.timestamp,
    lastEvent: lastEvent?.eventType,
    lastTimestamp: lastEvent?.timestamp
  });

  return { order, auditCap };
}

// Demonstrate manual audit event recording
function demonstrateManualAuditRecording() {
  const order = createOrderWithAudit();
  const auditCap = order.getCapability(AuditCapability);

  // Create custom event for manual recording
  const customEvent = {
    eventType: 'CustomBusinessEvent',
    payload: {
      action: 'manual_adjustment',
      reason: 'Customer complaint resolution',
      adjustmentAmount: -10.00
    },
    metadata: {
      aggregateId: order.getId().getValue(),
      aggregateType: 'OrderAggregate',
      userId: 'support-123',
      ticketId: 'TICKET-789',
      timestamp: new Date()
    }
  };

  // Manually record audit event
  auditCap?.recordEvent(customEvent);

  console.log('Manual audit event recorded');
  console.log('Updated audit log:', auditCap?.getAuditLog().length);

  return { order, auditCap };
}

// Demonstrate audit capability lifecycle
function demonstrateAuditLifecycle() {
  const order = createOrderWithAudit();
  let auditCap = order.getCapability(AuditCapability);

  // Generate some audit events
  order.createOrder('customer-789');
  order.addItem('product-1', 1, 20.00);

  console.log('Events before clear:', auditCap?.getAuditLog().length);

  // Clear audit log
  auditCap?.clearAuditLog();
  console.log('Events after clear:', auditCap?.getAuditLog().length);

  // Generate more events
  order.addItem('product-2', 2, 15.00);
  order.confirmOrder();

  console.log('Events after new operations:', auditCap?.getAuditLog().length);

  // Remove audit capability
  order.removeCapability(AuditCapability);
  
  // Add more events (won't be audited)
  order.addItem('product-3', 1, 30.00);

  // Re-add audit capability
  order.addCapability(new AuditCapability());
  auditCap = order.getCapability(AuditCapability);

  console.log('Events after re-adding capability:', auditCap?.getAuditLog().length);

  return { order, auditCap };
}

// Advanced audit features and compliance
function demonstrateComplianceFeatures() {
  const order = createOrderWithAudit();
  const auditCap = order.getCapability(AuditCapability);

  // Generate audit trail with compliance metadata
  order.createOrder('customer-compliance');
  
  // Add item with compliance tracking
  const complianceEvent = {
    eventType: 'ComplianceAction',
    payload: {
      action: 'gdpr_data_access',
      dataSubject: 'customer-compliance',
      accessReason: 'customer_request'
    },
    metadata: {
      aggregateId: order.getId().getValue(),
      aggregateType: 'OrderAggregate',
      userId: 'compliance-officer-456',
      complianceRegulation: 'GDPR',
      legalBasis: 'legitimate_interest',
      timestamp: new Date(),
      auditRequired: true
    }
  };

  auditCap?.recordEvent(complianceEvent);

  // Generate compliance report
  const auditLog = auditCap?.getAuditLog() || [];
  const complianceReport = {
    auditPeriod: {
      from: auditLog[0]?.timestamp,
      to: auditLog[auditLog.length - 1]?.timestamp
    },
    totalEvents: auditLog.length,
    complianceEvents: auditLog.filter(event => 
      event.metadata.complianceRegulation
    ),
    uniqueActors: [...new Set(auditLog.map(event => event.actor).filter(Boolean))],
    eventTypes: [...new Set(auditLog.map(event => event.eventType))],
    dataIntegrity: {
      allEventsHaveTimestamps: auditLog.every(event => event.timestamp),
      allEventsHaveActors: auditLog.every(event => event.actor),
      chronologicalOrder: auditLog.every((event, index) => 
        index === 0 || 
        new Date(event.timestamp) >= new Date(auditLog[index - 1]!.timestamp)
      )
    }
  };

  console.log('Compliance Report:', complianceReport);

  return { order, auditCap, complianceReport };
}

// Error handling and edge cases
function handleAuditingErrors() {
  const order = createOrderWithAudit();
  
  // Test audit capability without events
  const auditCap = order.getCapability(AuditCapability);
  const emptyStats = auditCap?.getAuditStatistics();
  
  console.log('Empty audit statistics:', emptyStats);

  // Test time range with no events
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const noEvents = auditCap?.getEventsByTimeRange(yesterday, now);
  console.log('Events in empty range:', noEvents?.length);

  // Test first/last events when empty
  console.log('First event when empty:', auditCap?.getFirstEvent());
  console.log('Last event when empty:', auditCap?.getLastEvent());

  return { order, auditCap };
}
```

@extract-end

## Key Features

- **Automatic Event Interception**: Captures all domain events without code changes
- **Rich Audit Metadata**: Includes actor, timestamp, and contextual information
- **Audit Statistics**: Generates insights about event patterns and timing
- **Flexible Querying**: Filter by type, time range, or custom criteria
- **Compliance Support**: Structured data for regulatory reporting
- **Manual Recording**: Support for custom audit events

## Common Pitfalls

- Audit logs can grow large - implement rotation or archiving strategies
- Include sufficient actor and context information in event metadata
- Consider performance impact of audit interception in high-throughput scenarios
- Ensure audit log integrity for compliance requirements

## Related Examples

- [AggregateRoot](./aggregate-root.md) - Basic aggregate implementation
- [EventSourcingCapability](./event-sourcing-capability.md) - Event sourcing integration
