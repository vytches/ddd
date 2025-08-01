@global-settings
@strategy: merge
@description: Global description for all aggregate capability examples
@business-context: Standard business context for aggregate capability operations
@author: DDD Team
@since: 1.0.0
@global-settings-end

# VersioningCapability - Advanced Example

**Version**: 1.0.0
**Package**: @vytches/ddd-aggregates
**Complexity**: advanced
**Domain**: aggregates
**Patterns**: event-versioning, upcasting, backward-compatibility
**Dependencies**: @vytches/ddd-contracts

## Description

Demonstrates event versioning and upcasting for maintaining backward compatibility when event schemas evolve. Shows how to handle different event versions gracefully.

## Business Context

As business requirements evolve, event schemas need to change. Versioning capability ensures that old events can still be processed by providing upcasting mechanisms to transform old event formats to new ones.

## Code Example

@description: Demonstrates versioning capability for event schema evolution and backward compatibility through upcasting
@description.cli: ## Enhanced CLI Description\n\nShows event versioning and upcasting for maintaining backward compatibility
@description.jsdoc: Versioning capability for event schema evolution and upcasting
@business-context: Enables backward compatibility and schema evolution in event-sourced systems
@business-context.cli: Extended context for enterprise event versioning patterns
@business-context.jsdoc: Event versioning pattern for schema evolution and backward compatibility
@since: 1.0.0

@extract: versioning-capability:domain:advanced

