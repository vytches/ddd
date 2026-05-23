# @vytches/ddd - LLM Context

> This file provides complete context for AI code assistants to generate correct
> DDD code with @vytches/ddd.
>
> **Setup:** Run `npx @vytches/ddd init-context` to copy this file and
> per-package guides into your project's `.claude/vytches-ddd/` directory, then
> reference `@.claude/vytches-ddd/llm-context.md` in your CLAUDE.md.

## Installation

```bash
npm install @vytches/ddd   # meta-package, re-exports everything
# or install individual packages for smaller bundles:
npm install @vytches/ddd-aggregates @vytches/ddd-value-objects @vytches/ddd-validation
```

## Architecture Overview

Packages form an acyclic dependency graph — lower layers have no knowledge of
higher ones:

```
@vytches/ddd-contracts          — Foundation: interfaces only, zero dependencies
@vytches/ddd-domain-primitives  — Depends on: contracts
@vytches/ddd-value-objects      — Depends on: contracts, domain-primitives
@vytches/ddd-aggregates         — Depends on: contracts, value-objects
@vytches/ddd-validation         — Depends on: contracts, utils            (Specification + BusinessRuleValidator)
@vytches/ddd-events             — Depends on: contracts, domain-primitives (DomainEvent, IntegrationEvent, buses)
@vytches/ddd-cqrs               — Depends on: contracts, di               (CommandBus, QueryBus, decorators)
@vytches/ddd-repositories       — Depends on: contracts, domain-primitives (IBaseRepository, VersionError)
@vytches/ddd-policies           — Depends on: contracts, validation        (PolicyBuilder, PolicyRegistry)
@vytches/ddd-acl                — Depends on: contracts, utils             (ACLRegistry, BaseModelTranslator)
@vytches/ddd-enterprise         — Re-exports everything above
```

`@vytches/ddd` is the canonical single-package import. Use individual packages
only when bundle size matters.

---

## Quick Reference: Common Tasks

### Create a Value Object

```typescript
import { BaseValueObject } from '@vytches/ddd';

class Money extends BaseValueObject<number> {
  static create(amount: number): Money {
    const vo = new Money(amount);
    if (!vo.validate(amount)) throw new Error('Amount must be non-negative');
    return vo;
  }

  validate(value: unknown): boolean {
    return typeof value === 'number' && value >= 0;
  }

  add(other: Money): Money {
    return Money.create(this.getValue() + other.getValue());
  }
}

const price = Money.create(100);
price.getValue(); // 100
price.equals(Money.create(100)); // true
// Never mutate — always return new instances from operations
```

### Create an Aggregate Root

```typescript
import { AggregateRoot, EntityId } from '@vytches/ddd';
import type { IAggregateConstructorParams } from '@vytches/ddd';

interface OrderCreatedPayload {
  customerId: string;
  amount: number;
}
interface OrderPaidPayload {
  paidAt: string;
}

class Order extends AggregateRoot<string> {
  private customerId = '';
  private amount = 0;
  private status: 'draft' | 'paid' = 'draft';

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    // Register handlers BEFORE any apply() calls
    this.registerEventHandler<OrderCreatedPayload>('OrderCreated', payload => {
      this.customerId = payload!.customerId;
      this.amount = payload!.amount;
    });
    this.registerEventHandler<OrderPaidPayload>('OrderPaid', () => {
      this.status = 'paid';
    });
  }

  // Factory method — the only way to create a new Order
  static create(customerId: string, amount: number): Order {
    const order = new Order({ id: EntityId.create(), version: 0 });
    order.apply('OrderCreated', { customerId, amount });
    return order;
  }

  // Reconstitute from stored events (used by repository)
  static fromEvents(id: EntityId<string>, events: IDomainEvent[]): Order {
    const order = new Order({ id, version: 0 });
    order.loadFromHistory(events);
    return order;
  }

  pay(): void {
    if (this.status === 'paid') throw new Error('Already paid');
    this.apply('OrderPaid', { paidAt: new Date().toISOString() });
  }

  getAmount(): number {
    return this.amount;
  }
}

// Usage
const order = Order.create('customer-1', 500);
order.pay();
const events = order.getDomainEvents(); // uncommitted events
order.commit(); // clear after saving
```

