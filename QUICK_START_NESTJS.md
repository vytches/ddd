# Quick Start — @vytches/ddd with NestJS

Wire up DDD aggregates, command handlers, query handlers, and ACL adapters in a
NestJS application.

> **Prerequisites**: Read the [base Quick Start](./QUICK_START.md) first — it
> covers aggregates, value objects, and events without any framework.

## Install

```bash
npm install @vytches/ddd @vytches/ddd-nestjs
# NestJS peer dependencies
npm install @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs
```

Or install individual packages:

```bash
npm install @vytches/ddd-aggregates @vytches/ddd-cqrs @vytches/ddd-events \
            @vytches/ddd-di @vytches/ddd-nestjs
```

## Required `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "CommonJS",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true
  }
}
```

Both decorator flags are **required**. Without `emitDecoratorMetadata`, NestJS
DI and handler auto-discovery will silently fail.

---

## 1. The Domain Layer (zero NestJS imports)

The aggregate knows nothing about the framework. It emits events via `apply()`
and exposes a `Result`-returning factory.

```typescript
// order.events.ts
import { DomainEvent } from '@vytches/ddd-events';

export class OrderCreated extends DomainEvent<{ customerId: string }> {
  constructor(payload: { customerId: string }) {
    super(payload);
  }
}

export class ItemAdded extends DomainEvent<{
  sku: string;
  price: number;
  qty: number;
}> {
  constructor(payload: { sku: string; price: number; qty: number }) {
    super(payload);
  }
}
```

```typescript
// order.aggregate.ts
import { AggregateRoot, EntityId } from '@vytches/ddd-aggregates';
import { Result } from '@vytches/ddd-utils';
import { OrderCreated, ItemAdded } from './order.events';

export class Order extends AggregateRoot<string> {
  private _customerId = '';
  private _items: { sku: string; price: number; qty: number }[] = [];

  private constructor(params: { id: string; version?: number }) {
    super({ id: EntityId.fromString(params.id), version: params.version ?? 0 });
  }

  /** Factory for new orders — emits OrderCreated */
  static create(customerId: string): Result<Order, Error> {
    if (!customerId) return Result.fail(new Error('customerId is required'));

    const order = new Order({ id: EntityId.create().toString() });
    order.apply(new OrderCreated({ customerId }));
    return Result.ok(order);
  }

  /** Reconstitute from persistence — no events emitted */
  static reconstitute(id: string, customerId: string, version: number): Order {
    const order = new Order({ id, version });
    order._customerId = customerId;
    return order;
  }

  addItem(sku: string, price: number, qty: number): Result<void, Error> {
    if (price <= 0) return Result.fail(new Error('price must be positive'));
    this.apply(new ItemAdded({ sku, price, qty }));
    return Result.ok(undefined);
  }

  get customerId(): string {
    return this._customerId;
  }
  get total(): number {
    return this._items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }
}
```

> **Note**: There is no `registerEventHandler()` in the aggregate. Domain events
> emitted with `apply()` are queued as uncommitted events. The repository
> dispatches them after persisting the aggregate.

---

## 2. Commands

```typescript
// commands/create-order.command.ts
import type { ICommand } from '@vytches/ddd-cqrs';

export class CreateOrderCommand implements ICommand {
  constructor(
    public readonly customerId: string,
    public readonly correlationId?: string
  ) {}
}
```

```typescript
// commands/add-item.command.ts
import type { ICommand } from '@vytches/ddd-cqrs';

export class AddItemCommand implements ICommand {
  constructor(
    public readonly orderId: string,
    public readonly sku: string,
    public readonly price: number,
    public readonly qty: number
  ) {}
}
```

---

## 3. Queries

`IQuery<TResult>` requires the result type as a type parameter:

```typescript
// queries/get-order.query.ts
import type { IQuery } from '@vytches/ddd-cqrs';
import type { OrderDto } from '../dtos/order.dto';

export class GetOrderQuery implements IQuery<OrderDto> {
  constructor(
    public readonly orderId: string,
    public readonly requestingUserId: string
  ) {}

