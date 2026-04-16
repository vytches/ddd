# @vytches/ddd Quickstart Example

A minimal but complete DDD example using @vytches/ddd — an e-commerce Order
domain with aggregates, value objects, domain events, inline specifications, and
CQRS.

## What This Example Demonstrates

| Pattern                   | Implementation                                                              |
| ------------------------- | --------------------------------------------------------------------------- |
| **Aggregate Root**        | `Order` with event sourcing (`apply`, `loadFromHistory`, `getDomainEvents`) |
| **Value Object**          | `Money` (immutable, validated, composable via `.add()`)                     |
| **Domain Events**         | `OrderCreated`, `ItemAdded`, `OrderPlaced`, `OrderCancelled`                |
| **Inline Specifications** | `canBePlaced`, `canBeCancelled` via `Specification.create()`                |
| **Command Handlers**      | `handleCreateOrder`, `handlePlaceOrder`                                     |
| **Query Handlers**        | `handleGetOrder` returning a read-only `OrderView`                          |
| **Repository**            | `InMemoryOrderRepository` with event stream storage                         |
| **GWT Testing**           | `Test(factory).given().when().then()` aggregate tests                       |

## Project Structure

```
src/
  domain/
    order.aggregate.ts       # Aggregate with event handlers and business rules
    money.value-object.ts    # Immutable value object with validation
    events.ts                # Domain events (OrderCreated, ItemAdded, etc.)
    order.specs.ts           # Inline specifications using Specification.create()
  application/
    create-order.command.ts  # Create order + add items command handler
    place-order.command.ts   # Place order command handler
    get-order.query.ts       # Query handler returning OrderView
  infrastructure/
    in-memory-order.repository.ts  # Simple event-sourced repository
tests/
  order.aggregate.test.ts    # GWT aggregate tests (13 tests)
  order.integration.test.ts  # Full flow integration tests (3 tests)
```

## Run Tests

```bash
pnpm test
```

## Key Takeaways

### Inline Specifications (preferred over class-based)

```typescript
// One line instead of a 20-30 LOC class file
const hasItems = Specification.create<OrderState>(
  order => order.items.length > 0
);
const isNotPlaced = Specification.create<OrderState>(order => !order.placed);
const canBePlaced = hasItems.and(isNotPlaced);
```

### GWT Aggregate Testing

```typescript
Test(() => new Order())
  .given(new OrderCreated({ customerId: 'c1' }))
  .when(order => order.place())
  .thenError('ORDER_HAS_NO_ITEMS');
```

### Event-Sourced Aggregates

```typescript
class Order extends AggregateRoot<string> {
  constructor() {
    super({ id: EntityId.create(), version: 0 });
    // Register handlers that rebuild state from events
    this.registerEventHandler<OrderCreatedPayload>('OrderCreated', payload => {
      this.customerId = payload.customerId;
    });
  }

  place(): void {
    // Business logic + specification check
    if (!canBePlaced.isSatisfiedBy(this.getState())) { ... }
    // Emit event (not mutate state directly)
    this.apply(new OrderPlaced({ totalAmount, itemCount }));
  }
}
```
