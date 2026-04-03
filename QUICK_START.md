# Quick Start — @vytches/ddd

Build your first DDD aggregate in under 5 minutes.

## Install

```bash
npm install @vytches/ddd    # meta-package, re-exports everything
```

Or install only what you need:

```bash
npm install @vytches/ddd-aggregates @vytches/ddd-events @vytches/ddd-validation
```

## 1. Define Domain Events

```typescript
import { DomainEvent } from '@vytches/ddd';

interface OrderCreatedPayload {
  readonly customerId: string;
}

interface ItemAddedPayload {
  readonly sku: string;
  readonly name: string;
  readonly price: number;
  readonly qty: number;
}

class OrderCreated extends DomainEvent<OrderCreatedPayload> {
  constructor(payload: OrderCreatedPayload) {
    super(payload);
  }
}

class ItemAdded extends DomainEvent<ItemAddedPayload> {
  constructor(payload: ItemAddedPayload) {
    super(payload);
  }
}
```

## 2. Create a Value Object

```typescript
import { BaseValueObject } from '@vytches/ddd';

interface MoneyProps {
  readonly amount: number;
  readonly currency: string;
}

class Money extends BaseValueObject<MoneyProps> {
  static create(amount: number, currency: string): Money {
    const vo = new Money({ amount, currency });
    if (!vo.validate({ amount, currency })) {
      throw new Error(`Invalid money: amount=${amount}, currency=${currency}`);
    }
    return vo;
  }

  validate(value: unknown): boolean {
    const props = value as MoneyProps;
    return typeof props.amount === 'number' && props.amount >= 0;
  }

  add(other: Money): Money {
    return Money.create(
      this.getValue().amount + other.getValue().amount,
      this.getValue().currency
    );
  }
}
```

## 3. Write Inline Specifications

Prefer `Specification.create()` over class-based specs for one-off rules.

```typescript
import { Specification } from '@vytches/ddd';

interface OrderState {
  items: ReadonlyArray<{ sku: string; qty: number; price: number }>;
  placed: boolean;
}

const hasItems = Specification.create<OrderState>(o => o.items.length > 0);
const isNotPlaced = Specification.create<OrderState>(o => !o.placed);
const canBePlaced = hasItems.and(isNotPlaced);
```

## 4. Build the Aggregate

```typescript
import { AggregateRoot, EntityId } from '@vytches/ddd';

class Order extends AggregateRoot<string> {
  private customerId = '';
  private items: { sku: string; name: string; price: number; qty: number }[] =
    [];
  private placed = false;

  constructor() {
    super({ id: EntityId.create(), version: 0 });

    // Register event handlers — these rebuild state from history
    this.registerEventHandler<OrderCreatedPayload>('OrderCreated', payload => {
      this.customerId = payload.customerId;
    });

    this.registerEventHandler<ItemAddedPayload>('ItemAdded', payload => {
      this.items = [...this.items, payload];
    });
  }

  // Commands emit events — never mutate state directly
  create(customerId: string): void {
    this.apply(new OrderCreated({ customerId }));
  }

  addItem(sku: string, name: string, price: number, qty: number): void {
    Money.create(price, 'USD'); // validates
    this.apply(new ItemAdded({ sku, name, price, qty }));
  }

  place(): void {
    if (
      !canBePlaced.isSatisfiedBy({ items: this.items, placed: this.placed })
    ) {
      throw new Error('Cannot place order');
    }
    // emit OrderPlaced event...
  }
}
```

## 5. Use It

```typescript
const order = new Order();
order.create('customer-1');
order.addItem('SKU-001', 'Widget', 29.99, 2);
order.place();

// Retrieve uncommitted events for persistence
const events = order.getDomainEvents();
order.commit(); // clear after saving
```

## AI Assistant Integration

Set up LLM-optimized docs for your coding assistant (Claude Code, Cursor,
Copilot):

```bash
npx @vytches/ddd init-context
```

This copies architecture overview, full API reference, and anti-patterns to
`.claude/vytches-ddd/`. Then add to your `CLAUDE.md`:

```
@.claude/vytches-ddd/llm-context.md
```

## Full Working Example

See [`examples/quickstart/`](./examples/quickstart/) for a complete e-commerce
Order domain with:

- Event-sourced aggregate with 4 commands
- Value object with validation
- Inline specifications
- Command and query handlers
- In-memory repository
- 16 passing tests (GWT pattern)

```bash
cd examples/quickstart && pnpm test
```

## Next Steps

- [Full API Reference](./docs/llm-context.md) — every export, every package
- [Package Ecosystem](./README.md#-package-ecosystem) — 21 packages overview
- Per-package guides in `node_modules/@vytches/ddd-*/LLMGUIDE.md`