  /** Factory method for self-access */
  static forUser(orderId: string, userId: string): GetOrderQuery {
    return new GetOrderQuery(orderId, userId);
  }
}
```

---

## 4. Command Handlers

```typescript
// commands/create-order.handler.ts
import { Injectable } from '@nestjs/common';
import { CommandHandler } from '@vytches/ddd-cqrs';
import type { ICommandHandler } from '@vytches/ddd-cqrs';
import { Result } from '@vytches/ddd-utils';
import { Order } from '../domain/order.aggregate';
import { CreateOrderCommand } from './create-order.command';
import { ORDER_REPOSITORY } from '../orders.tokens';
import type { IOrderRepository } from '../domain/order.repository';

@Injectable()
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler
  implements ICommandHandler<CreateOrderCommand, Result<string, Error>>
{
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orders: IOrderRepository
  ) {}

  async execute(command: CreateOrderCommand): Promise<Result<string, Error>> {
    const orderResult = Order.create(command.customerId);
    if (orderResult.isFailure) return Result.fail(orderResult.error);

    await this.orders.save(orderResult.value);
    return Result.ok(orderResult.value.id.toString());
  }
}
```

```typescript
// commands/add-item.handler.ts
import { Injectable } from '@nestjs/common';
import { CommandHandler } from '@vytches/ddd-cqrs';
import type { ICommandHandler } from '@vytches/ddd-cqrs';
import { Result } from '@vytches/ddd-utils';
import { AddItemCommand } from './add-item.command';

@Injectable()
@CommandHandler(AddItemCommand)
export class AddItemHandler
  implements ICommandHandler<AddItemCommand, Result<void, Error>>
{
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: IOrderRepository
  ) {}

  async execute(command: AddItemCommand): Promise<Result<void, Error>> {
    const order = await this.orders.findById(command.orderId);
    if (!order)
      return Result.fail(new Error(`Order ${command.orderId} not found`));

    const result = order.addItem(command.sku, command.price, command.qty);
    if (result.isFailure) return Result.fail(result.error);

    await this.orders.save(order);
    return Result.ok(undefined);
  }
}
```

---

## 5. Query Handler

```typescript
// queries/get-order.handler.ts
import { Injectable } from '@nestjs/common';
import { QueryHandler } from '@vytches/ddd-cqrs';
import type { IQueryHandler } from '@vytches/ddd-cqrs';
import { Result } from '@vytches/ddd-utils';
import { GetOrderQuery } from './get-order.query';
import type { OrderDto } from '../dtos/order.dto';

@Injectable()
@QueryHandler(GetOrderQuery)
export class GetOrderHandler
  implements IQueryHandler<GetOrderQuery, Result<OrderDto, Error>>
{
  constructor(
    @Inject(ORDER_QUERY_REPOSITORY)
    private readonly orderQueries: IOrderQueryRepository
  ) {}

  async execute(query: GetOrderQuery): Promise<Result<OrderDto, Error>> {
    const dto = await this.orderQueries.findById(query.orderId);
    if (!dto) return Result.fail(new Error(`Order ${query.orderId} not found`));
    return Result.ok(dto);
  }
}
```

---

## 6. Event Handlers

Use `@EventHandler` per method — one class can handle multiple events:

```typescript
// event-handlers/orders-audit.handler.ts
import { Injectable } from '@nestjs/common';
import { EventHandler } from '@vytches/ddd-events';
import { OrderCreated, ItemAdded } from '../domain/order.events';

@Injectable()
export class OrdersAuditHandler {
  @EventHandler(OrderCreated)
  async onOrderCreated(event: OrderCreated): Promise<void> {
    // audit log, projections, notifications, etc.
  }

  @EventHandler(ItemAdded)
  async onItemAdded(event: ItemAdded): Promise<void> {
    // ...
  }
}
```

> `@EventHandler` registers the method at discovery time. No
> `registerEventHandler()` calls anywhere — decorators are the registration.

---

## 7. Global DDD Module

Wire up the buses once, globally. All bounded context modules import this:

```typescript
// shared/ddd.module.ts
import { Global, Module, OnApplicationBootstrap, Inject } from '@nestjs/common';
import {
  VytchesDDDModule,
  VytchesExplorerService,
  NestJSContainerAdapter,
} from '@vytches/ddd-nestjs';
import {
  EnhancedCommandBus,
  EnhancedQueryBus,
  ICommandBus,
  IQueryBus,
} from '@vytches/ddd-cqrs';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { IEventBus } from '@vytches/ddd-contracts';
import { SimpleContainer } from '@vytches/ddd-di';

