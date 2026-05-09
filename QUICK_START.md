# Quick Start — @vytches/ddd

Build your first DDD aggregate in under 5 minutes.

## Zero-install — try in your browser

The repo's [`.stackblitzrc`](./.stackblitzrc) launches the
[`examples/quickstart`](./examples/quickstart) tests on boot:

[**▶ Open in StackBlitz**](https://stackblitz.com/github/vytches/ddd?file=examples/quickstart/src/domain/order.aggregate.ts)

Click → wait for `pnpm install` (about 30s) → terminal automatically runs
`pnpm test` from `examples/quickstart`. You'll see 16 passing tests in ~2
seconds. Edit any file in `src/` and tests re-run on save.

WebContainer-based — no local Node, no install, no setup.

## Install

```bash
npm install @vytches/ddd
```

Or install only what you need:

```bash
npm install @vytches/ddd-aggregates @vytches/ddd-events @vytches/ddd-policies
```

## Required `tsconfig.json` flags

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true
  }
}
```

The decorator flags are required for the CQRS / domain-services decorator
features. `strict: true` is strongly recommended — the library is built and
type-checked under strict mode.

## 1. Define a Domain Event

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
    if (amount < 0 || !currency) {
      throw new Error(`Invalid money: amount=${amount}, currency=${currency}`);
    }
    return new Money({ amount, currency });
  }

  add(other: Money): Money {
    return Money.create(
      this.getValue().amount + other.getValue().amount,
      this.getValue().currency
    );
  }
}
```

> **Note:** `BaseValueObject` deep-freezes `this.value` in the constructor (no
> manual `validate()` call needed inside the ctor). Validate inputs in your
> factory method before calling `new`.

## 3. Inline Specifications

For ad-hoc business rules, use `Specification.create()` from the validation
package — keeps logic close to the use site and composable.

```typescript
import { CompositeSpecification } from '@vytches/ddd-validation';

interface OrderState {
  items: ReadonlyArray<{ sku: string; qty: number; price: number }>;
  placed: boolean;
}

const hasItems = CompositeSpecification.create<OrderState>(
  o => o.items.length > 0
);
const isNotPlaced = CompositeSpecification.create<OrderState>(o => !o.placed);
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

    // Event handlers rebuild state from history (event sourcing)
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
    Money.create(price, 'USD'); // throws on invalid
    this.apply(new ItemAdded({ sku, name, price, qty }));
  }

  place(): void {
    if (
      !canBePlaced.isSatisfiedBy({ items: this.items, placed: this.placed })
    ) {
      throw new Error('Cannot place order — empty cart or already placed');
    }
    // emit OrderPlaced event...
  }
}
```

## 5. Use it

```typescript
const order = new Order();
order.create('customer-1');
order.addItem('SKU-001', 'Widget', 29.99, 2);
order.place();

// Retrieve uncommitted events for persistence
const events = order.getDomainEvents();
// ... after persisting, mark as committed:
order.commit(); // alternatively, BaseRepository does this automatically on save()
```

## AI-Assisted Development

Pair @vytches/ddd with Claude Code, Cursor, GitHub Copilot, or Aider.

### Lightweight setup (recommended)

In your `CLAUDE.md` / `.cursorrules` / Copilot instructions:

```
@./node_modules/@vytches/ddd-aggregates/LLMGUIDE.md
@./node_modules/@vytches/ddd-policies/LLMGUIDE.md
@./node_modules/@vytches/ddd-events/LLMGUIDE.md
```

Each package ships an `LLMGUIDE.md` with API table, working examples, and
anti-patterns — just enough context for an AI to scaffold correct code.

### Full library context

For deeper AI assistance, generate a single bundled context file:

```bash
git clone https://github.com/vytches/ddd && cd ddd
pnpm install
pnpm llm:bundle  # → repomix-output.md (~260K tokens)
```

Paste the resulting file into your AI's long-context window once. The assistant
can then generate aggregates, value objects, command handlers, and policies from
natural-language prompts.

## Full working example

See [`examples/quickstart/`](./examples/quickstart/) for a complete e-commerce
Order domain with:

- Event-sourced aggregate with 4 commands
- Value object with validation
- Inline specifications
- Command and query handlers
- In-memory repository
- 16 passing tests (Given-When-Then style)

```bash
cd examples/quickstart && pnpm test
```

More examples covering policies (8 patterns) and domain services (7 patterns):

- [`examples/policies/`](./examples/policies/) — 17 tests
- [`examples/domain-services/`](./examples/domain-services/) — 17 tests

## Next Steps

- [Package Ecosystem](./README.md#package-ecosystem) — 20 packages overview
- [Design Decisions](./README.md#design-decisions) — why no sagas, no adapters
- Per-package guides — `node_modules/@vytches/ddd-*/LLMGUIDE.md`
- ADRs — [`docs/adr/`](./docs/adr/) — architecture decisions of record