```typescript
import { AggregateBuilder, VersioningCapability } from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-contracts';

// Event version 1 (original)
interface OrderCreatedEventV1 {
  orderId: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

// Event version 2 (added pricing)
interface OrderCreatedEventV2 {
  orderId: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number; // Added in v2
  }>;
  totalAmount: number; // Added in v2
}

// Event version 3 (added customer info)
interface OrderCreatedEventV3 {
  orderId: string;
  customer: { // Changed structure in v3
    id: string;
    name: string;
    email: string;
  };
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    discount?: number; // Added in v3
  }>;
  totalAmount: number;
  discountAmount: number; // Added in v3
}

// Upcaster from V1 to V2
class OrderCreatedV1ToV2Upcaster {
  upcast(
    payload: OrderCreatedEventV1, 
    metadata?: unknown
  ): OrderCreatedEventV2 {
    return {
      orderId: payload.orderId,
      customerId: payload.customerId,
      items: payload.items.map(item => ({
        ...item,
        price: 0 // Default price for migrated events
      })),
      totalAmount: 0 // Default total for migrated events
    };
  }
}

// Upcaster from V2 to V3
class OrderCreatedV2ToV3Upcaster {
  upcast(
    payload: OrderCreatedEventV2,
    metadata?: unknown
  ): OrderCreatedEventV3 {
    return {
      orderId: payload.orderId,
      customer: {
        id: payload.customerId,
        name: 'Unknown', // Default for migrated events
        email: 'unknown@example.com' // Default for migrated events
      },
      items: payload.items.map(item => ({
        ...item,
        discount: 0 // Default discount
      })),
      totalAmount: payload.totalAmount,
      discountAmount: 0 // Default discount amount
    };
  }
}

class OrderAggregate extends AggregateRoot<string> {
  private orderData: {
    customerId?: string;
    customer?: { id: string; name: string; email: string };
    items: Array<{
      productId: string;
      quantity: number;
      price?: number;
      discount?: number;
    }>;
    totalAmount: number;
    discountAmount: number;
  };

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.orderData = {
      items: [],
      totalAmount: 0,
      discountAmount: 0
    };
  }

  // Event handlers for different versions
  private onOrderCreatedV1(event: OrderCreatedEventV1): void {
    this.orderData.customerId = event.customerId;
    this.orderData.items = event.items.map(item => ({
      ...item,
      price: 0
    }));
  }

  private onOrderCreatedV2(event: OrderCreatedEventV2): void {
    this.orderData.customerId = event.customerId;
    this.orderData.items = event.items;
    this.orderData.totalAmount = event.totalAmount;
  }

  private onOrderCreatedV3(event: OrderCreatedEventV3): void {
    this.orderData.customer = event.customer;
    this.orderData.items = event.items;
    this.orderData.totalAmount = event.totalAmount;
    this.orderData.discountAmount = event.discountAmount;
  }

  // Method to get current state
  getOrderData() {
    return { ...this.orderData };
  }
}

// Create aggregate with versioning capability
function createOrderWithVersioning() {
  const orderId = new EntityId('order-123', 'text');
  
  const orderAggregate = AggregateBuilder
    .create({ id: orderId, version: 0 })
    .withVersioning()
    .build(OrderAggregate);

  return orderAggregate;
}

// Setup versioning with upcasters
function setupEventVersioning() {
  const order = createOrderWithVersioning();
  const versioningCap = order.getCapability(VersioningCapability);
  
  if (!versioningCap) {
    throw new Error('Versioning capability not available');
  }

  // Register upcasters for OrderCreated event
  versioningCap.registerUpcaster(
    'OrderCreated',
    1, // From version 1
    new OrderCreatedV1ToV2Upcaster()
  );

  versioningCap.registerUpcaster(
    'OrderCreated',
    2, // From version 2
    new OrderCreatedV2ToV3Upcaster()
  );

  return { order, versioningCap };
}

// Demonstrate versioned event handling
function demonstrateVersionedEventHandling() {
  const { order, versioningCap } = setupEventVersioning();

  // Create event handlers map
  const eventHandlers = new Map([
    ['OrderCreated', (payload: OrderCreatedEventV3, metadata?: unknown) => {
      // This handler expects V3 format
      console.log('Handling OrderCreated V3:', {
        orderId: payload.orderId,
        customer: payload.customer,
        itemCount: payload.items.length,
        total: payload.totalAmount,
        discount: payload.discountAmount
      });
      
      // Apply to aggregate
      (order as any).onOrderCreatedV3(payload);
    }]
  ]);

  // Simulate processing old V1 event
  const oldEventV1 = {
    eventType: 'OrderCreated',
    payload: {
      orderId: 'order-123',
      customerId: 'customer-456',
      items: [
        { productId: 'product-1', quantity: 2 },
        { productId: 'product-2', quantity: 1 }
      ]
    } as OrderCreatedEventV1,
    metadata: {
      version: 1,
      targetVersion: 3, // Want to upcast to V3
      eventId: 'event-1',
      timestamp: new Date('2023-01-01')
    }
  };

  // Process versioned event (will be upcasted V1 -> V2 -> V3)
  versioningCap.handleVersionedEvent(oldEventV1, eventHandlers);

  // Simulate processing V2 event
  const eventV2 = {
    eventType: 'OrderCreated',
    payload: {
      orderId: 'order-124',
      customerId: 'customer-789',
      items: [
        { productId: 'product-3', quantity: 1, price: 25.00 }
      ],
      totalAmount: 25.00
    } as OrderCreatedEventV2,
    metadata: {
      version: 2,
      targetVersion: 3, // Want to upcast to V3
      eventId: 'event-2',
      timestamp: new Date('2023-06-01')
    }
  };

  // Process V2 event (will be upcasted V2 -> V3)
  versioningCap.handleVersionedEvent(eventV2, eventHandlers);

  return order;
}

// Advanced versioning features
function demonstrateAdvancedVersioning() {
  const { order, versioningCap } = setupEventVersioning();

  // Check what event types have upcasters
  const registeredTypes = versioningCap.getRegisteredEventTypes();
  console.log('Events with upcasters:', registeredTypes);

  // Check if specific upcaster exists
  const hasV1Upcaster = versioningCap.hasUpcaster('OrderCreated', 1);
  const hasV2Upcaster = versioningCap.hasUpcaster('OrderCreated', 2);
  
  console.log('Upcaster availability:', {
    v1ToV2: hasV1Upcaster,
    v2ToV3: hasV2Upcaster
  });

  // Get all upcasters for an event type
  const orderCreatedUpcasters = versioningCap.getUpcastersForType('OrderCreated');
  console.log('OrderCreated upcasters:', orderCreatedUpcasters?.size);

  // Get total number of registered upcasters
  const totalUpcasters = versioningCap.getTotalUpcasterCount();
  console.log('Total upcasters registered:', totalUpcasters);

  return order;
}

// Error handling with versioning
function handleVersioningErrors() {
  const { order, versioningCap } = setupEventVersioning();

  // Try to register duplicate upcaster
  try {
    versioningCap.registerUpcaster(
      'OrderCreated',
      1, // Same version as existing
      new OrderCreatedV1ToV2Upcaster()
    );
  } catch (error) {
    console.log('Duplicate upcaster registration failed:', error.message);
  }

  // Handle missing upcaster scenario
  const eventWithMissingUpcaster = {
    eventType: 'CustomerUpdated', // No upcasters registered
    payload: { /* some data */ },
    metadata: {
      version: 1,
      targetVersion: 2
    }
  };

  const eventHandlers = new Map([
    ['CustomerUpdated', (payload: unknown) => {
      console.log('Handling CustomerUpdated:', payload);
    }]
  ]);

  // This will process without upcasting (no upcaster available)
  versioningCap.handleVersionedEvent(eventWithMissingUpcaster, eventHandlers);
}

// Complex upcasting chain
function demonstrateComplexUpcasting() {
  const { order, versioningCap } = setupEventVersioning();

  // V1 event that needs to go through multiple upcasters
  const veryOldEvent = {
    eventType: 'OrderCreated',
    payload: {
      orderId: 'order-999',
      customerId: 'customer-old',
      items: [{ productId: 'legacy-product', quantity: 5 }]
    } as OrderCreatedEventV1,
    metadata: {
      version: 1,
      targetVersion: 3, // Will upcast V1 -> V2 -> V3
      eventId: 'legacy-event',
      timestamp: new Date('2022-01-01')
    }
  };

  const eventHandlers = new Map([
    ['OrderCreated', (payload: OrderCreatedEventV3) => {
      console.log('Successfully processed legacy event:', {
        orderId: payload.orderId,
        customer: payload.customer,
        upgradeChain: 'V1 -> V2 -> V3'
      });
    }]
  ]);

  versioningCap.handleVersionedEvent(veryOldEvent, eventHandlers);
}
```

@extract-end

## Key Features

- **Event Schema Evolution**: Handle changes to event structure over time
- **Automatic Upcasting**: Transform old events to new formats transparently
- **Chain Upcasting**: Support multiple version jumps (V1 -> V2 -> V3)
- **Upcaster Management**: Register, query, and manage upcasters
- **Backward Compatibility**: Process events from any supported version

## Common Pitfalls

- Register upcasters in the correct version order
- Ensure upcasted data maintains business logic integrity
- Test upcasting chains thoroughly with real historical data
- Consider performance impact of complex upcasting chains

## Related Examples

- [AggregateRoot](./aggregate-root.md) - Basic aggregate implementation
- [EventSourcingCapability](./event-sourcing-capability.md) - Event sourcing integration