const container = new SimpleContainer();
const containerAdapter = new NestJSContainerAdapter(container);

@Global()
@Module({
  imports: [VytchesDDDModule.forRoot()],
  providers: [
    {
      provide: ICommandBus,
      useValue: new EnhancedCommandBus(containerAdapter),
    },
    {
      provide: IQueryBus,
      useValue: new EnhancedQueryBus(containerAdapter),
    },
    {
      provide: IEventBus,
      useClass: UnifiedEventBus,
    },
  ],
  exports: [VytchesExplorerService, ICommandBus, IQueryBus, IEventBus],
})
export class DDDModule implements OnApplicationBootstrap {
  constructor(
    @Inject(VytchesExplorerService)
    private readonly explorer: VytchesExplorerService
  ) {}

  /**
   * Discovery runs in onApplicationBootstrap — after all onModuleInit() hooks,
   * so all providers are guaranteed to be available.
   */
  async onApplicationBootstrap(): Promise<void> {
    const handlers = await this.explorer.discoverHandlers();
    for (const handler of handlers) {
      await this.explorer.registerHandler(handler);
    }
  }
}
```

---

## 8. Bounded Context Module

Each bounded context module lists its handlers as providers and registers its
ACL adapters in `onModuleInit()`:

```typescript
// orders/orders.module.ts
import { Module, OnModuleInit, Inject } from '@nestjs/common';
import { ACL_REGISTRY } from '@vytches/ddd-nestjs';
import type { ACLRegistry } from '@vytches/ddd-acl';

// Handlers
import { CreateOrderHandler } from './commands/create-order.handler';
import { AddItemHandler } from './commands/add-item.handler';
import { GetOrderHandler } from './queries/get-order.handler';
import { OrdersAuditHandler } from './event-handlers/orders-audit.handler';

// Infrastructure
import { OrdersContextApi } from './infrastructure/acl/orders-context.api';

@Module({
  providers: [
    // All handlers must be listed here for NestJS DI + auto-discovery
    CreateOrderHandler,
    AddItemHandler,
    GetOrderHandler,
    OrdersAuditHandler,

    // Repositories
    { provide: ORDER_REPOSITORY, useClass: OrderKyselyRepository },
    { provide: ORDER_QUERY_REPOSITORY, useClass: OrderQueryKyselyRepository },

    // ACL
    OrdersContextApi,
  ],
})
export class OrdersModule implements OnModuleInit {
  constructor(
    @Inject(ACL_REGISTRY) private readonly aclRegistry: ACLRegistry,
    @Inject(OrdersContextApi) private readonly ordersApi: OrdersContextApi
  ) {}

  onModuleInit(): void {
    // Register this context's API so other contexts can call it
    this.aclRegistry.registerGlobal(
      'orders',
      this.ordersApi,
      'Orders context public API'
    );
  }
}
```

---

## 9. Controller

```typescript
// orders/orders.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { CreateOrderCommand } from './commands/create-order.command';
import { AddItemCommand } from './commands/add-item.command';
import { GetOrderQuery } from './queries/get-order.query';
import type { OrderDto } from './dtos/order.dto';
import { Result } from '@vytches/ddd-utils';

@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(ICommandBus) private readonly commandBus: ICommandBus,
    @Inject(IQueryBus) private readonly queryBus: IQueryBus
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(
    @Body('customerId') customerId: string
  ): Promise<Result<string, Error>> {
    return this.commandBus.execute<CreateOrderCommand, Result<string, Error>>(
      new CreateOrderCommand(customerId)
    );
  }

  @Get(':id')
  async getOrder(
    @Param('id') orderId: string
  ): Promise<Result<OrderDto, Error>> {
    return this.queryBus.send<GetOrderQuery, Result<OrderDto, Error>>(
      GetOrderQuery.forUser(orderId, 'system')
    );
  }
}
```

---

## 10. Cross-context Calls via ACL Registry

When `OrdersModule` needs data from another bounded context:

```typescript
// orders/queries/get-order.handler.ts (extended)
import { ACL_REGISTRY } from '@vytches/ddd-nestjs';
import type { ACLRegistry } from '@vytches/ddd-acl';