### Create a Command and Handler

Handlers return `Result<TValue, TError>` — never throw on domain failures.

```typescript
import { CommandBus, CommandHandler } from '@vytches/ddd';
import type { ICommand, ICommandHandler } from '@vytches/ddd';
import { Result } from '@vytches/ddd';

// 1. Define the command (plain data object)
class PlaceOrderCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly amount: number
  ) {}
}

// 2. Implement the handler — Result<TValue, TError> return type
@CommandHandler(PlaceOrderCommand)
class PlaceOrderHandler
  implements ICommandHandler<PlaceOrderCommand, Result<string, Error>>
{
  constructor(private readonly orders: OrderRepository) {}

  async execute(command: PlaceOrderCommand): Promise<Result<string, Error>> {
    const orderResult = Order.create(command.customerId, command.amount);
    if (orderResult.isFailure) return Result.fail(orderResult.error);
    await this.orders.save(orderResult.value);
    return Result.ok(orderResult.value.getId().getValue());
  }
}

// 3. Wire up (without DI framework)
const bus = new CommandBus(container);
bus.register(PlaceOrderCommand, new PlaceOrderHandler(orderRepo));

const result = await bus.execute(new PlaceOrderCommand('c-1', 500));
// result is Result<string, Error> — check result.isSuccess before using result.value
```

> **With NestJS:** Use `@CommandHandler` + `@Injectable()` and list the handler
> in module `providers`. `VytchesExplorerService` registers it with the command
> bus automatically. See `QUICK_START_NESTJS.md` for the full wiring pattern.

### Create a Domain Event

```typescript
import { DomainEvent } from '@vytches/ddd';

interface OrderShippedPayload {
  orderId: string;
  trackingNumber: string;
  shippedAt: string;
}

class OrderShippedEvent extends DomainEvent<OrderShippedPayload> {
  constructor(payload: OrderShippedPayload) {
    super(payload);
    // eventName defaults to class name: 'OrderShippedEvent'
    // Override if class name may be mangled by minifiers:
    // super(payload, undefined, 'OrderShipped');
  }
}

// Register and publish via the event bus
bus.registerHandler(OrderShippedEvent, new OrderShippedHandler());
await bus.publish(
  new OrderShippedEvent({
    orderId: 'o-1',
    trackingNumber: 'TR-123',
    shippedAt: new Date().toISOString(),
  })
);
```

### Create an Inline Specification (PREFERRED)

Prefer `Specification.create` over class-based specs for all one-off or
module-local rules.

```typescript
import { Specification } from '@vytches/ddd';

interface Order {
  total: number;
  status: 'draft' | 'paid' | 'cancelled';
  customerId: string;
}

// Single inline spec
const isPositive = Specification.create<Order>(o => o.total > 0);
const isDraft = Specification.create<Order>(o => o.status === 'draft');

// Compose with static combinators (variadic AND/OR)
const canBePlaced = Specification.and(isPositive, isDraft);

canBePlaced.isSatisfiedBy({ total: 100, status: 'draft', customerId: 'c-1' }); // true
canBePlaced.isSatisfiedBy({ total: 0, status: 'draft', customerId: 'c-1' }); // false

// Fluent validator with error details
import { BusinessRuleValidator } from '@vytches/ddd';

const validator = BusinessRuleValidator.create<Order>()
  .addRule('total', o => o.total > 0, 'Total must be positive')
  .addRule(
    'status',
    o => o.status !== 'cancelled',
    'Cannot place cancelled order'
  );

const result = validator.validate(order);
if (result.isFailure) {
  result.error.errors.forEach(e => console.error(e.property, e.message));
}
```

### Create a Class-Based Specification (reusable/named)

