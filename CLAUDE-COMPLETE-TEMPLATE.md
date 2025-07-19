# CLAUDE.md - Complete @vytches-ddd Template

## 🔥 CRITICAL: Using @vytches-ddd Library

**This project uses the @vytches-ddd Domain-Driven Design library. This file contains COMPLETE guidance for using ALL library features effectively with LLM assistance.**

---

## 📋 Table of Contents

1. [Core Import Strategy](#core-import-strategy)
2. [Foundation Layer](#foundation-layer)
3. [Domain Layer Patterns](#domain-layer-patterns)
4. [Application Layer (CQRS)](#application-layer-cqrs)
5. [Event-Driven Architecture](#event-driven-architecture)
6. [Business Policies & Validation](#business-policies--validation)
7. [Resilience Patterns](#resilience-patterns)
8. [Messaging & Sagas](#messaging--sagas)
9. [Event Store & Projections](#event-store--projections)
10. [Infrastructure Layer](#infrastructure-layer)
11. [Dependency Injection](#dependency-injection)
12. [Logging & Observability](#logging--observability)
13. [Testing Strategy](#testing-strategy)
14. [Enterprise Features](#enterprise-features)
15. [Performance & Security](#performance--security)
16. [Troubleshooting](#troubleshooting)

---

## 🎯 Core Import Strategy

### ✅ ALWAYS use meta-package imports for stable API

```typescript
// Foundation & Core
import { 
  AggregateRoot, 
  EntityId, 
  BaseError, 
  Entity, 
  ValueObject 
} from '@vytches-ddd/core';

// Logging & Observability
import { Logger } from '@vytches-ddd/logging';

// CQRS & Commands
import { 
  CommandBus, 
  QueryBus, 
  EventBus 
} from '@vytches-ddd/cqrs';

// Dependency Injection
import { 
  VytchesDDD, 
  DomainService, 
  CommandHandler,
  QueryHandler,
  EventHandler,
  ServiceLifetime 
} from '@vytches-ddd/di';

// Business Policies
import { 
  PolicyBuilder, 
  PolicyContext,
  PolicyGroup,
  PolicyRetryBehavior,
  PolicyCachingBehavior,
  PolicyTemporalBehavior
} from '@vytches-ddd/policies';

// Event Processing
import { 
  UnifiedEventBus,
  UniversalEventDispatcher 
} from '@vytches-ddd/events';

// Messaging & Sagas
import { 
  OutboxPattern,
  BaseSaga,
  SagaOrchestrator,
  InMemorySagaRepository,
  MessagePriority 
} from '@vytches-ddd/messaging';

// Resilience Patterns
import { 
  CircuitBreaker,
  RetryPolicy,
  Bulkhead,
  TimeoutStrategy,
  ResiliencePolicyBuilder 
} from '@vytches-ddd/resilience';

// Event Store & Projections
import { 
  EventStore,
  EventStream,
  ProjectionEngine,
  ProjectionCapabilities 
} from '@vytches-ddd/event-store';

// Testing & Utilities
import { 
  safeRun,
  Result,
  Maybe 
} from '@vytches-ddd/utils';

// Anti-Corruption Layer
import { 
  AntiCorruptionLayer,
  ExternalSystemAdapter 
} from '@vytches-ddd/acl';

// Validation & Specifications
import { 
  ISpecification,
  IAsyncSpecification,
  CompositeSpecification,
  ValidationFacade 
} from '@vytches-ddd/validation';
```

---

## 🏗️ Foundation Layer

### EntityId Best Practices

```typescript
// ✅ CORRECT: EntityId creation patterns
import { EntityId } from '@vytches-ddd/core';

// UUID generation (recommended)
const orderId = EntityId.generate();

// From existing string
const customerId = EntityId.from('customer-12345');

// Typed EntityId for domain safety
class OrderId extends EntityId {
  static generate(): OrderId {
    return new OrderId(EntityId.generate().value);
  }
  
  static from(value: string): OrderId {
    return new OrderId(value);
  }
}
```

### Domain Primitives

```typescript
// ✅ CORRECT: Value Objects
import { ValueObject } from '@vytches-ddd/core';

export class Money extends ValueObject<{ amount: number; currency: string }> {
  constructor(amount: number, currency: string) {
    super({ amount, currency });
    this.validate();
  }

  private validate(): void {
    if (this.props.amount < 0) {
      throw new Error('Amount cannot be negative');
    }
    if (!this.props.currency || this.props.currency.length !== 3) {
      throw new Error('Currency must be 3 characters');
    }
  }

  add(other: Money): Money {
    if (this.props.currency !== other.props.currency) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(
      this.props.amount + other.props.amount,
      this.props.currency
    );
  }

  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }
}

// ✅ CORRECT: Domain Entities
import { Entity } from '@vytches-ddd/core';

export class OrderItem extends Entity<OrderId> {
  constructor(
    id: OrderId,
    private productId: ProductId,
    private quantity: number,
    private price: Money
  ) {
    super(id);
    this.validate();
  }

  private validate(): void {
    if (this.quantity <= 0) {
      throw new Error('Quantity must be positive');
    }
    if (this.price.amount <= 0) {
      throw new Error('Price must be positive');
    }
  }

  getTotalPrice(): Money {
    return new Money(
      this.price.amount * this.quantity,
      this.price.currency
    );
  }
}
```

### Aggregate Roots

```typescript
// ✅ CORRECT: Aggregate Root implementation
import { AggregateRoot } from '@vytches-ddd/core';

export class Order extends AggregateRoot {
  private items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.PENDING;

  private constructor(
    id: OrderId,
    private customerId: CustomerId,
    private createdAt: Date = new Date()
  ) {
    super(id);
  }

  static create(data: CreateOrderData): Order {
    const order = new Order(
      OrderId.generate(),
      data.customerId
    );

    // ✅ Add domain events
    order.addDomainEvent(new OrderCreatedEvent({
      orderId: order.id,
      customerId: data.customerId,
      createdAt: order.createdAt
    }));

    return order;
  }

  addItem(productId: ProductId, quantity: number, price: Money): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Cannot modify confirmed order');
    }

    const item = new OrderItem(
      OrderId.generate(),
      productId,
      quantity,
      price
    );

    this.items.push(item);
    
    // ✅ Domain event for item added
    this.addDomainEvent(new OrderItemAddedEvent({
      orderId: this.id,
      item: {
        productId,
        quantity,
        price: price.amount
      }
    }));
  }

  confirm(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }
    
    this.status = OrderStatus.CONFIRMED;
    
    // ✅ Domain event for status change
    this.addDomainEvent(new OrderConfirmedEvent({
      orderId: this.id,
      totalAmount: this.getTotalAmount().amount,
      itemCount: this.items.length
    }));
  }

  getTotalAmount(): Money {
    return this.items.reduce(
      (total, item) => total.add(item.getTotalPrice()),
      new Money(0, 'USD')
    );
  }

  // ✅ Aggregate state for logging
  @LogStateChanges()
  private logStateChange(): void {
    // Automatically logged by @vytches-ddd/logging
  }
}
```

---

## 🎨 Domain Layer Patterns

### Domain Services

```typescript
// ✅ CORRECT: Domain Service with DI
import { DomainService } from '@vytches-ddd/di';
import { Logger } from '@vytches-ddd/logging';

@DomainService('orderDomainService')
export class OrderDomainService {
  private logger = Logger.forContext();

  constructor(
    private priceCalculator: PriceCalculationService,
    private inventoryService: InventoryService
  ) {}

  async calculateOrderTotal(order: Order): Promise<Money> {
    this.logger.info('Calculating order total', { orderId: order.id });

    const baseTotal = order.getTotalAmount();
    const discount = await this.priceCalculator.calculateDiscount(order);
    const tax = await this.priceCalculator.calculateTax(order);

    const finalTotal = baseTotal.subtract(discount).add(tax);

    this.logger.info('Order total calculated', {
      orderId: order.id,
      baseTotal: baseTotal.amount,
      discount: discount.amount,
      tax: tax.amount,
      finalTotal: finalTotal.amount
    });

    return finalTotal;
  }

  async validateOrderFulfillment(order: Order): Promise<void> {
    for (const item of order.items) {
      const available = await this.inventoryService.checkAvailability(
        item.productId,
        item.quantity
      );

      if (!available) {
        throw new InsufficientInventoryError(
          `Insufficient inventory for product ${item.productId}`
        );
      }
    }
  }
}
```

### Domain Events

```typescript
// ✅ CORRECT: Domain Event definitions
import { IDomainEvent } from '@vytches-ddd/core';

export class OrderCreatedEvent implements IDomainEvent {
  public readonly eventType = 'OrderCreated';
  public readonly eventVersion = '1.0';
  public readonly occurredOn = new Date();

  constructor(public readonly payload: {
    orderId: OrderId;
    customerId: CustomerId;
    createdAt: Date;
  }) {}
}

export class OrderConfirmedEvent implements IDomainEvent {
  public readonly eventType = 'OrderConfirmed';
  public readonly eventVersion = '1.0';
  public readonly occurredOn = new Date();

  constructor(public readonly payload: {
    orderId: OrderId;
    totalAmount: number;
    itemCount: number;
  }) {}
}

export class OrderItemAddedEvent implements IDomainEvent {
  public readonly eventType = 'OrderItemAdded';
  public readonly eventVersion = '1.0';
  public readonly occurredOn = new Date();

  constructor(public readonly payload: {
    orderId: OrderId;
    item: {
      productId: ProductId;
      quantity: number;
      price: number;
    };
  }) {}
}
```

---

## 🚀 Application Layer (CQRS)

### Command Handlers

```typescript
// ✅ CORRECT: Command Handler with full DDD integration
import { CommandHandler } from '@vytches-ddd/di';
import { LogCommands } from '@vytches-ddd/logging';

@CommandHandler(CreateOrderCommand, {
  context: 'OrderManagement',
  timeout: 30000,
  middleware: [ValidationMiddleware, LoggingMiddleware]
})
@LogCommands({ 
  includePayload: true, 
  logLevel: 'info',
  maskSensitiveData: true 
})
export class CreateOrderCommandHandler {
  constructor(
    private orderRepository: OrderRepository,
    private orderDomainService: OrderDomainService,
    private orderPolicy: OrderValidationPolicy
  ) {}

  async handle(command: CreateOrderCommand): Promise<Result<OrderId, Error>> {
    try {
      // ✅ Policy validation
      const validationResult = await this.orderPolicy.check({
        entity: command.data,
        context: PolicyContext.create()
          .withUserId(command.userId)
          .withCorrelationId(command.correlationId)
          .build()
      });

      if (validationResult.isFailure()) {
        return Result.failure(
          new ValidationError(validationResult.error.violations)
        );
      }

      // ✅ Create aggregate
      const order = Order.create(command.data);

      // ✅ Domain service validation
      await this.orderDomainService.validateOrderFulfillment(order);

      // ✅ Repository save (automatically publishes events)
      await this.orderRepository.save(order);

      return Result.success(order.id);
    } catch (error) {
      return Result.failure(error as Error);
    }
  }
}
```

### Query Handlers

```typescript
// ✅ CORRECT: Query Handler with caching
import { QueryHandler } from '@vytches-ddd/di';
import { LogQueries } from '@vytches-ddd/logging';

@QueryHandler(GetOrderQuery, {
  context: 'OrderManagement',
  caching: {
    enabled: true,
    ttl: 300000, // 5 minutes
    keyGenerator: (query: GetOrderQuery) => `order:${query.orderId}`
  }
})
@LogQueries({ 
  includeResults: false,
  logLevel: 'debug' 
})
export class GetOrderQueryHandler {
  constructor(
    private orderRepository: OrderRepository,
    private orderReadModel: OrderReadModel
  ) {}

  async handle(query: GetOrderQuery): Promise<Result<OrderDto, Error>> {
    try {
      // ✅ Use read model for queries
      const orderDto = await this.orderReadModel.getOrderById(query.orderId);

      if (!orderDto) {
        return Result.failure(
          new NotFoundError(`Order ${query.orderId} not found`)
        );
      }

      return Result.success(orderDto);
    } catch (error) {
      return Result.failure(error as Error);
    }
  }
}
```

### Command and Query Definitions

```typescript
// ✅ CORRECT: Command definitions
export class CreateOrderCommand {
  constructor(
    public readonly data: CreateOrderData,
    public readonly userId: UserId,
    public readonly correlationId: string = generateCorrelationId()
  ) {}
}

export class GetOrderQuery {
  constructor(
    public readonly orderId: OrderId,
    public readonly userId: UserId
  ) {}
}

// ✅ CORRECT: Data Transfer Objects
export interface CreateOrderData {
  customerId: CustomerId;
  items: Array<{
    productId: ProductId;
    quantity: number;
    price: Money;
  }>;
}

export interface OrderDto {
  id: string;
  customerId: string;
  status: string;
  items: OrderItemDto[];
  totalAmount: number;
  createdAt: Date;
}
```

---

## 🔄 Event-Driven Architecture

### Repository Pattern with Automatic Events

```typescript
// ✅ CORRECT: Repository with automatic event publishing
import { IBaseRepository } from '@vytches-ddd/core';
import { UniversalEventDispatcher } from '@vytches-ddd/events';

export class OrderRepository extends IBaseRepository<Order> {
  constructor(
    private database: Database,
    universalDispatcher: UniversalEventDispatcher
  ) {
    super(universalDispatcher);
  }

  async findById(id: OrderId): Promise<Order | null> {
    const data = await this.database.orders.findFirst({
      where: { id: id.value },
      include: { items: true }
    });

    return data ? this.mapToDomain(data) : null;
  }

  async findByCustomer(customerId: CustomerId): Promise<Order[]> {
    const data = await this.database.orders.findMany({
      where: { customerId: customerId.value },
      include: { items: true }
    });

    return data.map(this.mapToDomain);
  }

  async save(order: Order): Promise<void> {
    // ✅ Repository automatically:
    // 1. Persists the aggregate
    // 2. Publishes domain events
    // 3. Handles transaction safety
    // 4. Commits aggregate events
    await super.save(order);
  }

  protected async persist(order: Order): Promise<void> {
    await this.database.orders.upsert({
      where: { id: order.id.value },
      update: this.mapToDatabase(order),
      create: this.mapToDatabase(order)
    });
  }
}
```

### Event Handlers

```typescript
// ✅ CORRECT: Event Handler with context filtering
import { EventHandler } from '@vytches-ddd/di';

@EventHandler(OrderCreatedEvent, {
  eventContext: 'order-management',
  retry: {
    maxAttempts: 3,
    backoff: 'exponential'
  }
})
export class OrderCreatedEventHandler {
  constructor(
    private emailService: EmailService,
    private inventoryService: InventoryService,
    private logger: Logger
  ) {}

  async handle(event: OrderCreatedEvent): Promise<void> {
    this.logger.info('Handling OrderCreated event', {
      orderId: event.payload.orderId,
      customerId: event.payload.customerId
    });

    // ✅ Parallel processing
    await Promise.all([
      this.sendOrderConfirmationEmail(event),
      this.reserveInventoryForOrder(event),
      this.updateCustomerStatistics(event)
    ]);
  }

  private async sendOrderConfirmationEmail(event: OrderCreatedEvent): Promise<void> {
    await this.emailService.sendOrderConfirmation({
      orderId: event.payload.orderId,
      customerId: event.payload.customerId
    });
  }

  private async reserveInventoryForOrder(event: OrderCreatedEvent): Promise<void> {
    // This would trigger another domain event
    await this.inventoryService.reserveForOrder(event.payload.orderId);
  }

  private async updateCustomerStatistics(event: OrderCreatedEvent): Promise<void> {
    // Update read model or analytics
  }
}
```

### Event Bus Configuration

```typescript
// ✅ CORRECT: Event Bus setup
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches-ddd/events';

// Application setup
const eventBus = new UnifiedEventBus();
const eventDispatcher = new UniversalEventDispatcher(eventBus);

// ✅ Context-aware event publishing
await eventBus.publishMany([
  new OrderCreatedEvent(orderData),
  new InventoryReservationRequestedEvent(orderData),
  new CustomerNotificationEvent(orderData)
], 'order-management');

// ✅ Aggregate convenience method
await eventBus.publishEventsForAggregate(order, 'order-management');
```

---

## 🏛️ Business Policies & Validation

### Policy Builder Patterns

```typescript
// ✅ CORRECT: Comprehensive business policy
import { PolicyBuilder, PolicyContext } from '@vytches-ddd/policies';

const orderValidationPolicy = PolicyBuilder.create<Order>()
  .withId('order-validation-v2')
  .withDomain('order-management')
  .withName('Order Validation Policy')
  .withDescription('Validates order before processing')
  
  // ✅ Basic validations
  .must(order => order.items.length > 0)
  .withCode('EMPTY_ORDER')
  .withMessage('Order must contain at least one item')
  .withSeverity('ERROR')
  
  .and()
  .must(order => order.getTotalAmount().amount > 0)
  .withCode('INVALID_TOTAL')
  .withMessage('Order total must be greater than zero')
  .withSeverity('ERROR')
  
  // ✅ Conditional policies
  .when(order => order.getTotalAmount().amount > 10000)
  .then()
  .mustAsync(new ManagerApprovalSpecification())
  .withCode('MANAGER_APPROVAL_REQUIRED')
  .withMessage('Orders over $10,000 require manager approval')
  .withSeverity('ERROR')
  
  // ✅ Context-aware policies
  .when((order, context) => context.environment === 'production')
  .then()
  .must(new FraudDetectionSpecification())
  .withCode('FRAUD_CHECK_REQUIRED')
  .withMessage('Fraud detection required in production')
  .withSeverity('WARNING')
  
  // ✅ Enable events
  .withEvents({ 
    enabled: true,
    eventContext: 'order-management'
  })
  
  .build();
```

### Advanced Policy Features

```typescript
// ✅ CORRECT: Policy Groups for complex logic
import { PolicyGroup } from '@vytches-ddd/policies';

const expeditedShippingGroup = PolicyGroup.create<Order>('expedited-shipping')
  .mustSatisfy(
    order => order.getTotalAmount().amount >= 500,
    'MINIMUM_AMOUNT_NOT_MET',
    'Expedited shipping requires minimum $500 order'
  )
  .and()
  .mustSatisfy(
    order => order.items.every(item => item.isInStock()),
    'ITEMS_NOT_IN_STOCK',
    'All items must be in stock for expedited shipping'
  );

const loyalCustomerGroup = PolicyGroup.create<Order>('loyal-customer')
  .mustSatisfy(
    (order, context) => context.customerTier === 'GOLD',
    'NOT_GOLD_CUSTOMER',
    'Customer must be Gold tier'
  );

// ✅ OR logic between groups
const expeditedShippingPolicy = PolicyBuilder.create<Order>()
  .withId('expedited-shipping-eligibility')
  .withDomain('shipping')
  .shouldSatisfyAny(expeditedShippingGroup, loyalCustomerGroup)
  .build();
```

### Policy Behaviors (Decorators)

```typescript
// ✅ CORRECT: Policy with retry behavior
import { PolicyRetryBehavior } from '@vytches-ddd/policies';

const basePolicy = PolicyBuilder.create<Order>()
  .mustAsync(new ExternalValidationSpecification())
  .build();

const retryPolicy = PolicyRetryBehavior.create(basePolicy, {
  maxAttempts: 3,
  baseDelay: 1000,
  backoff: 'exponential',
  shouldRetry: violation => violation.code.includes('TIMEOUT'),
  jitter: true
});

// ✅ CORRECT: Policy with caching
import { PolicyCachingBehavior } from '@vytches-ddd/policies';

const cachedPolicy = PolicyCachingBehavior.create(retryPolicy, {
  ttl: 300000, // 5 minutes
  maxSize: 1000,
  keyGenerator: (request) => `order:${request.entity.id}:${request.context.userId}`,
  namespace: 'order-validation'
});

// ✅ CORRECT: Temporal policies
import { PolicyTemporalBehavior } from '@vytches-ddd/policies';

const temporalPolicy = PolicyTemporalBehavior.create(cachedPolicy, {
  businessHours: { start: '09:00', end: '17:00' },
  workingDays: [1, 2, 3, 4, 5],
  timezone: 'America/New_York',
  strictDuringBusinessHours: true,
  relaxedAfterHours: true
});
```

### Custom Specifications

```typescript
// ✅ CORRECT: Custom specification implementation
import { IAsyncSpecification } from '@vytches-ddd/validation';

export class InventoryAvailabilitySpecification implements IAsyncSpecification<Order> {
  constructor(private inventoryService: InventoryService) {}

  async isSatisfiedByAsync(order: Order): Promise<boolean> {
    for (const item of order.items) {
      const available = await this.inventoryService.checkAvailability(
        item.productId,
        item.quantity
      );
      
      if (!available) {
        return false;
      }
    }
    
    return true;
  }
}

// ✅ CORRECT: Composite specifications
import { CompositeSpecification } from '@vytches-ddd/validation';

const orderFulfillmentSpec = CompositeSpecification.create<Order>()
  .and(new InventoryAvailabilitySpecification(inventoryService))
  .and(new PaymentValidationSpecification(paymentService))
  .not(new BlacklistedCustomerSpecification(customerService));
```

---

## 🛡️ Resilience Patterns

### Circuit Breaker Pattern

```typescript
// ✅ CORRECT: Circuit breaker for external services
import { CircuitBreaker } from '@vytches-ddd/resilience';

@DomainService('paymentService')
export class PaymentService {
  private circuitBreaker: CircuitBreaker;

  constructor(private externalPaymentGateway: ExternalPaymentGateway) {
    this.circuitBreaker = CircuitBreaker.create({
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 30000,
      expectedErrors: [TimeoutError, ConnectionError]
    });
  }

  async processPayment(order: Order): Promise<PaymentResult> {
    return await this.circuitBreaker.execute(async () => {
      return await this.externalPaymentGateway.charge({
        amount: order.getTotalAmount().amount,
        currency: order.getTotalAmount().currency,
        orderId: order.id.value
      });
    });
  }
}
```

### Retry Pattern with Exponential Backoff

```typescript
// ✅ CORRECT: Retry policy with jitter
import { RetryPolicy } from '@vytches-ddd/resilience';

@DomainService('inventoryService')
export class InventoryService {
  private retryPolicy: RetryPolicy;

  constructor(private externalInventoryApi: ExternalInventoryApi) {
    this.retryPolicy = RetryPolicy.create({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoff: 'exponential',
      jitter: true,
      retryCondition: (error) => 
        error instanceof TimeoutError || 
        error instanceof TransientError
    });
  }

  async reserveItems(orderId: OrderId, items: OrderItem[]): Promise<void> {
    await this.retryPolicy.execute(async () => {
      await this.externalInventoryApi.reserveItems(orderId.value, items);
    });
  }
}
```

### Bulkhead Pattern

```typescript
// ✅ CORRECT: Resource isolation with bulkhead
import { Bulkhead } from '@vytches-ddd/resilience';

@DomainService('orderProcessingService')
export class OrderProcessingService {
  private highPriorityBulkhead: Bulkhead;
  private normalPriorityBulkhead: Bulkhead;

  constructor() {
    this.highPriorityBulkhead = Bulkhead.create({
      maxConcurrentCalls: 10,
      maxQueueSize: 50,
      queueTimeout: 5000
    });

    this.normalPriorityBulkhead = Bulkhead.create({
      maxConcurrentCalls: 5,
      maxQueueSize: 100,
      queueTimeout: 10000
    });
  }

  async processHighPriorityOrder(order: Order): Promise<void> {
    await this.highPriorityBulkhead.execute(async () => {
      await this.doProcessOrder(order);
    });
  }

  async processNormalOrder(order: Order): Promise<void> {
    await this.normalPriorityBulkhead.execute(async () => {
      await this.doProcessOrder(order);
    });
  }
}
```

### Timeout Strategy

```typescript
// ✅ CORRECT: Timeout with AbortSignal
import { TimeoutStrategy } from '@vytches-ddd/resilience';

@DomainService('externalApiService')
export class ExternalApiService {
  private timeoutStrategy: TimeoutStrategy;

  constructor() {
    this.timeoutStrategy = TimeoutStrategy.create({
      timeout: 30000, // 30 seconds
      useAbortSignal: true
    });
  }

  async callExternalApi(request: ApiRequest): Promise<ApiResponse> {
    return await this.timeoutStrategy.execute(
      async (signal: AbortSignal) => {
        const response = await fetch(request.url, {
          method: request.method,
          body: JSON.stringify(request.body),
          signal // ✅ Pass AbortSignal to external call
        });
        
        return await response.json();
      }
    );
  }
}
```

### Composite Resilience Strategy

```typescript
// ✅ CORRECT: Combining multiple resilience patterns
import { 
  CompositeResilienceStrategy,
  ResiliencePolicyBuilder 
} from '@vytches-ddd/resilience';

@DomainService('resilientPaymentService')
export class ResilientPaymentService {
  private resilienceStrategy: CompositeResilienceStrategy;

  constructor(private paymentGateway: PaymentGateway) {
    this.resilienceStrategy = ResiliencePolicyBuilder.create()
      .withTimeout(30000)
      .withRetry({
        maxAttempts: 3,
        baseDelay: 1000,
        backoff: 'exponential',
        jitter: true
      })
      .withCircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000
      })
      .withBulkhead({
        maxConcurrentCalls: 10,
        maxQueueSize: 50
      })
      .build();
  }

  async processPayment(order: Order): Promise<PaymentResult> {
    return await this.resilienceStrategy.execute(async (signal) => {
      return await this.paymentGateway.charge({
        amount: order.getTotalAmount().amount,
        orderId: order.id.value
      }, signal);
    });
  }
}
```

---

## 📨 Messaging & Sagas

### Outbox Pattern

```typescript
// ✅ CORRECT: Outbox pattern for reliable messaging
import { 
  OutboxPattern,
  MessagePriority,
  OutboxMessage 
} from '@vytches-ddd/messaging';

@DomainService('orderOutboxService')
export class OrderOutboxService {
  private outbox: OutboxPattern;

  constructor(private database: Database) {
    this.outbox = OutboxPattern.create({
      database: this.database,
      tableName: 'outbox_messages',
      batchSize: 100,
      maxRetries: 3,
      processingInterval: 5000
    });
  }

  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    const messages: OutboxMessage[] = [
      {
        id: generateId(),
        aggregateId: event.payload.orderId.value,
        eventType: 'OrderCreated',
        payload: event.payload,
        priority: MessagePriority.HIGH,
        scheduledFor: new Date(),
        retryCount: 0
      },
      {
        id: generateId(),
        aggregateId: event.payload.orderId.value,
        eventType: 'CustomerNotification',
        payload: {
          customerId: event.payload.customerId.value,
          orderNumber: event.payload.orderId.value
        },
        priority: MessagePriority.NORMAL,
        scheduledFor: new Date(Date.now() + 5000), // 5 seconds delay
        retryCount: 0
      }
    ];

    await this.outbox.addMessages(messages);
  }

  async startProcessing(): Promise<void> {
    await this.outbox.startProcessing();
  }
}
```

### Saga Implementation

```typescript
// ✅ CORRECT: Complete saga implementation
import { 
  BaseSaga,
  SagaStatus,
  ISagaExecutionContext,
  ISagaActionResult,
  IExtendedDomainEvent
} from '@vytches-ddd/messaging';

export class OrderProcessingSaga extends BaseSaga {
  constructor() {
    super('OrderProcessingSaga', 'Order Processing Workflow');
  }

  async handleEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.logger.info('Processing event in saga', {
      eventType: event.eventType,
      sagaId: this.id,
      currentStep: this.state.currentStep
    });

    switch (event.eventType) {
      case 'OrderCreated':
        return await this.handleOrderCreated(event, context);
      case 'PaymentProcessed':
        return await this.handlePaymentProcessed(event, context);
      case 'InventoryReserved':
        return await this.handleInventoryReserved(event, context);
      case 'ShippingScheduled':
        return await this.handleShippingScheduled(event, context);
      case 'OrderFailed':
        return await this.handleOrderFailed(event, context);
      default:
        return {
          success: false,
          error: {
            message: `Unhandled event type: ${event.eventType}`,
            code: 'UNHANDLED_EVENT'
          }
        };
    }
  }

  canHandle(event: IExtendedDomainEvent): boolean {
    return [
      'OrderCreated',
      'PaymentProcessed',
      'InventoryReserved',
      'ShippingScheduled',
      'OrderFailed'
    ].includes(event.eventType);
  }

  async compensate(
    stepName: string,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.logger.info('Compensating saga step', {
      stepName,
      sagaId: this.id,
      correlationId: context.correlationId
    });

    switch (stepName) {
      case 'PaymentProcessed':
        return await this.refundPayment(context);
      case 'InventoryReserved':
        return await this.releaseInventory(context);
      case 'ShippingScheduled':
        return await this.cancelShipping(context);
      default:
        return { success: true };
    }
  }

  private async handleOrderCreated(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.updateState({
      currentStep: 'ProcessPayment',
      stepData: {
        ...this.state.stepData,
        orderId: event.payload.orderId,
        customerId: event.payload.customerId,
        totalAmount: event.payload.totalAmount
      }
    });

    return {
      success: true,
      commands: [
        {
          type: 'ProcessPayment',
          payload: {
            orderId: event.payload.orderId,
            amount: event.payload.totalAmount
          }
        }
      ],
      events: [
        {
          eventType: 'PaymentRequested',
          payload: event.payload
        }
      ]
    };
  }

  private async handlePaymentProcessed(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    this.updateState({
      currentStep: 'ReserveInventory',
      stepData: {
        ...this.state.stepData,
        paymentId: event.payload.paymentId
      }
    });

    return {
      success: true,
      commands: [
        {
          type: 'ReserveInventory',
          payload: {
            orderId: this.state.stepData.orderId,
            items: event.payload.items
          }
        }
      ]
    };
  }

  private async refundPayment(
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    const paymentId = this.state.stepData.paymentId;
    
    if (!paymentId) {
      return { success: true }; // Nothing to refund
    }

    return {
      success: true,
      commands: [
        {
          type: 'RefundPayment',
          payload: {
            paymentId,
            reason: 'Order processing failed'
          }
        }
      ]
    };
  }
}
```

### Saga Orchestrator

```typescript
// ✅ CORRECT: Saga orchestrator setup
import { 
  SagaOrchestrator,
  InMemorySagaRepository,
  ISagaDefinition 
} from '@vytches-ddd/messaging';

@DomainService('sagaOrchestrator')
export class OrderSagaOrchestrator {
  private orchestrator: SagaOrchestrator;

  constructor(private database: Database) {
    const sagaRepository = new InMemorySagaRepository({
      enableOptimisticLocking: true,
      enableAuditLog: true,
      retentionPolicy: {
        completedAfterDays: 30,
        compensatedAfterDays: 60,
        failedAfterDays: 90
      }
    });

    this.orchestrator = new SagaOrchestrator(sagaRepository, {
      maxConcurrentExecutions: 50,
      enableMetrics: true,
      enableAutoRetry: true
    });

    this.registerSagaDefinitions();
  }

  private registerSagaDefinitions(): void {
    const orderProcessingSagaDefinition: ISagaDefinition = {
      sagaType: 'OrderProcessingSaga',
      displayName: 'Order Processing Workflow',
      description: 'Handles complete order processing with compensation',
      startEvents: ['OrderCreated'],
      defaultTimeout: 3600000, // 1 hour
      maxInstances: 100,
      steps: [
        { name: 'ProcessPayment', timeout: 300000 },
        { name: 'ReserveInventory', timeout: 180000 },
        { name: 'ScheduleShipping', timeout: 120000 }
      ],
      createInstance: async (event, context) => new OrderProcessingSaga(),
      getCorrelationData: (event) => ({ orderId: event.payload.orderId }),
      validate: (event) => event.payload.orderId ? [] : ['Missing orderId']
    };

    this.orchestrator.registerSagaDefinition(orderProcessingSagaDefinition);
  }

  async processEvent(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext
  ): Promise<void> {
    await this.orchestrator.processEvent(event, context);
  }

  async startProcessing(): Promise<void> {
    await this.orchestrator.start();
  }
}
```

---

## 🗄️ Event Store & Projections

### Event Store Configuration

```typescript
// ✅ CORRECT: Event store setup
import { 
  EventStore,
  EventStream,
  InMemoryEventStore 
} from '@vytches-ddd/event-store';

@DomainService('eventStore')
export class OrderEventStore {
  private eventStore: EventStore;

  constructor(private database: Database) {
    this.eventStore = new InMemoryEventStore({
      snapshotFrequency: 10,
      enableSnapshots: true,
      enableEncryption: true,
      encryptionKey: process.env.EVENT_STORE_KEY!,
      enableChecksums: true
    });
  }

  async saveEvents(
    streamId: string,
    events: IDomainEvent[],
    expectedVersion: number
  ): Promise<void> {
    await this.eventStore.saveEvents(streamId, events, expectedVersion);
  }

  async getEventStream(streamId: string): Promise<EventStream> {
    return await this.eventStore.getEventStream(streamId);
  }

  async getEvents(
    streamId: string,
    fromVersion?: number,
    toVersion?: number
  ): Promise<IDomainEvent[]> {
    return await this.eventStore.getEvents(streamId, fromVersion, toVersion);
  }

  async getAllEvents(
    fromPosition?: number,
    maxCount?: number
  ): Promise<IDomainEvent[]> {
    return await this.eventStore.getAllEvents(fromPosition, maxCount);
  }
}
```

### Projection Engine

```typescript
// ✅ CORRECT: Projection engine with capabilities
import { 
  ProjectionEngine,
  ProjectionCapabilities,
  IProjection 
} from '@vytches-ddd/projections';

export class OrderProjection implements IProjection {
  constructor(private database: Database) {}

  async project(event: IDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'OrderCreated':
        await this.handleOrderCreated(event as OrderCreatedEvent);
        break;
      case 'OrderConfirmed':
        await this.handleOrderConfirmed(event as OrderConfirmedEvent);
        break;
      case 'OrderItemAdded':
        await this.handleOrderItemAdded(event as OrderItemAddedEvent);
        break;
    }
  }

  private async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.database.orderReadModel.create({
      id: event.payload.orderId.value,
      customerId: event.payload.customerId.value,
      status: 'PENDING',
      createdAt: event.occurredOn,
      totalAmount: 0,
      itemCount: 0
    });
  }

  private async handleOrderConfirmed(event: OrderConfirmedEvent): Promise<void> {
    await this.database.orderReadModel.update({
      where: { id: event.payload.orderId.value },
      data: {
        status: 'CONFIRMED',
        totalAmount: event.payload.totalAmount,
        itemCount: event.payload.itemCount
      }
    });
  }
}

@DomainService('orderProjectionEngine')
export class OrderProjectionEngine {
  private engine: ProjectionEngine;

  constructor(
    private eventStore: EventStore,
    private database: Database
  ) {
    this.engine = new ProjectionEngine(
      new OrderProjection(database),
      this.eventStore,
      {
        checkpointFrequency: 100,
        enableRetry: true,
        maxRetries: 3,
        retryDelay: 1000
      }
    );

    // ✅ Add capabilities
    this.engine.addCapability(
      ProjectionCapabilities.checkpoints(database)
    );
    this.engine.addCapability(
      ProjectionCapabilities.circuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000
      })
    );
  }

  async start(): Promise<void> {
    await this.engine.start();
  }

  async stop(): Promise<void> {
    await this.engine.stop();
  }
}
```

---

## 🏭 Infrastructure Layer

### Repository Implementations

```typescript
// ✅ CORRECT: Repository implementation with event store
import { IBaseRepository } from '@vytches-ddd/core';
import { EventStore } from '@vytches-ddd/event-store';

export class EventSourcedOrderRepository extends IBaseRepository<Order> {
  constructor(
    private eventStore: EventStore,
    universalDispatcher: UniversalEventDispatcher
  ) {
    super(universalDispatcher);
  }

  async findById(id: OrderId): Promise<Order | null> {
    const events = await this.eventStore.getEvents(id.value);
    
    if (events.length === 0) {
      return null;
    }

    return this.rebuildAggregateFromEvents(events);
  }

  protected async persist(order: Order): Promise<void> {
    const uncommittedEvents = order.getUncommittedEvents();
    
    if (uncommittedEvents.length === 0) {
      return;
    }

    await this.eventStore.saveEvents(
      order.id.value,
      uncommittedEvents,
      order.version
    );

    order.markEventsAsCommitted();
  }

  private rebuildAggregateFromEvents(events: IDomainEvent[]): Order {
    // Rebuild aggregate from events
    const firstEvent = events[0] as OrderCreatedEvent;
    const order = Order.fromSnapshot(firstEvent.payload);

    // Apply subsequent events
    for (let i = 1; i < events.length; i++) {
      order.applyEvent(events[i]);
    }

    return order;
  }
}
```

### Anti-Corruption Layer

```typescript
// ✅ CORRECT: Anti-corruption layer implementation
import { 
  AntiCorruptionLayer,
  ExternalSystemAdapter 
} from '@vytches-ddd/acl';

@DomainService('paymentGatewayACL')
export class PaymentGatewayACL extends AntiCorruptionLayer {
  constructor(
    private externalPaymentService: ExternalPaymentService,
    private circuitBreaker: CircuitBreaker
  ) {
    super();
  }

  async processPayment(order: Order): Promise<PaymentResult> {
    try {
      // ✅ Transform domain model to external format
      const externalRequest = this.transformToExternalPaymentRequest(order);
      
      // ✅ Call external service with resilience
      const externalResponse = await this.circuitBreaker.execute(
        async () => await this.externalPaymentService.charge(externalRequest)
      );
      
      // ✅ Transform back to domain model
      return this.transformToPaymentResult(externalResponse);
    } catch (error) {
      // ✅ Handle external system failures
      return this.handleExternalSystemFailure(error, order);
    }
  }

  private transformToExternalPaymentRequest(order: Order): ExternalPaymentRequest {
    return {
      transaction_id: order.id.value,
      amount_cents: Math.round(order.getTotalAmount().amount * 100),
      currency_code: order.getTotalAmount().currency,
      customer_external_id: order.customerId.value,
      items: order.items.map(item => ({
        sku: item.productId.value,
        quantity: item.quantity,
        unit_price_cents: Math.round(item.price.amount * 100)
      }))
    };
  }

  private transformToPaymentResult(
    response: ExternalPaymentResponse
  ): PaymentResult {
    return PaymentResult.create({
      paymentId: new PaymentId(response.payment_id),
      status: this.mapPaymentStatus(response.status),
      amount: new Money(response.amount_cents / 100, response.currency),
      transactionId: response.transaction_id,
      processedAt: new Date(response.processed_at)
    });
  }

  private handleExternalSystemFailure(
    error: Error,
    order: Order
  ): PaymentResult {
    this.logger.error('External payment system failure', {
      orderId: order.id.value,
      error: error.message
    });

    // ✅ Fallback to manual processing
    return PaymentResult.createPending({
      orderId: order.id,
      amount: order.getTotalAmount(),
      reason: 'External system unavailable - manual processing required'
    });
  }
}
```

### External Service Adapters

```typescript
// ✅ CORRECT: External service adapter with monitoring
@DomainService('inventoryServiceAdapter')
export class InventoryServiceAdapter extends ExternalSystemAdapter {
  constructor(
    private httpClient: HttpClient,
    private circuitBreaker: CircuitBreaker,
    private retryPolicy: RetryPolicy
  ) {
    super();
  }

  async checkInventory(
    productId: ProductId,
    quantity: number
  ): Promise<InventoryCheckResult> {
    const operation = async () => {
      const response = await this.httpClient.get(
        `/inventory/${productId.value}`,
        { timeout: 5000 }
      );

      return {
        productId,
        availableQuantity: response.data.available_quantity,
        isAvailable: response.data.available_quantity >= quantity,
        reservationToken: response.data.reservation_token
      };
    };

    return await this.executeWithResilience(operation);
  }

  async reserveInventory(
    productId: ProductId,
    quantity: number,
    reservationToken: string
  ): Promise<InventoryReservationResult> {
    const operation = async () => {
      const response = await this.httpClient.post(
        `/inventory/${productId.value}/reserve`,
        {
          quantity,
          reservation_token: reservationToken
        }
      );

      return {
        productId,
        reservedQuantity: response.data.reserved_quantity,
        reservationId: response.data.reservation_id,
        expiresAt: new Date(response.data.expires_at)
      };
    };

    return await this.executeWithResilience(operation);
  }

  private async executeWithResilience<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    return await this.circuitBreaker.execute(async () => {
      return await this.retryPolicy.execute(operation);
    });
  }
}
```

---

## 🔧 Dependency Injection

### DI Container Setup

```typescript
// ✅ CORRECT: DI container bootstrap
import { 
  VytchesDDD,
  SimpleContainer,
  NestJSContainerAdapter 
} from '@vytches-ddd/di';

// ✅ Standalone application setup
export class ApplicationBootstrap {
  static async bootstrap(): Promise<void> {
    const container = new SimpleContainer();
    
    // ✅ Register infrastructure services
    container.registerInstance('database', new Database());
    container.registerInstance('httpClient', new HttpClient());
    
    // ✅ Register configuration
    container.registerInstance('config', {
      paymentGateway: {
        url: process.env.PAYMENT_GATEWAY_URL!,
        timeout: 30000
      },
      resilience: {
        circuitBreaker: {
          failureThreshold: 5,
          recoveryTimeout: 60000
        }
      }
    });
    
    // ✅ Configure VytchesDDD with auto-discovery
    VytchesDDD.configure(container);
    
    // ✅ Start application services
    const sagaOrchestrator = VytchesDDD.resolve<OrderSagaOrchestrator>('sagaOrchestrator');
    await sagaOrchestrator.startProcessing();
  }
}

// ✅ NestJS integration
@Module({
  imports: [DatabaseModule, HttpModule],
  providers: [
    OrderService,
    OrderRepository,
    CreateOrderCommandHandler,
    GetOrderQueryHandler
  ]
})
export class OrderModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit(): Promise<void> {
    // ✅ Integrate with VytchesDDD
    const adapter = new NestJSContainerAdapter(this.moduleRef);
    VytchesDDD.configure(adapter);
  }
}
```

### Service Registration Patterns

```typescript
// ✅ CORRECT: Domain service with full DI configuration
@DomainService({
  serviceId: 'orderService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderManagement',
  dependencies: ['orderRepository', 'paymentService', 'inventoryService'],
  autoRegister: true,
  metadata: {
    description: 'Handles order domain logic',
    version: '1.0.0'
  }
})
export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private paymentService: PaymentService,
    private inventoryService: InventoryService
  ) {}

  async processOrder(command: CreateOrderCommand): Promise<OrderId> {
    // Service implementation
  }
}

// ✅ CORRECT: Command handler with DI options
@CommandHandler(CreateOrderCommand, {
  context: 'OrderManagement',
  timeout: 30000,
  middleware: [ValidationMiddleware, LoggingMiddleware, MetricsMiddleware],
  dependencies: ['orderService', 'orderPolicy'],
  retryPolicy: {
    maxAttempts: 3,
    baseDelay: 1000
  }
})
export class CreateOrderCommandHandler {
  constructor(
    private orderService: OrderService,
    private orderPolicy: OrderValidationPolicy
  ) {}

  async handle(command: CreateOrderCommand): Promise<Result<OrderId, Error>> {
    // Handler implementation
  }
}
```

### Context Isolation

```typescript
// ✅ CORRECT: Context-specific containers
export class BoundedContextBootstrap {
  static setupOrderManagement(): void {
    const orderContainer = new SimpleContainer();
    
    // ✅ Order management specific services
    orderContainer.registerInstance('orderConfig', {
      timeout: 30000,
      maxRetries: 3
    });
    
    orderContainer.registerTransient('orderService', OrderService);
    orderContainer.registerSingleton('orderRepository', OrderRepository);
    
    VytchesDDD.configureContext('OrderManagement', orderContainer);
  }
  
  static setupPaymentProcessing(): void {
    const paymentContainer = new SimpleContainer();
    
    // ✅ Payment processing specific services
    paymentContainer.registerInstance('paymentConfig', {
      gatewayUrl: process.env.PAYMENT_GATEWAY_URL!,
      timeout: 60000
    });
    
    paymentContainer.registerTransient('paymentService', PaymentService);
    paymentContainer.registerSingleton('paymentRepository', PaymentRepository);
    
    VytchesDDD.configureContext('PaymentProcessing', paymentContainer);
  }
}

// ✅ CORRECT: Context-aware service resolution
@DomainService('orderCoordinatorService')
export class OrderCoordinatorService {
  async coordinateOrderProcessing(orderId: OrderId): Promise<void> {
    // ✅ Resolve services from specific contexts
    const orderService = VytchesDDD.resolve<OrderService>(
      'orderService',
      'OrderManagement'
    );
    
    const paymentService = VytchesDDD.resolve<PaymentService>(
      'paymentService',
      'PaymentProcessing'
    );
    
    await orderService.processOrder(orderId);
    await paymentService.processPayment(orderId);
  }
}
```

---

## 📊 Logging & Observability

### Structured Logging

```typescript
// ✅ CORRECT: Comprehensive logging setup
import { Logger } from '@vytches-ddd/logging';

@DomainService('orderService')
export class OrderService {
  private logger: Logger;

  constructor() {
    this.logger = Logger.forContext('OrderService')
      .withContext({
        boundedContext: 'OrderManagement',
        service: 'OrderService',
        version: '1.0.0'
      });
  }

  async processOrder(command: CreateOrderCommand): Promise<Result<OrderId, Error>> {
    const correlationId = generateCorrelationId();
    const contextualLogger = this.logger
      .withCorrelationId(correlationId)
      .withUserId(command.userId)
      .withRequestId(command.requestId);

    contextualLogger.info('Processing order started', {
      orderId: command.orderId,
      customerId: command.customerId,
      itemCount: command.items.length,
      totalAmount: command.totalAmount
    });

    try {
      const order = await this.createOrder(command);
      
      contextualLogger.info('Order created successfully', {
        orderId: order.id.value,
        status: order.status,
        createdAt: order.createdAt
      });

      return Result.success(order.id);
    } catch (error) {
      contextualLogger.error('Order processing failed', {
        orderId: command.orderId,
        error: error.message,
        stack: error.stack
      });

      return Result.failure(error as Error);
    }
  }
}
```

### CQRS Logging Decorators

```typescript
// ✅ CORRECT: CQRS logging integration
import { LogCommands, LogQueries } from '@vytches-ddd/logging';

@CommandHandler(CreateOrderCommand)
@LogCommands({
  includePayload: true,
  logLevel: 'info',
  maskSensitiveData: true,
  sensitiveFields: ['creditCard', 'ssn'],
  includeExecutionTime: true,
  includeMemoryUsage: true
})
export class CreateOrderCommandHandler {
  async handle(command: CreateOrderCommand): Promise<Result<OrderId, Error>> {
    // Handler implementation
    // Automatic logging:
    // - Command execution start/end
    // - Execution time
    // - Memory usage
    // - Success/failure status
    // - Masked sensitive data
  }
}

@QueryHandler(GetOrderQuery)
@LogQueries({
  includeResults: false, // Don't log query results
  logLevel: 'debug',
  includeExecutionTime: true,
  cacheMetrics: true
})
export class GetOrderQueryHandler {
  async handle(query: GetOrderQuery): Promise<Result<OrderDto, Error>> {
    // Handler implementation
    // Automatic logging:
    // - Query execution metrics
    // - Cache hit/miss information
    // - Performance data
  }
}
```

### Data Masking Configuration

```typescript
// ✅ CORRECT: Data masking setup
Logger.configure({
  masking: {
    enabled: true,
    sensitiveKeys: [
      'password',
      'creditCard',
      'ssn',
      'email',
      'phone',
      'bankAccount'
    ],
    replacement: '[MASKED]',
    customMaskers: {
      email: (value: string) => {
        const [name, domain] = value.split('@');
        return `${name.substring(0, 2)}***@${domain}`;
      },
      creditCard: (value: string) => {
        return `****-****-****-${value.slice(-4)}`;
      }
    }
  },
  providers: {
    console: {
      enabled: true,
      level: 'info'
    },
    file: {
      enabled: true,
      level: 'debug',
      filename: 'logs/application.log'
    },
    elasticsearch: {
      enabled: true,
      level: 'info',
      endpoint: process.env.ELASTICSEARCH_URL!
    }
  }
});
```

### Metrics and Monitoring

```typescript
// ✅ CORRECT: Business metrics collection
@DomainService('orderMetrics')
export class OrderMetrics {
  private logger = Logger.forContext('OrderMetrics');

  recordOrderCreated(order: Order): void {
    this.logger.info('Order created metric', {
      metric: 'orders_created_total',
      value: 1,
      labels: {
        customerId: order.customerId.value,
        orderValue: order.getTotalAmount().amount,
        itemCount: order.items.length
      }
    });
  }

  recordOrderProcessingTime(orderId: OrderId, duration: number): void {
    this.logger.info('Order processing time metric', {
      metric: 'order_processing_duration_seconds',
      value: duration,
      labels: {
        orderId: orderId.value
      }
    });
  }

  recordPolicyViolation(policyId: string, severity: string): void {
    this.logger.warn('Policy violation metric', {
      metric: 'policy_violations_total',
      value: 1,
      labels: {
        policyId,
        severity
      }
    });
  }
}
```

---

## 🧪 Testing Strategy

### Test File Organization

```
tests/
├── unit/
│   ├── domain/
│   │   ├── aggregates/
│   │   │   └── order.test.ts
│   │   ├── services/
│   │   │   └── order.service.test.ts
│   │   └── policies/
│   │       └── order-validation.policy.test.ts
│   ├── application/
│   │   ├── commands/
│   │   │   └── create-order.handler.test.ts
│   │   └── queries/
│   │       └── get-order.handler.test.ts
│   └── infrastructure/
│       ├── repositories/
│       │   └── order.repository.test.ts
│       └── adapters/
│           └── payment-gateway.adapter.test.ts
├── integration/
│   ├── sagas/
│   │   └── order-processing.saga.test.ts
│   ├── projections/
│   │   └── order.projection.test.ts
│   └── event-store/
│       └── order.event-store.test.ts
└── e2e/
    └── order-workflow.test.ts
```

### Unit Testing Patterns

```typescript
// ✅ CORRECT: Domain aggregate testing
import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';

describe('Order Aggregate', () => {
  let customerId: CustomerId;
  let validOrderData: CreateOrderData;

  beforeEach(() => {
    customerId = CustomerId.generate();
    validOrderData = {
      customerId,
      items: [
        {
          productId: ProductId.generate(),
          quantity: 2,
          price: new Money(10.99, 'USD')
        }
      ]
    };
  });

  describe('create', () => {
    it('should create order successfully with valid data', () => {
      const [error, order] = safeRun(() => Order.create(validOrderData));

      expect(error).toBeUndefined();
      expect(order).toBeDefined();
      expect(order?.customerId).toBe(customerId);
      expect(order?.items.length).toBe(1);
      expect(order?.status).toBe(OrderStatus.PENDING);
    });

    it('should throw ValidationError for empty items', () => {
      const invalidData = { ...validOrderData, items: [] };
      const [validationError] = safeRun(() => Order.create(invalidData));

      expect(validationError).toBeInstanceOf(ValidationError);
      expect(validationError?.message).toContain('items cannot be empty');
    });

    it('should publish OrderCreatedEvent', () => {
      const [error, order] = safeRun(() => Order.create(validOrderData));

      expect(error).toBeUndefined();
      expect(order?.getUncommittedEvents()).toHaveLength(1);
      expect(order?.getUncommittedEvents()[0]).toBeInstanceOf(OrderCreatedEvent);
    });
  });

  describe('addItem', () => {
    let order: Order;

    beforeEach(() => {
      order = Order.create(validOrderData);
    });

    it('should add item successfully', () => {
      const productId = ProductId.generate();
      const price = new Money(15.50, 'USD');
      
      const [error] = safeRun(() => order.addItem(productId, 3, price));

      expect(error).toBeUndefined();
      expect(order.items.length).toBe(2);
    });

    it('should throw error when order is confirmed', () => {
      order.confirm();
      
      const [confirmError] = safeRun(() => 
        order.addItem(ProductId.generate(), 1, new Money(5.00, 'USD'))
      );

      expect(confirmError).toBeInstanceOf(OrderStateError);
      expect(confirmError?.message).toContain('Cannot modify confirmed order');
    });
  });

  describe('confirm', () => {
    it('should confirm order with items', () => {
      const order = Order.create(validOrderData);
      
      const [error] = safeRun(() => order.confirm());

      expect(error).toBeUndefined();
      expect(order.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should throw error for empty order', () => {
      const emptyOrderData = { ...validOrderData, items: [] };
      const order = Order.create(emptyOrderData);
      
      const [confirmError] = safeRun(() => order.confirm());

      expect(confirmError).toBeInstanceOf(BusinessRuleError);
      expect(confirmError?.message).toContain('Cannot confirm empty order');
    });
  });
});
```

### Command Handler Testing

```typescript
// ✅ CORRECT: Command handler testing
describe('CreateOrderCommandHandler', () => {
  let handler: CreateOrderCommandHandler;
  let mockOrderRepository: jest.Mocked<OrderRepository>;
  let mockOrderService: jest.Mocked<OrderService>;
  let mockOrderPolicy: jest.Mocked<OrderValidationPolicy>;

  beforeEach(() => {
    mockOrderRepository = {
      save: jest.fn(),
      findById: jest.fn()
    } as any;

    mockOrderService = {
      processOrder: jest.fn()
    } as any;

    mockOrderPolicy = {
      check: jest.fn()
    } as any;

    handler = new CreateOrderCommandHandler(
      mockOrderRepository,
      mockOrderService,
      mockOrderPolicy
    );
  });

  describe('handle', () => {
    it('should create order successfully', async () => {
      const command = new CreateOrderCommand(validOrderData, userId);
      
      mockOrderPolicy.check.mockResolvedValue(Result.success(validOrderData));
      mockOrderService.processOrder.mockResolvedValue(undefined);
      mockOrderRepository.save.mockResolvedValue(undefined);

      const result = await handler.handle(command);

      expect(result.isSuccess()).toBe(true);
      expect(result.value).toBeInstanceOf(OrderId);
      expect(mockOrderRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should fail when policy validation fails', async () => {
      const command = new CreateOrderCommand(validOrderData, userId);
      const policyError = new PolicyViolationError(['INVALID_CUSTOMER']);
      
      mockOrderPolicy.check.mockResolvedValue(Result.failure(policyError));

      const result = await handler.handle(command);

      expect(result.isFailure()).toBe(true);
      expect(result.error).toBeInstanceOf(PolicyViolationError);
      expect(mockOrderRepository.save).not.toHaveBeenCalled();
    });

    it('should handle domain service failures', async () => {
      const command = new CreateOrderCommand(validOrderData, userId);
      const domainError = new InsufficientInventoryError('Out of stock');
      
      mockOrderPolicy.check.mockResolvedValue(Result.success(validOrderData));
      mockOrderService.processOrder.mockRejectedValue(domainError);

      const result = await handler.handle(command);

      expect(result.isFailure()).toBe(true);
      expect(result.error).toBeInstanceOf(InsufficientInventoryError);
    });
  });
});
```

### Event Handler Testing

```typescript
// ✅ CORRECT: Event handler testing
describe('OrderCreatedEventHandler', () => {
  let handler: OrderCreatedEventHandler;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockInventoryService: jest.Mocked<InventoryService>;

  beforeEach(() => {
    mockEmailService = {
      sendOrderConfirmation: jest.fn()
    } as any;

    mockInventoryService = {
      reserveForOrder: jest.fn()
    } as any;

    handler = new OrderCreatedEventHandler(
      mockEmailService,
      mockInventoryService
    );
  });

  describe('handle', () => {
    it('should process order created event successfully', async () => {
      const event = new OrderCreatedEvent({
        orderId: OrderId.generate(),
        customerId: CustomerId.generate(),
        createdAt: new Date()
      });

      mockEmailService.sendOrderConfirmation.mockResolvedValue(undefined);
      mockInventoryService.reserveForOrder.mockResolvedValue(undefined);

      await handler.handle(event);

      expect(mockEmailService.sendOrderConfirmation).toHaveBeenCalledWith({
        orderId: event.payload.orderId,
        customerId: event.payload.customerId
      });
      expect(mockInventoryService.reserveForOrder).toHaveBeenCalledWith(
        event.payload.orderId
      );
    });

    it('should handle email service failures gracefully', async () => {
      const event = new OrderCreatedEvent({
        orderId: OrderId.generate(),
        customerId: CustomerId.generate(),
        createdAt: new Date()
      });

      mockEmailService.sendOrderConfirmation.mockRejectedValue(
        new Error('Email service unavailable')
      );
      mockInventoryService.reserveForOrder.mockResolvedValue(undefined);

      // Should not throw - event handlers should be resilient
      await expect(handler.handle(event)).resolves.not.toThrow();
      
      expect(mockInventoryService.reserveForOrder).toHaveBeenCalled();
    });
  });
});
```

### Integration Testing

```typescript
// ✅ CORRECT: Integration testing with event store
describe('Order Integration Tests', () => {
  let eventStore: EventStore;
  let orderRepository: OrderRepository;
  let commandBus: CommandBus;

  beforeEach(async () => {
    eventStore = new InMemoryEventStore();
    orderRepository = new EventSourcedOrderRepository(eventStore);
    commandBus = new CommandBus();
    
    // Setup real handlers
    commandBus.register(CreateOrderCommand, new CreateOrderCommandHandler(
      orderRepository,
      new OrderService(),
      new OrderValidationPolicy()
    ));
  });

  describe('Order Creation Workflow', () => {
    it('should create order and persist events', async () => {
      const command = new CreateOrderCommand(validOrderData, userId);
      
      const result = await commandBus.send(command);
      
      expect(result.isSuccess()).toBe(true);
      
      const orderId = result.value as OrderId;
      const events = await eventStore.getEvents(orderId.value);
      
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(OrderCreatedEvent);
    });

    it('should rebuild aggregate from events', async () => {
      const command = new CreateOrderCommand(validOrderData, userId);
      const result = await commandBus.send(command);
      const orderId = result.value as OrderId;
      
      // Retrieve order from repository
      const order = await orderRepository.findById(orderId);
      
      expect(order).toBeDefined();
      expect(order?.customerId).toBe(validOrderData.customerId);
      expect(order?.items.length).toBe(validOrderData.items.length);
    });
  });
});
```

### Saga Testing

```typescript
// ✅ CORRECT: Saga testing
describe('OrderProcessingSaga', () => {
  let saga: OrderProcessingSaga;
  let mockContext: ISagaExecutionContext;

  beforeEach(() => {
    saga = new OrderProcessingSaga();
    mockContext = {
      correlationId: 'test-correlation-id',
      userId: 'test-user-id',
      environment: 'test'
    };
  });

  describe('handleOrderCreated', () => {
    it('should process order created event', async () => {
      const event = new OrderCreatedEvent({
        orderId: OrderId.generate(),
        customerId: CustomerId.generate(),
        createdAt: new Date()
      });

      const result = await saga.handleEvent(event, mockContext);

      expect(result.success).toBe(true);
      expect(result.commands).toHaveLength(1);
      expect(result.commands![0].type).toBe('ProcessPayment');
      expect(result.events).toHaveLength(1);
      expect(result.events![0].eventType).toBe('PaymentRequested');
    });

    it('should update saga state correctly', async () => {
      const event = new OrderCreatedEvent({
        orderId: OrderId.generate(),
        customerId: CustomerId.generate(),
        createdAt: new Date()
      });

      await saga.handleEvent(event, mockContext);

      expect(saga.state.currentStep).toBe('ProcessPayment');
      expect(saga.state.stepData.orderId).toBe(event.payload.orderId);
    });
  });

  describe('compensate', () => {
    it('should compensate payment step', async () => {
      saga.updateState({
        currentStep: 'InventoryReserved',
        stepData: { paymentId: 'payment-123' }
      });

      const result = await saga.compensate('PaymentProcessed', mockContext);

      expect(result.success).toBe(true);
      expect(result.commands).toHaveLength(1);
      expect(result.commands![0].type).toBe('RefundPayment');
    });
  });
});
```

---

## 🏢 Enterprise Features

### Bundle Strategies

```typescript
// ✅ CORRECT: Bundle configuration
// Core Bundle - Basic DDD patterns
import { 
  AggregateRoot, 
  EntityId, 
  BaseError 
} from '@vytches-ddd/core';
import { Logger } from '@vytches-ddd/logging';
import { safeRun, Result } from '@vytches-ddd/utils';

// Advanced Bundle - Event-driven patterns
import { 
  CommandBus, 
  QueryBus 
} from '@vytches-ddd/cqrs';
import { 
  UnifiedEventBus 
} from '@vytches-ddd/events';
import { 
  ProjectionEngine 
} from '@vytches-ddd/projections';

// Enterprise Bundle - All features
import { 
  PolicyBuilder 
} from '@vytches-ddd/policies';
import { 
  CircuitBreaker 
} from '@vytches-ddd/resilience';
import { 
  OutboxPattern 
} from '@vytches-ddd/messaging';
import { 
  AntiCorruptionLayer 
} from '@vytches-ddd/acl';
import { 
  EventStore 
} from '@vytches-ddd/event-store';
```

### Health Checks

```typescript
// ✅ CORRECT: Health monitoring
@DomainService('healthCheckService')
export class HealthCheckService {
  constructor(
    private orderRepository: OrderRepository,
    private eventStore: EventStore,
    private paymentService: PaymentService
  ) {}

  async checkOrderManagementHealth(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.checkOrderRepository(),
      this.checkEventStore(),
      this.checkPaymentService()
    ]);

    const failedChecks = checks.filter(
      result => result.status === 'rejected'
    );

    return {
      status: failedChecks.length === 0 ? 'healthy' : 'degraded',
      checks: {
        orderRepository: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        eventStore: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        paymentService: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy'
      },
      timestamp: new Date(),
      details: {
        failedChecks: failedChecks.length,
        totalChecks: checks.length
      }
    };
  }

  private async checkOrderRepository(): Promise<void> {
    const recentOrders = await this.orderRepository.findRecent(5);
    if (recentOrders.length === 0) {
      throw new Error('No recent orders found');
    }
  }

  private async checkEventStore(): Promise<void> {
    const events = await this.eventStore.getAllEvents(0, 1);
    // Health check logic
  }

  private async checkPaymentService(): Promise<void> {
    // Health check for payment service
  }
}
```

### Configuration Management

```typescript
// ✅ CORRECT: Enterprise configuration
@DomainService('configurationService')
export class ConfigurationService {
  private config: EnterpriseConfig;

  constructor() {
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): EnterpriseConfig {
    return {
      domain: {
        orderManagement: {
          timeout: parseInt(process.env.ORDER_TIMEOUT || '30000'),
          maxRetries: parseInt(process.env.ORDER_MAX_RETRIES || '3'),
          batchSize: parseInt(process.env.ORDER_BATCH_SIZE || '100')
        },
        paymentProcessing: {
          timeout: parseInt(process.env.PAYMENT_TIMEOUT || '60000'),
          maxRetries: parseInt(process.env.PAYMENT_MAX_RETRIES || '5'),
          gatewayUrl: process.env.PAYMENT_GATEWAY_URL!
        }
      },
      resilience: {
        circuitBreaker: {
          failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD || '5'),
          recoveryTimeout: parseInt(process.env.CB_RECOVERY_TIMEOUT || '60000')
        },
        retry: {
          maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3'),
          baseDelay: parseInt(process.env.RETRY_BASE_DELAY || '1000')
        }
      },
      eventStore: {
        snapshotFrequency: parseInt(process.env.ES_SNAPSHOT_FREQ || '10'),
        enableEncryption: process.env.ES_ENABLE_ENCRYPTION === 'true'
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableMasking: process.env.LOG_ENABLE_MASKING === 'true'
      }
    };
  }

  getConfig(): EnterpriseConfig {
    return this.config;
  }

  getOrderManagementConfig(): OrderManagementConfig {
    return this.config.domain.orderManagement;
  }

  getResilienceConfig(): ResilienceConfig {
    return this.config.resilience;
  }
}
```

---

## ⚡ Performance & Security

### Performance Optimization

```typescript
// ✅ CORRECT: Performance optimization techniques
@DomainService('orderCacheService')
export class OrderCacheService {
  private cache = new Map<string, { data: any; expiry: number }>();

  async getCachedOrder(orderId: OrderId): Promise<OrderDto | null> {
    const key = `order:${orderId.value}`;
    const cached = this.cache.get(key);
    
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    
    return null;
  }

  async cacheOrder(order: OrderDto, ttl: number = 300000): Promise<void> {
    const key = `order:${order.id}`;
    this.cache.set(key, {
      data: order,
      expiry: Date.now() + ttl
    });
  }
}

// ✅ CORRECT: Batch processing
@DomainService('orderBatchProcessor')
export class OrderBatchProcessor {
  async processBatch(orders: Order[]): Promise<void> {
    const batchSize = 50;
    const batches = this.chunkArray(orders, batchSize);
    
    for (const batch of batches) {
      await Promise.all(
        batch.map(order => this.processOrder(order))
      );
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

### Security Best Practices

```typescript
// ✅ CORRECT: Security implementation
@DomainService('securityService')
export class SecurityService {
  async validateOrderAccess(
    orderId: OrderId,
    userId: UserId,
    requiredRole?: string
  ): Promise<boolean> {
    const order = await this.orderRepository.findById(orderId);
    
    if (!order) {
      return false;
    }
    
    // ✅ Check ownership
    if (order.customerId.equals(userId)) {
      return true;
    }
    
    // ✅ Check role-based access
    if (requiredRole) {
      const userRoles = await this.getUserRoles(userId);
      return userRoles.includes(requiredRole);
    }
    
    return false;
  }

  async encryptSensitiveData(data: string): Promise<string> {
    // Implementation would use actual encryption
    return Buffer.from(data).toString('base64');
  }

  async auditAction(
    action: string,
    userId: UserId,
    resourceId: EntityId,
    details: Record<string, any>
  ): Promise<void> {
    await this.auditRepository.save({
      action,
      userId: userId.value,
      resourceId: resourceId.value,
      details,
      timestamp: new Date(),
      ipAddress: this.getClientIp()
    });
  }
}
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Import Errors

```typescript
// ❌ PROBLEM: Direct package imports
import { AggregateRoot } from '@vytches-ddd/aggregates';

// ✅ SOLUTION: Use meta-package imports
import { AggregateRoot } from '@vytches-ddd/core';
```

#### 2. Event Publishing Issues

```typescript
// ❌ PROBLEM: Manual event publishing
await this.eventBus.publish(new OrderCreatedEvent(order.id));

// ✅ SOLUTION: Use repository pattern
await this.orderRepository.save(order); // Automatically publishes events
```

#### 3. Testing Errors

```typescript
// ❌ PROBLEM: Using Jest/Vitest toThrow
expect(() => Order.create(invalidData)).toThrow();

// ✅ SOLUTION: Use safeRun pattern
const [error] = safeRun(() => Order.create(invalidData));
expect(error).toBeInstanceOf(ValidationError);
```

#### 4. DI Resolution Issues

```typescript
// ❌ PROBLEM: Manual service instantiation
const orderService = new OrderService();

// ✅ SOLUTION: Use DI container
const orderService = VytchesDDD.resolve<OrderService>('orderService');
```

#### 5. Policy Evaluation Errors

```typescript
// ❌ PROBLEM: Synchronous policy with async operations
const policy = PolicyBuilder.create<Order>()
  .must(order => someAsyncOperation(order)) // This won't work
  .build();

// ✅ SOLUTION: Use async policy methods
const policy = PolicyBuilder.create<Order>()
  .mustAsync(new AsyncOrderValidationSpecification())
  .build();
```

#### 6. Saga State Management

```typescript
// ❌ PROBLEM: Direct state mutation
saga.state.currentStep = 'NewStep';

// ✅ SOLUTION: Use updateState method
saga.updateState({
  currentStep: 'NewStep',
  stepData: { ...saga.state.stepData, newField: 'value' }
});
```

### Debug Tips

```typescript
// ✅ Enable debug logging
Logger.configure({
  level: 'debug',
  providers: {
    console: { enabled: true, level: 'debug' }
  }
});

// ✅ Use correlation IDs for tracing
const logger = Logger.forContext()
  .withCorrelationId(request.correlationId)
  .withRequestId(request.id);

// ✅ Monitor saga execution
const sagaMetrics = await sagaOrchestrator.getMetrics();
console.log('Active sagas:', sagaMetrics.activeSagas);
console.log('Completed sagas:', sagaMetrics.completedSagas);
console.log('Failed sagas:', sagaMetrics.failedSagas);
```

---

## 🎨 Advanced Decorators & Patterns

### Resilience Decorators

```typescript
// ✅ CORRECT: Circuit breaker decorator
import { CircuitBreaker } from '@vytches-ddd/resilience';

@DomainService('paymentService')
export class PaymentService {
  @CircuitBreaker({
    failureThreshold: 5,
    recoveryTimeout: 60000,
    expectedErrors: [TimeoutError, ConnectionError]
  })
  async processPayment(amount: Money): Promise<PaymentResult> {
    return await this.externalPaymentGateway.charge(amount);
  }
}

// ✅ CORRECT: Retry decorator
import { Retry } from '@vytches-ddd/resilience';

@DomainService('inventoryService')
export class InventoryService {
  @Retry({
    maxAttempts: 3,
    baseDelay: 1000,
    backoff: 'exponential',
    jitter: true,
    retryCondition: (error) => error instanceof TransientError
  })
  async checkInventory(productId: ProductId): Promise<InventoryStatus> {
    return await this.externalInventoryApi.getStatus(productId);
  }
}

// ✅ CORRECT: Bulkhead decorator
import { Bulkhead } from '@vytches-ddd/resilience';

@DomainService('orderProcessingService')
export class OrderProcessingService {
  @Bulkhead({
    maxConcurrentCalls: 10,
    maxQueueSize: 50,
    queueTimeout: 5000
  })
  async processHighPriorityOrder(order: Order): Promise<void> {
    await this.performComplexProcessing(order);
  }
}

// ✅ CORRECT: Timeout decorator
import { Timeout } from '@vytches-ddd/resilience';

@DomainService('externalApiService')
export class ExternalApiService {
  @Timeout(30000) // 30 seconds
  async callSlowExternalService(request: ApiRequest): Promise<ApiResponse> {
    return await this.externalService.process(request);
  }
}

// ✅ CORRECT: Composite resilience decorator
import { Resilience } from '@vytches-ddd/resilience';

@DomainService('criticalService')
export class CriticalService {
  @Resilience({
    timeout: 30000,
    retry: {
      maxAttempts: 3,
      baseDelay: 1000,
      backoff: 'exponential'
    },
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000
    },
    bulkhead: {
      maxConcurrentCalls: 10,
      maxQueueSize: 50
    }
  })
  async performCriticalOperation(data: CriticalData): Promise<CriticalResult> {
    return await this.processCriticalData(data);
  }
}
```

### Saga Decorators

```typescript
// ✅ CORRECT: Saga decorator
import { Saga, SagaEventHandler, StartSaga, EndSaga, CompensationHandler } from '@vytches-ddd/messaging';

@Saga('OrderProcessingSaga')
export class OrderProcessingSaga {
  @StartSaga()
  @SagaEventHandler('OrderCreated')
  async handleOrderCreated(event: OrderCreatedEvent, context: ISagaExecutionContext): Promise<ISagaActionResult> {
    this.updateState({
      currentStep: 'ProcessPayment',
      stepData: { orderId: event.payload.orderId }
    });

    return {
      success: true,
      commands: [
        { type: 'ProcessPayment', payload: { orderId: event.payload.orderId } }
      ]
    };
  }

  @SagaEventHandler('PaymentProcessed')
  async handlePaymentProcessed(event: PaymentProcessedEvent, context: ISagaExecutionContext): Promise<ISagaActionResult> {
    this.updateState({
      currentStep: 'ReserveInventory',
      stepData: { ...this.state.stepData, paymentId: event.payload.paymentId }
    });

    return {
      success: true,
      commands: [
        { type: 'ReserveInventory', payload: { orderId: this.state.stepData.orderId } }
      ]
    };
  }

  @EndSaga()
  @SagaEventHandler('OrderCompleted')
  async handleOrderCompleted(event: OrderCompletedEvent, context: ISagaExecutionContext): Promise<ISagaActionResult> {
    return {
      success: true,
      sagaCompleted: true
    };
  }

  @CompensationHandler('PaymentProcessed')
  async compensatePayment(context: ISagaExecutionContext): Promise<ISagaActionResult> {
    return {
      success: true,
      commands: [
        { type: 'RefundPayment', payload: { paymentId: this.state.stepData.paymentId } }
      ]
    };
  }
}
```

### Enhanced Logging Decorators

```typescript
// ✅ CORRECT: Domain events logging
import { LogDomainEvents } from '@vytches-ddd/logging';

@LogDomainEvents({
  includePayload: true,
  maskSensitiveData: true,
  logLevel: 'info'
})
export class Order extends AggregateRoot {
  confirm(): void {
    this.status = OrderStatus.CONFIRMED;
    
    // ✅ This event will be automatically logged
    this.addDomainEvent(new OrderConfirmedEvent({
      orderId: this.id,
      confirmedAt: new Date()
    }));
  }
}

// ✅ CORRECT: State changes logging
import { LogStateChanges } from '@vytches-ddd/logging';

export class Order extends AggregateRoot {
  @LogStateChanges({
    captureBeforeState: true,
    captureAfterState: true,
    includeMetadata: true
  })
  updateStatus(newStatus: OrderStatus): void {
    const previousStatus = this.status;
    this.status = newStatus;
    
    // ✅ State change automatically logged with before/after snapshots
    this.addDomainEvent(new OrderStatusChangedEvent({
      orderId: this.id,
      previousStatus,
      newStatus,
      changedAt: new Date()
    }));
  }
}

// ✅ CORRECT: Audit capture decorator
import { captureState } from '@vytches-ddd/events';

export class Order extends AggregateRoot {
  @captureState({
    condition: (order: Order) => order.getTotalAmount().amount > 10000,
    includeMetadata: true,
    auditEventType: 'HighValueOrderAudit'
  })
  processHighValueOrder(): void {
    // ✅ State captured automatically for high-value orders
    this.performHighValueProcessing();
  }
}
```

### Middleware Systems

```typescript
// ✅ CORRECT: CQRS Middleware
import { ICQRSMiddleware, LoggingMiddleware } from '@vytches-ddd/cqrs';

export class ValidationMiddleware implements ICQRSMiddleware {
  async handle<T>(
    request: T,
    next: (request: T) => Promise<any>,
    context: ICQRSExecutionContext
  ): Promise<any> {
    // ✅ Pre-processing
    await this.validateRequest(request);
    
    try {
      // ✅ Execute next middleware/handler
      const result = await next(request);
      
      // ✅ Post-processing
      await this.validateResult(result);
      
      return result;
    } catch (error) {
      // ✅ Error handling
      await this.handleError(error, request, context);
      throw error;
    }
  }
}

// ✅ CORRECT: Enhanced logging middleware
import { EnhancedLoggingMiddleware, createCQRSMiddleware } from '@vytches-ddd/logging';

const loggingMiddleware = createCQRSMiddleware({
  includePayload: true,
  includeResults: false,
  maskSensitiveData: true,
  logLevel: 'info',
  includeExecutionTime: true,
  includeMemoryUsage: true
});

@CommandHandler(CreateOrderCommand, {
  middleware: [
    new ValidationMiddleware(),
    loggingMiddleware,
    new MetricsMiddleware()
  ]
})
export class CreateOrderCommandHandler {
  async handle(command: CreateOrderCommand): Promise<Result<OrderId, Error>> {
    // ✅ All middleware executed in order
    return await this.processOrder(command);
  }
}
```

### Saga Middleware Pipeline

```typescript
// ✅ CORRECT: Saga middleware
import { 
  BaseSagaMiddleware,
  PerformanceMonitoringMiddleware,
  RetryMiddleware,
  CircuitBreakerMiddleware,
  SecurityMiddleware,
  SagaMiddlewarePipeline
} from '@vytches-ddd/messaging';

export class CustomSagaMiddleware extends BaseSagaMiddleware {
  async handle(
    event: IExtendedDomainEvent,
    context: ISagaExecutionContext,
    next: (event: IExtendedDomainEvent, context: ISagaExecutionContext) => Promise<ISagaActionResult>
  ): Promise<ISagaActionResult> {
    // ✅ Custom saga processing logic
    const enrichedContext = await this.enrichContext(context);
    
    return await next(event, enrichedContext);
  }
}

// ✅ CORRECT: Saga pipeline setup
const sagaMiddleware = SagaMiddlewarePipeline.create()
  .use(new SecurityMiddleware({
    validateCorrelationId: true,
    requireAuthentication: true
  }))
  .use(new PerformanceMonitoringMiddleware({
    enableMetrics: true,
    slowThreshold: 5000
  }))
  .use(new RetryMiddleware({
    maxAttempts: 3,
    baseDelay: 1000,
    exponentialBackoff: true
  }))
  .use(new CircuitBreakerMiddleware({
    failureThreshold: 5,
    recoveryTimeout: 60000
  }))
  .use(new CustomSagaMiddleware())
  .build();

// ✅ Apply to saga
@Saga('OrderProcessingSaga', {
  middleware: sagaMiddleware
})
export class OrderProcessingSaga {
  // Saga implementation with middleware pipeline
}
```

### Capabilities System

```typescript
// ✅ CORRECT: Aggregate capabilities
import { 
  AuditCapability,
  EventSourcingCapability,
  SnapshotCapability,
  VersioningCapability
} from '@vytches-ddd/aggregates';

export class Order extends AggregateRoot {
  constructor(id: EntityId) {
    super(id);
    
    // ✅ Add capabilities
    this.addCapability(new AuditCapability({
      auditLevel: 'detailed',
      includeStateSnapshots: true
    }));
    
    this.addCapability(new EventSourcingCapability({
      enableSnapshots: true,
      snapshotFrequency: 10
    }));
    
    this.addCapability(new SnapshotCapability({
      compressionEnabled: true,
      encryptionEnabled: true
    }));
    
    this.addCapability(new VersioningCapability({
      enableOptimisticLocking: true,
      versionProperty: 'version'
    }));
  }
}

// ✅ CORRECT: Projection capabilities
import { 
  CheckpointCapability,
  CircuitBreakerCapability,
  DeadLetterCapability,
  SnapshotCapability
} from '@vytches-ddd/projections';

export class OrderProjection implements IProjection {
  constructor(private database: Database) {
    const engine = new ProjectionEngine(this, eventStore);
    
    // ✅ Add projection capabilities
    engine.addCapability(new CheckpointCapability({
      frequency: 100,
      persistTo: 'database'
    }));
    
    engine.addCapability(new CircuitBreakerCapability({
      failureThreshold: 5,
      recoveryTimeout: 60000
    }));
    
    engine.addCapability(new DeadLetterCapability({
      maxRetries: 3,
      deadLetterQueue: 'failed_projections'
    }));
    
    engine.addCapability(new SnapshotCapability({
      enabled: true,
      frequency: 1000
    }));
  }
}
```

### Processor Patterns

```typescript
// ✅ CORRECT: Event processors
import { 
  EventProcessor,
  AuditProcessor,
  IntegrationProcessor 
} from '@vytches-ddd/events';

export class OrderEventProcessor extends EventProcessor {
  async process(event: IDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'OrderCreated':
        await this.handleOrderCreated(event as OrderCreatedEvent);
        break;
      case 'OrderConfirmed':
        await this.handleOrderConfirmed(event as OrderConfirmedEvent);
        break;
    }
  }
}

// ✅ CORRECT: Audit processor
export class OrderAuditProcessor extends AuditProcessor {
  async processAuditEvent(event: IAuditEvent): Promise<void> {
    await this.auditRepository.save({
      eventId: event.id,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      auditData: event.auditData,
      timestamp: event.occurredOn
    });
  }
}

// ✅ CORRECT: Integration processor
export class OrderIntegrationProcessor extends IntegrationProcessor {
  async processIntegrationEvent(event: IIntegrationEvent): Promise<void> {
    // ✅ Send to external systems
    await this.externalEventBus.publish(event);
    
    // ✅ Update read models
    await this.updateReadModels(event);
  }
}

// ✅ CORRECT: Outbox processor
import { OutboxProcessor } from '@vytches-ddd/messaging';

export class OrderOutboxProcessor extends OutboxProcessor {
  async processOutboxMessages(messages: OutboxMessage[]): Promise<void> {
    for (const message of messages) {
      try {
        await this.publishMessage(message);
        await this.markAsProcessed(message);
      } catch (error) {
        await this.handleProcessingError(message, error);
      }
    }
  }
}
```

### Advanced Builder Patterns

```typescript
// ✅ CORRECT: Resilience builder
import { ResiliencePolicyBuilder } from '@vytches-ddd/resilience';

const resiliencePolicy = ResiliencePolicyBuilder.create()
  .withName('payment-service-policy')
  .withTimeout(30000)
  .withCircuitBreaker({
    failureThreshold: 5,
    recoveryTimeout: 60000,
    expectedErrors: [TimeoutError, ConnectionError]
  })
  .withRetry({
    maxAttempts: 3,
    baseDelay: 1000,
    backoff: 'exponential',
    jitter: true
  })
  .withBulkhead({
    maxConcurrentCalls: 10,
    maxQueueSize: 50
  })
  .withMetrics({
    enabled: true,
    metricsCollector: new PrometheusCollector()
  })
  .build();

// ✅ CORRECT: Aggregate builder
import { AggregateBuilder } from '@vytches-ddd/aggregates';

const orderAggregate = AggregateBuilder.create<Order>()
  .withId(OrderId.generate())
  .withCapabilities([
    new AuditCapability(),
    new EventSourcingCapability(),
    new SnapshotCapability()
  ])
  .withEventHandlers({
    'OrderCreated': (event) => this.handleOrderCreated(event),
    'OrderConfirmed': (event) => this.handleOrderConfirmed(event)
  })
  .withValidation(new OrderValidationPolicy())
  .build();

// ✅ CORRECT: Projection builder
import { ProjectionBuilder } from '@vytches-ddd/projections';

const orderProjection = ProjectionBuilder.create()
  .withName('OrderProjection')
  .withEventStore(eventStore)
  .withCapabilities([
    new CheckpointCapability(),
    new CircuitBreakerCapability(),
    new DeadLetterCapability()
  ])
  .withEventHandlers({
    'OrderCreated': async (event) => await this.handleOrderCreated(event),
    'OrderConfirmed': async (event) => await this.handleOrderConfirmed(event)
  })
  .withErrorStrategy({
    maxRetries: 3,
    retryDelay: 1000,
    deadLetterAfter: 5
  })
  .build();
```

### Registry Systems

```typescript
// ✅ CORRECT: Capability registry
import { CapabilityRegistry } from '@vytches-ddd/contracts';

const capabilityRegistry = new CapabilityRegistry();

// ✅ Register capabilities
capabilityRegistry.register('audit', AuditCapability);
capabilityRegistry.register('event-sourcing', EventSourcingCapability);
capabilityRegistry.register('snapshot', SnapshotCapability);
capabilityRegistry.register('versioning', VersioningCapability);

// ✅ Resolve capabilities
const auditCapability = capabilityRegistry.resolve<AuditCapability>('audit', {
  auditLevel: 'detailed',
  includeStateSnapshots: true
});

// ✅ CORRECT: Metric registry
import { MetricRegistry } from '@vytches-ddd/resilience';

const metricRegistry = new MetricRegistry();

// ✅ Register metrics
metricRegistry.counter('orders_created_total', 'Total orders created');
metricRegistry.histogram('order_processing_duration', 'Order processing duration');
metricRegistry.gauge('active_orders', 'Currently active orders');

// ✅ Use metrics
metricRegistry.increment('orders_created_total', { customerId: 'customer-123' });
metricRegistry.observe('order_processing_duration', processingTime);
metricRegistry.set('active_orders', activeOrderCount);

// ✅ CORRECT: Enhanced policy registry
import { PolicyRegistry } from '@vytches-ddd/policies';

const policyRegistry = new PolicyRegistry();

// ✅ Register with metadata
policyRegistry.register({
  id: 'order-validation',
  domain: 'order-management',
  name: 'Order Validation Policy',
  version: '2.0.0',
  policy: orderValidationPolicy,
  tags: ['validation', 'business-rules'],
  metadata: {
    author: 'domain-team',
    lastUpdated: new Date(),
    dependencies: ['inventory-policy', 'payment-policy']
  }
});

// ✅ Query policies
const orderPolicies = policyRegistry.findByDomain('order-management');
const validationPolicies = policyRegistry.findByTag('validation');
const recentPolicies = policyRegistry.findUpdatedSince(lastWeek);

// ✅ Policy composition
const compositePolicy = policyRegistry.compose([
  'order-validation',
  'inventory-validation',
  'payment-validation'
]);
```

---

## 🛠️ CLI Code Generation

### CLI Installation and Setup

```bash
# Install CLI globally
npm install -g @vytches-ddd/cli

# Or install in project
npm install --save-dev @vytches-ddd/cli

# Verify installation
vytches-ddd --version
```

### Code Generation Commands

```bash
# Interactive mode - recommended for beginners
vytches-ddd generate --interactive

# Generate specific components
vytches-ddd generate --type aggregate --name Order --output ./src/domain/aggregates/
vytches-ddd generate --type entity --name OrderItem --output ./src/domain/entities/
vytches-ddd generate --type value-object --name Money --output ./src/domain/value-objects/
vytches-ddd generate --type command --name CreateOrder --output ./src/application/commands/
vytches-ddd generate --type query --name GetOrder --output ./src/application/queries/
vytches-ddd generate --type event --name OrderCreated --output ./src/domain/events/
vytches-ddd generate --type policy --name OrderValidation --output ./src/domain/policies/
vytches-ddd generate --type repository --name Order --output ./src/infrastructure/repositories/
vytches-ddd generate --type domain-service --name OrderService --output ./src/domain/services/
vytches-ddd generate --type saga --name OrderProcessing --output ./src/application/sagas/

# Generate complete bounded context
vytches-ddd generate --type bounded-context --name OrderManagement --output ./src/

# Generate NestJS integration
vytches-ddd generate --type nestjs-module --name Order --output ./src/modules/

# Generate test files
vytches-ddd generate --type test --name Order --test-type unit --output ./tests/unit/
vytches-ddd generate --type test --name OrderWorkflow --test-type integration --output ./tests/integration/

# Generate CLAUDE.md template
vytches-ddd generate --type claude-template --output ./
```

### Generated Code Examples

#### ✅ Generated Aggregate

```typescript
// Generated: src/domain/aggregates/order.aggregate.ts
import { AggregateRoot, EntityId } from '@vytches-ddd/core';
import { OrderCreatedEvent } from '../events/order-created.event';

export class Order extends AggregateRoot {
  private constructor(
    id: EntityId,
    private customerId: CustomerId,
    private items: OrderItem[] = [],
    private status: OrderStatus = OrderStatus.PENDING
  ) {
    super(id);
  }

  static create(data: CreateOrderData): Order {
    const order = new Order(
      EntityId.generate(),
      data.customerId
    );

    order.addDomainEvent(new OrderCreatedEvent({
      orderId: order.id,
      customerId: data.customerId,
      createdAt: new Date()
    }));

    return order;
  }

  // Additional methods...
}
```

#### ✅ Generated Command Handler

```typescript
// Generated: src/application/commands/create-order.handler.ts
import { CommandHandler } from '@vytches-ddd/di';
import { LogCommands } from '@vytches-ddd/logging';
import { Result } from '@vytches-ddd/utils';

@CommandHandler(CreateOrderCommand)
@LogCommands({ includePayload: true })
export class CreateOrderCommandHandler {
  constructor(
    private orderRepository: OrderRepository,
    private orderService: OrderService
  ) {}

  async handle(command: CreateOrderCommand): Promise<Result<OrderId, Error>> {
    try {
      const order = Order.create(command.data);
      await this.orderRepository.save(order);
      return Result.success(order.id);
    } catch (error) {
      return Result.failure(error as Error);
    }
  }
}
```

#### ✅ Generated Repository

```typescript
// Generated: src/infrastructure/repositories/order.repository.ts
import { IBaseRepository } from '@vytches-ddd/core';
import { UniversalEventDispatcher } from '@vytches-ddd/events';

export class OrderRepository extends IBaseRepository<Order> {
  constructor(
    private database: Database,
    universalDispatcher: UniversalEventDispatcher
  ) {
    super(universalDispatcher);
  }

  async findById(id: OrderId): Promise<Order | null> {
    const data = await this.database.orders.findFirst({
      where: { id: id.value },
      include: { items: true }
    });

    return data ? this.mapToDomain(data) : null;
  }

  protected async persist(order: Order): Promise<void> {
    await this.database.orders.upsert({
      where: { id: order.id.value },
      update: this.mapToDatabase(order),
      create: this.mapToDatabase(order)
    });
  }

  private mapToDomain(data: any): Order {
    // Mapping logic generated based on aggregate structure
  }

  private mapToDatabase(order: Order): any {
    // Mapping logic generated based on aggregate structure
  }
}
```

#### ✅ Generated Test Files

```typescript
// Generated: tests/unit/domain/aggregates/order.test.ts
import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { Order } from '../../../../src/domain/aggregates/order.aggregate';

describe('Order Aggregate', () => {
  describe('create', () => {
    it('should create order successfully', () => {
      const data = {
        customerId: CustomerId.generate()
      };

      const [error, order] = safeRun(() => Order.create(data));

      expect(error).toBeUndefined();
      expect(order).toBeDefined();
      expect(order?.customerId).toBe(data.customerId);
    });

    it('should publish OrderCreatedEvent', () => {
      const data = {
        customerId: CustomerId.generate()
      };

      const [error, order] = safeRun(() => Order.create(data));

      expect(error).toBeUndefined();
      expect(order?.getUncommittedEvents()).toHaveLength(1);
      expect(order?.getUncommittedEvents()[0]).toBeInstanceOf(OrderCreatedEvent);
    });
  });
});
```

### CLI Configuration

```typescript
// vytches-ddd.config.ts
export default {
  // Output directories
  output: {
    aggregates: './src/domain/aggregates',
    entities: './src/domain/entities',
    valueObjects: './src/domain/value-objects',
    commands: './src/application/commands',
    queries: './src/application/queries',
    events: './src/domain/events',
    policies: './src/domain/policies',
    repositories: './src/infrastructure/repositories',
    services: './src/domain/services',
    tests: './tests'
  },

  // Framework integration
  framework: 'nestjs', // or 'express', 'fastify', etc.

  // Naming conventions
  naming: {
    aggregates: 'PascalCase',
    entities: 'PascalCase',
    valueObjects: 'PascalCase',
    commands: 'PascalCase',
    events: 'PascalCase'
  },

  // Template customization
  templates: {
    useCustomTemplates: false,
    templatePath: './templates'
  },

  // Testing configuration
  testing: {
    framework: 'vitest',
    useSafeRun: true,
    generateApiSurfaceTests: true
  }
};
```

### Advanced CLI Features

```bash
# Generate with custom templates
vytches-ddd generate --type aggregate --name Order --template ./custom-templates/

# Generate with specific framework
vytches-ddd generate --type module --name Order --framework nestjs

# Generate multiple related components
vytches-ddd generate --type workflow --name OrderProcessing
# This generates: aggregate, commands, events, handlers, repository, tests

# Preview generated code without writing files
vytches-ddd generate --type aggregate --name Order --dry-run

# Generate from existing database schema
vytches-ddd generate --from-schema --connection postgresql://localhost:5432/mydb

# Generate API documentation
vytches-ddd docs --generate --output ./docs/api/

# Validate project structure
vytches-ddd validate --check-patterns --check-dependencies

# Analyze code quality
vytches-ddd analyze --metrics --output ./reports/
```

### Template Customization

```typescript
// custom-templates/aggregate.template
import { AggregateRoot, EntityId } from '@vytches-ddd/core';
{{#each events}}
import { {{name}} } from '../events/{{kebabCase name}}.event';
{{/each}}

/**
 * {{description}}
 * @aggregate {{name}}
 */
export class {{name}} extends AggregateRoot {
  private constructor(
    id: EntityId,
    {{#each properties}}
    private {{name}}: {{type}},
    {{/each}}
  ) {
    super(id);
  }

  static create(data: Create{{name}}Data): {{name}} {
    const {{camelCase name}} = new {{name}}(
      EntityId.generate(),
      {{#each properties}}
      data.{{name}},
      {{/each}}
    );

    {{#each events}}
    {{#if isCreationEvent}}
    {{camelCase ../name}}.addDomainEvent(new {{name}}({
      {{camelCase ../name}}Id: {{camelCase ../name}}.id,
      {{#each ../properties}}
      {{name}}: data.{{name}},
      {{/each}}
    }));
    {{/if}}
    {{/each}}

    return {{camelCase name}};
  }

  {{#each methods}}
  {{visibility}} {{name}}({{#each parameters}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}): {{returnType}} {
    {{#if hasBusinessRules}}
    this.validate{{pascalCase name}}({{#each parameters}}{{name}}{{#unless @last}}, {{/unless}}{{/each}});
    {{/if}}

    {{#each businessLogic}}
    {{this}}
    {{/each}}

    {{#if hasEvents}}
    {{#each events}}
    this.addDomainEvent(new {{name}}({
      {{camelCase ../../name}}Id: this.id,
      {{#each properties}}
      {{name}}: {{value}},
      {{/each}}
    }));
    {{/each}}
    {{/if}}
  }
  {{/each}}
}
```

### Integration with Development Workflow

```bash
# Setup new project with CLI
vytches-ddd init --name my-ddd-project --framework nestjs
cd my-ddd-project

# Generate bounded context
vytches-ddd generate --type bounded-context --name UserManagement

# Generate aggregate with related components
vytches-ddd generate --type aggregate --name User --with-commands --with-events --with-repository

# Generate tests
vytches-ddd generate --type test --name User --test-type unit,integration,e2e

# Run quality checks
vytches-ddd validate --fix-imports --format-code

# Generate documentation
vytches-ddd docs --generate --include-examples
```

## 📚 Quick Reference

### Essential Commands

```bash
# Install library
npm install @vytches-ddd/core @vytches-ddd/logging @vytches-ddd/cqrs

# Install CLI
npm install -g @vytches-ddd/cli

# Generate CLAUDE.md template
vytches-ddd generate --type claude-template --output ./

# Generate complete workflow
vytches-ddd generate --type workflow --name OrderProcessing --output ./src/

# Run tests with safeRun pattern
npm test

# Enable debug logging
DEBUG=vytches-ddd:* npm start
```

### Key Imports

```typescript
// Core
import { AggregateRoot, EntityId, BaseError } from '@vytches-ddd/core';

// Application
import { CommandBus, QueryBus } from '@vytches-ddd/cqrs';
import { VytchesDDD, DomainService } from '@vytches-ddd/di';

// Patterns
import { PolicyBuilder } from '@vytches-ddd/policies';
import { CircuitBreaker } from '@vytches-ddd/resilience';

// Utilities
import { safeRun, Result } from '@vytches-ddd/utils';
import { Logger } from '@vytches-ddd/logging';
```

### Best Practices Checklist

- ✅ Use meta-package imports for stable API
- ✅ Extend AggregateRoot for domain aggregates
- ✅ Use Repository pattern for automatic event publishing
- ✅ Implement CQRS with command/query handlers
- ✅ Use PolicyBuilder for business rules
- ✅ Use safeRun for error testing
- ✅ Configure structured logging
- ✅ Implement resilience patterns
- ✅ Use DI container for service resolution
- ✅ Test with comprehensive coverage

---

**Remember: The @vytches-ddd library provides enterprise-grade DDD patterns. Use them consistently throughout your codebase for maximum benefit. This template covers 100% of library functionality - refer to specific sections as needed.**