@Injectable()
@QueryHandler(GetOrderQuery)
export class GetOrderHandler
  implements IQueryHandler<GetOrderQuery, Result<OrderDto, Error>>
{
  constructor(
    @Inject(ORDER_QUERY_REPOSITORY)
    private readonly orderQueries: IOrderQueryRepository,
    @Inject(ACL_REGISTRY) private readonly aclRegistry: ACLRegistry
  ) {}

  async execute(query: GetOrderQuery): Promise<Result<OrderDto, Error>> {
    // Call the payments context via ACL — no direct import
    const paymentsApi =
      this.aclRegistry.getGlobalRequired<IPaymentsApi>('payments');
    const paymentStatus = await paymentsApi.getStatusForOrder(query.orderId);

    const dto = await this.orderQueries.findById(query.orderId);
    if (!dto) return Result.fail(new Error('Order not found'));

    return Result.ok({ ...dto, paymentStatus });
  }
}
```

---

## 11. Testing

`VytchesDDDModule.forTesting()` provides stub buses — no container setup needed:

```typescript
// create-order.handler.spec.ts
import { Test } from '@nestjs/testing';
import { VytchesDDDModule } from '@vytches/ddd-nestjs';
import { ICommandBus } from '@vytches/ddd-cqrs';
import { CreateOrderHandler } from './create-order.handler';
import { CreateOrderCommand } from './create-order.command';

describe('CreateOrderHandler', () => {
  let handler: CreateOrderHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forTesting()],
      providers: [
        CreateOrderHandler,
        { provide: ORDER_REPOSITORY, useValue: { save: jest.fn() } },
      ],
    }).compile();

    handler = module.get(CreateOrderHandler);
  });

  it('creates an order', async () => {
    const result = await handler.execute(new CreateOrderCommand('customer-1'));
    expect(result.isSuccess).toBe(true);
    expect(typeof result.value).toBe('string');
  });
});
```

> Test handlers directly, not through the bus. The bus is tested separately.

---

## App Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { DDDModule } from './shared/ddd.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    DDDModule, // global: provides buses everywhere
    OrdersModule,
  ],
})
export class AppModule {}
```

---

## Key Patterns

| Pattern                  | How                                                                |
| ------------------------ | ------------------------------------------------------------------ |
| Aggregate emits events   | `this.apply(new MyEvent(payload))`                                 |
| Aggregate factory        | `static create(): Result<Aggregate, Error>`                        |
| Aggregate reconstitution | `static reconstitute(): Aggregate` (no events)                     |
| Register command handler | `@CommandHandler(MyCommand)` + listed in module `providers`        |
| Register query handler   | `@QueryHandler(MyQuery)` + listed in module `providers`            |
| Register event handler   | `@EventHandler(MyEvent)` on method + class in module `providers`   |
| `IQuery<T>` result type  | **Mandatory** — `implements IQuery<MyDto>`                         |
| Handler discovery        | Automatic via `VytchesExplorerService` in `onApplicationBootstrap` |
| Cross-context call       | `aclRegistry.getGlobalRequired<IApi>('context-name')`              |
| Register context API     | `aclRegistry.registerGlobal('key', api)` in `onModuleInit`         |

---

## AI-Assisted Development

### Setup (one command)

```bash
npx @vytches/ddd
```

Copies master context + per-package NestJS guides to `.claude/vytches-ddd/`.
Then add to your `CLAUDE.md` / `.cursorrules` / Copilot instructions:

```
@.claude/vytches-ddd/llm-context.md
@.claude/vytches-ddd/nestjs.md
```

Keep context fresh after `npm update`:

```bash
npx @vytches/ddd --verify  # shows what's outdated
npx @vytches/ddd           # re-copies updated guides
```

### Lightweight alternative (no command)

```
@./node_modules/@vytches/ddd-nestjs/LLMGUIDE.md
@./node_modules/@vytches/ddd-cqrs/LLMGUIDE.md
@./node_modules/@vytches/ddd-aggregates/LLMGUIDE.md
```

---

## Next Steps

- [Base Quick Start](./QUICK_START.md) — aggregates, value objects,
  specifications
- [ACL pattern](./packages/acl/README.md) — cross-context anti-corruption layer
- [Outbox pattern](./packages/messaging/README.md) — reliable event delivery
  with `OutboxProcessor`
- [ddd-lint](./tools/ddd-lint/CONSUMER-USAGE.md) — catch DDD anti-patterns
  automatically