Only use `CompositeSpecification` when the spec is complex, has injected
dependencies, or is exported for reuse across modules.

```typescript
import { CompositeSpecification } from '@vytches/ddd';

class MinimumOrderSpec extends CompositeSpecification<Order> {
  constructor(private readonly minimum: number) {
    super();
  }

  isSatisfiedBy(order: Order): boolean {
    return order.total >= this.minimum;
  }
}

const policy = new MinimumOrderSpec(50).and(isDraft);
policy.isSatisfiedBy(order); // boolean
```

### Create a Repository

```typescript
import { IBaseRepository, VersionError } from '@vytches/ddd';
import type {
  IEnhancedEventDispatcher,
  IEventPersistenceHandler,
} from '@vytches/ddd';

class OrderRepository extends IBaseRepository {
  constructor(
    dispatcher: IEnhancedEventDispatcher,
    handler: IEventPersistenceHandler,
    private readonly db: Database
  ) {
    super(dispatcher, handler);
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.orders.findOne({ id });
    return row ? Order.reconstitute(row) : null;
  }
}

// Usage: save raises events and enforces optimistic locking
try {
  await repo.save(order);
} catch (err) {
  if (err instanceof VersionError) {
    // Reload and retry — concurrent modification was detected
  }
}
```

### Create a Policy

Use `PolicyBuilder` for rules that require user/tenant context beyond what a
pure Specification can express.

```typescript
import {
  PolicyBuilder,
  PolicyRequestFactory,
  PolicyViolation,
} from '@vytches/ddd';
import { Specification } from '@vytches/ddd';

const orderPolicy = PolicyBuilder.create<Order>()
  .withId('order-placement')
  .withDomain('ordering')
  .withName('Order Placement Policy')
  .must(Specification.create<Order>(o => o.total > 0))
  .withErrorCode('INVALID_TOTAL')
  .withMessage('Order total must be positive')
  .must(Specification.create<Order>(o => o.status === 'draft'))
  .withErrorCode('WRONG_STATUS')
  .withMessage('Only draft orders can be placed')
  .build();

const request = PolicyRequestFactory.minimal(order, userId);
const result = await orderPolicy.check(request);

if (result.isFailure) {
  const violation: PolicyViolation = result.error;
  throw new Error(`${violation.code}: ${violation.message}`);
}
```

### Create an ACL Adapter (Anti-Corruption Layer)

```typescript
import {
  SimpleACLAdapter,
  BaseModelTranslator,
  ACLRegistry,
} from '@vytches/ddd';

// Translator isolates external types from domain types
class UserTranslator extends BaseModelTranslator<DomainUser, ExternalUser> {
  constructor() {
    super('UserContext');
  }

  protected performToExternalTranslation(domain: DomainUser): ExternalUser {
    return { user_id: domain.id.getValue(), email: domain.email.value };
  }

  protected performFromExternalTranslation(ext: ExternalUser): DomainUser {
    return DomainUser.reconstitute(ext.user_id, ext.email);
  }
}

const adapter = SimpleACLAdapter.create(
  'UserContext',
  'LegacyUserService',
  new UserTranslator(),
  new LegacyUserAPI(),
  ['create', 'update']
);

const registry = new ACLRegistry();
registry.registerDirect('UserContext', adapter);

const result = await registry
  .getRequired<DomainUser, ExternalUser>('UserContext')
  .execute('create', domainUser);
```

---

## Package-by-Package API Reference

### @vytches/ddd-contracts

Foundation. Zero dependencies. Every package depends on this.

| Export                                      | Description                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `IDomainEvent<P>`                           | Base event interface: `eventName`, `payload?`, `metadata?`                            |
| `IEventMetadata`                            | Tracing: `eventId`, `correlationId`, `causationId`, `aggregateId`, `aggregateVersion` |
| `IEventBus<T>`                              | Abstract class / DI token: `publish`, `subscribe`, `registerHandler`, `publishMany`   |
| `IEntityId<T>`                              | Typed identifier: `getValue()`, `equals()`, `toString()`, `isType()`                  |
| `EntityId<T>`                               | Base implementation (prefer value-objects' `EntityId` in application code)            |
| `IRepository<T>` / `IExtendedRepository<T>` | CRUD persistence contracts                                                            |
| `IUnitOfWork`                               | Transaction: `begin`, `commit`, `rollback`, `getRepository`                           |
| `ISpecification<T>`                         | `isSatisfiedBy`, `and`, `or`, `not`, `explainFailure?`                                |
| `IAsyncSpecification<T>`                    | Async version with optional `context` parameter                                       |
| `Capability` / `CapabilityRegistry`         | Base for aggregate capabilities                                                       |

### @vytches/ddd-value-objects

Immutable value holders and validated identifiers.

| Export                    | Description                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `BaseValueObject<T>`      | Immutable base: `getValue()`, `equals()`, `toString()`, `toJSON()`, abstract `validate()` |
| `EntityId.create()`       | New random-UUID `EntityId<string>`                                                        |
| `EntityId.fromUUID(v)`    | Parse and validate UUID                                                                   |
| `EntityId.fromInteger(v)` | Validate non-negative integer, stored as string                                           |
| `EntityId.fromBigInt(v)`  | Accepts native bigint or string representation                                            |
| `EntityId.fromText(v)`    | Non-empty text with safe characters                                                       |

```typescript
import { BaseValueObject, EntityId } from '@vytches/ddd';

class EmailAddress extends BaseValueObject<string> {
  static create(raw: string): EmailAddress {
    const vo = new EmailAddress(raw.toLowerCase().trim());
    if (!vo.validate(raw)) throw new Error(`Invalid email: ${raw}`);
    return vo;
  }
  validate(v: unknown): boolean {
    return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
}
```

### @vytches/ddd-aggregates

Event-sourced aggregate base class and optional capability system.

| Export                           | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `AggregateRoot<TId>`             | Base aggregate: version, events, capabilities |
| `AggregateBuilder<TId>`          | Fluent builder for capabilities               |
| `SnapshotCapability`             | Snapshot creation and restoration             |
| `AuditCapability`                | Audit log attached to every event             |
| `VersioningCapability`           | Event upcasters for schema evolution          |
| `EventSourcingCapability`        | Integrates with `IEventStore`                 |
| `asSnapshotAggregate(agg)`       | Type-safe cast; throws if capability absent   |
| `hasAllCapabilities(agg, [...])` | Capability presence check                     |

```typescript
// Builder with capabilities
const order = AggregateBuilder.create({ id: EntityId.create() })
  .withSnapshots()
  .withAudit()
  .build(Order);
```

### @vytches/ddd-validation

Specification pattern and fluent validator. The primary domain rule toolkit.

| Export                                    | Description                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `Specification.create<T>(predicate)`      | Inline spec from lambda — **use this first**                                  |
| `Specification.and<T>(...specs)`          | Variadic AND combinator                                                       |
| `Specification.or<T>(...specs)`           | Variadic OR combinator                                                        |
| `Specification.not<T>(spec)`              | Negate                                                                        |
| `Specification.propertyEquals/In/Between` | Property convenience specs                                                    |
| `CompositeSpecification<T>`               | Base class for named, reusable specs                                          |
| `AsyncCompositeSpecification<T>`          | Async base; `.create(predicate, name?, desc?)` static factory                 |
| `BusinessRuleValidator<T>`                | Fluent: `addRule`, `when`, `addNested`; returns `Result<T, ValidationErrors>` |

### @vytches/ddd-events

Concrete event classes and event buses.

| Export                                | Description                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `DomainEvent<T>`                      | Auto-generates `eventId`, `occurredOn`, `eventName`; `withMetadata(partial)` |
| `IntegrationEvent<T>`                 | Cross-context; `serialize()` / static `deserialize()`; `schemaVersion`       |
| `UnifiedEventBus`                     | Handles domain, integration, and audit events; `registerHandler`, `publish`  |
| `EventHandler(EventClass)`            | Decorator for handler auto-discovery                                         |
| `DomainToIntegrationTransformer<D,I>` | Abstract; override `transform()` to translate domain → integration           |
| `IDomainEventBus`                     | Type alias for `IEventBus<IDomainEvent>` — use as dependency type            |

```typescript
// Cross-context translation
class OrderPlacedTransformer extends DomainToIntegrationTransformer<
  OrderPlacedPayload,
  OrderCreatedIntegrationPayload
> {
  constructor() {
    super('orders');
  }
  protected transform(
    event: IDomainEvent<OrderPlacedPayload>
  ): OrderCreatedIntegration {
    return new OrderCreatedIntegration({
      id: event.payload!.orderId,
      totalAmount: event.payload!.amount,
    });
  }
}
```

### @vytches/ddd-cqrs

Command/query buses with middleware and decorator-based handler registration.

| Export                                    | Description                                                  |
| ----------------------------------------- | ------------------------------------------------------------ |
| `CommandBus` / `QueryBus`                 | Route to handlers; `register`, `use` (middleware), `execute` |
| `ICommandBus` / `IQueryBus`               | Abstract DI tokens                                           |
| `CommandHandler(CmdClass)`                | Decorator; stores metadata for auto-discovery                |
| `QueryHandler(QueryClass)`                | Decorator                                                    |
| `EnhancedCommandBus` / `EnhancedQueryBus` | Adds circuit breaker, retry, timeout, bulkhead               |
| `LoggingMiddleware`                       | Built-in execution-time logging middleware                   |
| `CQRSDiscoveryPlugin`                     | Auto-registers decorated handlers from DI container          |
| `HandlerNotFoundError`                    | Thrown when no handler is registered                         |

### @vytches/ddd-repositories

Write-side aggregate persistence with optimistic locking and event dispatch.

| Export            | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| `IBaseRepository` | Abstract class: implement `findById`; `save` handles events + version check     |
| `VersionError`    | Thrown on version mismatch; `VersionError.withEntityIdAndVersions(id, db, new)` |
| `IUnitOfWork`     | Re-exported from contracts; use for multi-aggregate transactions                |

### @vytches/ddd-policies

Context-aware business policies for rules that need user/tenant/environment
data.

| Export                                         | Description                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `PolicyBuilder.create<T>()`                    | Fluent builder; requires `.withId()`, `.withDomain()`, `.withName()` |
| `PolicyBuilder.must(spec)`                     | Required rule (ERROR severity)                                       |
| `PolicyBuilder.should(spec)`                   | Optional rule (WARNING; does not fail the policy)                    |
| `BaseBusinessPolicy<T>`                        | Abstract class for dependency-injected policies                      |
| `PolicyViolation`                              | `code`, `message`, `severity`, `policyId`, `domain`                  |
| `PolicyRegistry`                               | `register`, `resolve`, `findByTags`                                  |
| `PolicyRequestFactory.minimal(entity, userId)` | Quick request construction                                           |
| `PolicyRequestFactory.webRequest(opts)`        | Web context with IP, session                                         |

### @vytches/ddd-acl

Anti-Corruption Layer: keeps external concepts out of domain code.

| Export                                         | Description                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ACLRegistry`                                  | Singleton registry: `registerDirect`, `getRequired`, `importFromContext`                         |
| `SimpleACLAdapter.create(...)`                 | Concrete adapter factory for simple integrations                                                 |
| `BaseACLAdapter<D,E,R>`                        | Abstract base; implement `registerSupportedOperations()`                                         |
| `BaseModelTranslator<D,E>`                     | Abstract translator; implement `performToExternalTranslation` + `performFromExternalTranslation` |
| `ContextACLRegistry`                           | Per-bounded-context registry; export to global via `importFromContext`                           |
| `ACLError.operationFailed(context, op, cause)` | Standard ACL error factory                                                                       |

---

## Critical Anti-Patterns (DO NOT)

**Mutate aggregate state directly.** `this.status = 'paid'` bypasses event
recording. All state changes must go through `apply()`.

**Call `apply()` before `registerEventHandler()` in the constructor** (when
using event-sourced aggregates). Handlers must be registered first. Events
applied before their handler silently leave state un-updated. Note:
`registerEventHandler` is only needed for event-sourced aggregates that use
`loadFromHistory()`. If your repository reconstitutes state from a relational DB
(e.g., via `reconstitute()` static method), you do not need
`registerEventHandler`.

**Forget `loadFromHistory` in event-sourced reconstitution.** Repositories that
reload event-sourced aggregates must call `loadFromHistory(events)`, not the
static `create()` factory. Using `create()` fires events again.

**Make value objects mutable.** `BaseValueObject.value` is `readonly`. All
operations must return new instances (`Money.create(a + b)`), never modify in
place.

**Use `new EntityId(value, type)` directly.** The base constructor skips
validation. Always use static factories: `EntityId.create()`,
`EntityId.fromUUID()`, etc.

**Use `EntityIdFactory` (deprecated).** Replace all uses with `EntityId` static
methods.

**Use `AsyncCompositeSpecification` when no I/O is needed.** Async composition
is slower and complicates the call site. Keep specs sync unless they actually
await something.

**Create a class for a one-off spec.**

```typescript
// Wrong: unnecessary class
class IsActiveSpec extends CompositeSpecification<User> {
  isSatisfiedBy(u: User) {
    return u.isActive;
  }
}
// Correct: inline
const isActive = Specification.create<User>(u => u.isActive);
```

**Return full aggregates from command handlers.** Commands should return a
minimal result (an ID at most). Full aggregate reads belong in query handlers.

**Couple domain code to `UnifiedEventBus`.** Domain code should depend on
`IDomainEventBus` (the type alias), not the concrete class.

**Publish `DomainEvent` directly to a message broker.** Use
`DomainToIntegrationTransformer` to translate first — domain events are
internal; integration events cross boundaries.

**Pass external types into domain code.** All translation between external DTOs
and domain types must happen inside `BaseModelTranslator`, never inside
aggregates or domain services.

**Call `PolicyBuilder.build()` without all three required calls.** `.withId()`,
`.withDomain()`, and `.withName()` are all required; `build()` throws
synchronously if any are missing.

**Ignore `result.isFailure` after `policy.check()` or `validator.validate()`.**
Both return `Result<T, ...>`, not a thrown exception. Skipping the check
silently allows invalid operations to proceed.

**Create a new `ACLRegistry` per request.** `ACLRegistry` must be an
application-scoped singleton. Per-request instances discard all adapter
registrations.

---

## NestJS Integration

For production NestJS usage, see `QUICK_START_NESTJS.md`. Key differences from
standalone use:

### Handler decorators and discovery

```typescript
// Command handler — @Injectable() is required alongside @CommandHandler
@Injectable()
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler
  implements ICommandHandler<CreateOrderCommand, Result<string, Error>>
{
  async execute(command: CreateOrderCommand): Promise<Result<string, Error>> { ... }
}

// Query — IQuery<TResult> result type is MANDATORY
export class GetOrderQuery implements IQuery<OrderDto> {
  constructor(public readonly orderId: string) {}
}

// Event handler — method decorator, one class handles multiple events
@Injectable()
export class OrdersAuditHandler {
  @EventHandler(OrderCreated)   // class reference, NOT string
  async onOrderCreated(event: OrderCreated): Promise<void> { ... }

  @EventHandler(ItemAdded)
  async onItemAdded(event: ItemAdded): Promise<void> { ... }
}
```

### Discovery timing

`VytchesExplorerService` discovers and registers handlers during
`onApplicationBootstrap()` — after all `onModuleInit()` hooks. ACL registrations
must still happen in `onModuleInit()`.

```typescript
// Global DDD module — handler registration
export class DDDModule implements OnApplicationBootstrap {
  async onApplicationBootstrap(): Promise<void> {
    const handlers = await this.explorer.discoverHandlers();
    for (const handler of handlers)
      await this.explorer.registerHandler(handler);
  }
}

// Bounded context module — ACL registration
export class OrdersModule implements OnModuleInit {
  onModuleInit(): void {
    this.aclRegistry.registerGlobal('orders', this.ordersApi);
  }
}
```

### Cross-context calls

```typescript
// Call another bounded context via ACL — no direct module import
const paymentsApi =
  this.aclRegistry.getGlobalRequired<IPaymentsApi>('payments');
const status = await paymentsApi.getStatusForOrder(orderId);
```

---

## Import Map

All symbols are available from `@vytches/ddd`. The table below shows which
package they come from — useful when using individual packages or when
diagnosing naming conflicts.

| Symbol                                                                                                                                                                                                                                                         | Source package                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `IDomainEvent`, `ISpecification`, `IEntityId`, `IEventBus`, `IUnitOfWork`, `Capability`, `CapabilityRegistry`                                                                                                                                                  | `@vytches/ddd-contracts`                                                            |
| `BaseEntityId`                                                                                                                                                                                                                                                 | `@vytches/ddd-contracts` (aliased to avoid conflict with value-objects' `EntityId`) |
| `BaseValueObject`, `EntityId`, `EntityIdFactory` (deprecated)                                                                                                                                                                                                  | `@vytches/ddd-value-objects`                                                        |
| `AggregateRoot`, `AggregateBuilder`, `SnapshotCapability`, `AuditCapability`, `VersioningCapability`, `EventSourcingCapability`, `AggregateError`, `IAggregateRoot`                                                                                            | `@vytches/ddd-aggregates`                                                           |
| `Specification`, `CompositeSpecification`, `AsyncCompositeSpecification`, `BusinessRuleValidator`, `ValidationError`, `ValidationErrors`                                                                                                                       | `@vytches/ddd-validation`                                                           |
| `DomainEvent`, `IntegrationEvent`, `UnifiedEventBus`, `BaseEventBus`, `EventHandler`, `DomainToIntegrationTransformer`, `EventDiscoveryPlugin`, `UniversalEventDispatcher`, `IDomainEventBus`, `IIntegrationEventBus`                                          | `@vytches/ddd-events`                                                               |
| `CommandBus`, `QueryBus`, `ICommandBus`, `IQueryBus`, `CommandHandler`, `QueryHandler`, `EnhancedCommandBus`, `EnhancedQueryBus`, `LoggingMiddleware`, `CQRSDiscoveryPlugin`, `HandlerNotFoundError`, `ICommand`, `ICommandHandler`, `IQuery`, `IQueryHandler` | `@vytches/ddd-cqrs`                                                                 |
| `IBaseRepository`, `VersionError`, `IRepository`, `IExtendedRepository`                                                                                                                                                                                        | `@vytches/ddd-repositories`                                                         |
| `PolicyBuilder`, `BaseBusinessPolicy`, `PolicyViolation`, `PolicyRegistry`, `PolicyRequestFactory`, `PolicyRequestBuilder`, `PolicyEventBus`                                                                                                                   | `@vytches/ddd-policies`                                                             |
| `ACLRegistry`, `SimpleACLAdapter`, `BaseACLAdapter`, `BaseModelTranslator`, `ContextACLRegistry`, `ACLError`                                                                                                                                                   | `@vytches/ddd-acl`                                                                  |
| `Result`, `safeRun`                                                                                                                                                                                                                                            | `@vytches/ddd-utils`                                                                |

### Naming conflicts resolved in `@vytches/ddd`

| Conflict           | Resolution                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `EntityId`         | Value-objects version is primary (`EntityId`); contracts version exported as `BaseEntityId` |
| `ValidationError`  | Domain-primitives version is primary; CQRS variant exported as `CqrsValidationError`        |
| `ExecutionContext` | CQRS version is primary                                                                     |
