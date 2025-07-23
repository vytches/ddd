# CQRS with Distributed Tracing and Observability

**Version**: 1.0.0 **Package**: @vytches-ddd/cqrs **Complexity**: Intermediate
**Domain**: Architecture **Patterns**: CQRS, Distributed tracing, Observability,
Performance monitoring **Dependencies**: @vytches-ddd/cqrs,
@vytches-ddd/logging, @vytches-ddd/resilience, @vytches-ddd/utils

## Description

This example demonstrates implementing comprehensive observability for CQRS
operations in distributed systems. It shows how to add distributed tracing,
performance monitoring, and advanced logging to commands and queries for
enterprise-grade monitoring and debugging capabilities.

## Business Context

In microservices architectures, observability is critical for:

- Tracking requests across multiple services
- Understanding performance bottlenecks
- Debugging complex distributed transactions
- Meeting SLA requirements through proactive monitoring
- Compliance with audit and regulatory requirements
- Root cause analysis of production issues

## Code Example

```typescript
// observable-cqrs.ts
import {
  Command,
  Query,
  CommandHandler,
  QueryHandler,
} from '@vytches-ddd/cqrs';
import { Logger } from '@vytches-ddd/logging';
import { CircuitBreaker, Retry } from '@vytches-ddd/resilience';
import { Result } from '@vytches-ddd/utils';
import type {
  TraceContext,
  PerformanceMetrics,
  OrderData,
  InventoryStatus,
} from '../types'; // From your application

// ✅ FOCUS: Command with trace context
export class CreateOrderCommand extends Command {
  public readonly traceId: string;
  public readonly spanId: string;
  public readonly parentSpanId?: string;

  constructor(
    public readonly orderData: OrderData,
    public readonly traceContext: TraceContext
  ) {
    super();
    this.traceId = traceContext.traceId || this.generateTraceId();
    this.spanId = this.generateSpanId();
    this.parentSpanId = traceContext.spanId;
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Propagate trace context
  createChildContext(): TraceContext {
    return {
      traceId: this.traceId,
      spanId: this.generateSpanId(),
      parentSpanId: this.spanId,
      baggage: this.traceContext.baggage,
    };
  }
}

// ✅ FOCUS: Observable command handler with performance tracking
@CommandHandler(CreateOrderCommand)
export class ObservableCreateOrderHandler {
  private readonly logger = Logger.forContext('CreateOrderHandler').withContext(
    { service: 'order-service' }
  );

  constructor(
    private readonly inventoryService: IInventoryService,
    private readonly paymentService: IPaymentService,
    private readonly metricsCollector: IMetricsCollector
  ) {}

  @CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 })
  @Retry({ maxAttempts: 3, baseDelay: 1000 })
  async execute(
    command: CreateOrderCommand
  ): Promise<Result<OrderResult, OrderError>> {
    const startTime = process.hrtime.bigint();
    const span = this.startSpan('create-order', command);

    // ✅ FOCUS: Structured logging with trace context
    this.logger
      .withCorrelationId(command.traceId)
      .withContext({
        spanId: command.spanId,
        parentSpanId: command.parentSpanId,
        operation: 'CreateOrder',
      })
      .info('Starting order creation', {
        orderId: command.orderData.orderId,
        customerId: command.orderData.customerId,
        itemCount: command.orderData.items.length,
        totalAmount: command.orderData.totalAmount,
      });

    try {
      // ✅ FOCUS: Child span for inventory check
      const inventorySpan = this.startChildSpan(
        'check-inventory',
        command.createChildContext()
      );

      const inventoryResult = await this.checkInventory(
        command.orderData,
        command.createChildContext()
      );

      this.endSpan(inventorySpan, {
        status: inventoryResult.isSuccess ? 'success' : 'failed',
      });

      if (inventoryResult.isFailure()) {
        throw new Error(
          `Inventory check failed: ${inventoryResult.error.message}`
        );
      }

      // ✅ FOCUS: Child span for payment processing
      const paymentSpan = this.startChildSpan(
        'process-payment',
        command.createChildContext()
      );

      const paymentResult = await this.processPayment(
        command.orderData,
        command.createChildContext()
      );

      this.endSpan(paymentSpan, {
        status: paymentResult.isSuccess ? 'success' : 'failed',
        paymentMethod: command.orderData.paymentMethod,
      });

      if (paymentResult.isFailure()) {
        // Compensate inventory reservation
        await this.releaseInventory(
          command.orderData,
          command.createChildContext()
        );
        throw new Error(`Payment failed: ${paymentResult.error.message}`);
      }

      const result: OrderResult = {
        orderId: command.orderData.orderId,
        status: 'CONFIRMED',
        trackingNumber: this.generateTrackingNumber(),
        estimatedDelivery: this.calculateDeliveryDate(),
      };

      // ✅ FOCUS: Performance metrics collection
      const executionTime =
        Number(process.hrtime.bigint() - startTime) / 1_000_000; // ms

      await this.metricsCollector.recordMetrics({
        operation: 'CreateOrder',
        executionTimeMs: executionTime,
        status: 'success',
        tags: {
          customerId: command.orderData.customerId,
          orderValue: command.orderData.totalAmount.toString(),
          itemCount: command.orderData.items.length.toString(),
        },
      });

      this.logger.info('Order created successfully', {
        orderId: result.orderId,
        executionTimeMs: executionTime,
        traceId: command.traceId,
      });

      this.endSpan(span, {
        status: 'success',
        orderId: result.orderId,
        executionTimeMs: executionTime,
      });

      return Result.ok(result);
    } catch (error) {
      const executionTime =
        Number(process.hrtime.bigint() - startTime) / 1_000_000;

      // ✅ FOCUS: Error tracking with context
      this.logger.error('Order creation failed', {
        error: (error as Error).message,
        orderId: command.orderData.orderId,
        executionTimeMs: executionTime,
        traceId: command.traceId,
        spanId: command.spanId,
      });

      await this.metricsCollector.recordMetrics({
        operation: 'CreateOrder',
        executionTimeMs: executionTime,
        status: 'failed',
        errorType: (error as Error).name,
        tags: {
          customerId: command.orderData.customerId,
        },
      });

      this.endSpan(span, {
        status: 'error',
        error: (error as Error).message,
        executionTimeMs: executionTime,
      });

      return Result.fail({
        type: 'ORDER_CREATION_FAILED',
        message: (error as Error).message,
        traceId: command.traceId,
      });
    }
  }

  private async checkInventory(
    orderData: OrderData,
    traceContext: TraceContext
  ): Promise<Result<InventoryStatus, Error>> {
    // Propagate trace context to downstream service
    return await this.inventoryService.checkAvailability(orderData.items, {
      'X-Trace-Id': traceContext.traceId,
      'X-Span-Id': traceContext.spanId,
      'X-Parent-Span-Id': traceContext.parentSpanId,
    });
  }

  private startSpan(operation: string, command: CreateOrderCommand): ISpan {
    return {
      traceId: command.traceId,
      spanId: command.spanId,
      operation,
      startTime: Date.now(),
      tags: {
        'command.type': command.constructor.name,
        'order.id': command.orderData.orderId,
      },
    };
  }

  private startChildSpan(operation: string, context: TraceContext): ISpan {
    return {
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      operation,
      startTime: Date.now(),
    };
  }

  private endSpan(span: ISpan, attributes: Record<string, any>): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.attributes = { ...span.attributes, ...attributes };

    // Send span to tracing backend
    this.sendSpanToBackend(span);
  }

  private sendSpanToBackend(span: ISpan): void {
    // Implementation for sending to Jaeger, Zipkin, etc.
  }
}

// ✅ FOCUS: Observable query with caching metrics
export class GetOrderHistoryQuery extends Query<OrderHistory[]> {
  constructor(
    public readonly customerId: string,
    public readonly filters: OrderFilters,
    public readonly traceContext: TraceContext
  ) {
    super();
  }
}

@QueryHandler(GetOrderHistoryQuery)
export class ObservableOrderHistoryHandler {
  private readonly logger = Logger.forContext('OrderHistoryHandler');

  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly cacheService: ICacheService,
    private readonly metricsCollector: IMetricsCollector
  ) {}

  async execute(
    query: GetOrderHistoryQuery
  ): Promise<Result<OrderHistory[], Error>> {
    const startTime = process.hrtime.bigint();
    const cacheKey = this.generateCacheKey(query);

    this.logger
      .withCorrelationId(query.traceContext.traceId)
      .debug('Executing order history query', {
        customerId: query.customerId,
        filters: query.filters,
      });

    // ✅ FOCUS: Cache performance tracking
    const cacheResult = await this.checkCache(cacheKey, query.traceContext);

    if (cacheResult.isSuccess && cacheResult.value) {
      const executionTime =
        Number(process.hrtime.bigint() - startTime) / 1_000_000;

      await this.metricsCollector.recordMetrics({
        operation: 'GetOrderHistory',
        executionTimeMs: executionTime,
        status: 'success',
        cacheHit: true,
        tags: {
          customerId: query.customerId,
        },
      });

      this.logger.debug('Order history served from cache', {
        executionTimeMs: executionTime,
        resultCount: cacheResult.value.length,
      });

      return Result.ok(cacheResult.value);
    }

    // ✅ FOCUS: Database query performance tracking
    const dbStartTime = process.hrtime.bigint();

    try {
      const orders = await this.orderRepository.findByCustomer(
        query.customerId,
        query.filters
      );

      const dbExecutionTime =
        Number(process.hrtime.bigint() - dbStartTime) / 1_000_000;

      // Track database performance
      await this.metricsCollector.recordMetrics({
        operation: 'OrderRepository.findByCustomer',
        executionTimeMs: dbExecutionTime,
        status: 'success',
        resultCount: orders.length,
        tags: {
          customerId: query.customerId,
          hasFilters: Object.keys(query.filters).length > 0 ? 'true' : 'false',
        },
      });

      // Update cache
      await this.cacheService.set(cacheKey, orders, 300); // 5 minutes TTL

      const totalExecutionTime =
        Number(process.hrtime.bigint() - startTime) / 1_000_000;

      await this.metricsCollector.recordMetrics({
        operation: 'GetOrderHistory',
        executionTimeMs: totalExecutionTime,
        status: 'success',
        cacheHit: false,
        dbTimeMs: dbExecutionTime,
        tags: {
          customerId: query.customerId,
          resultCount: orders.length.toString(),
        },
      });

      this.logger.info('Order history query completed', {
        executionTimeMs: totalExecutionTime,
        dbTimeMs: dbExecutionTime,
        resultCount: orders.length,
        cacheUpdated: true,
      });

      return Result.ok(orders);
    } catch (error) {
      const executionTime =
        Number(process.hrtime.bigint() - startTime) / 1_000_000;

      this.logger.error('Order history query failed', {
        error: (error as Error).message,
        customerId: query.customerId,
        executionTimeMs: executionTime,
      });

      await this.metricsCollector.recordMetrics({
        operation: 'GetOrderHistory',
        executionTimeMs: executionTime,
        status: 'failed',
        errorType: (error as Error).name,
        tags: {
          customerId: query.customerId,
        },
      });

      return Result.fail(error as Error);
    }
  }

  private generateCacheKey(query: GetOrderHistoryQuery): string {
    const filterHash = this.hashObject(query.filters);
    return `order-history:${query.customerId}:${filterHash}`;
  }

  private hashObject(obj: any): string {
    // Simple hash implementation
    return JSON.stringify(obj);
  }

  private async checkCache(
    key: string,
    traceContext: TraceContext
  ): Promise<Result<OrderHistory[] | null, Error>> {
    const startTime = process.hrtime.bigint();

    try {
      const cached = await this.cacheService.get<OrderHistory[]>(key);
      const executionTime =
        Number(process.hrtime.bigint() - startTime) / 1_000_000;

      await this.metricsCollector.recordMetrics({
        operation: 'CacheService.get',
        executionTimeMs: executionTime,
        status: 'success',
        cacheHit: !!cached,
        tags: {
          cacheKey: key,
        },
      });

      return Result.ok(cached);
    } catch (error) {
      return Result.fail(error as Error);
    }
  }
}

// ✅ FOCUS: Observability middleware
export class ObservabilityMiddleware
  implements ICommandMiddleware, IQueryMiddleware
{
  private readonly logger = Logger.forContext('ObservabilityMiddleware');

  async execute<T extends Command | Query<any>>(
    operation: T,
    next: () => Promise<any>
  ): Promise<any> {
    const isCommand = operation instanceof Command;
    const operationType = isCommand ? 'Command' : 'Query';
    const operationName = operation.constructor.name;
    const startTime = process.hrtime.bigint();

    // Extract trace context
    const traceContext = (operation as any).traceContext || {};

    this.logger
      .withCorrelationId(traceContext.traceId)
      .debug(`${operationType} started`, {
        operation: operationName,
        traceId: traceContext.traceId,
        spanId: traceContext.spanId,
      });

    try {
      const result = await next();
      const executionTime =
        Number(process.hrtime.bigint() - startTime) / 1_000_000;

      this.logger.debug(`${operationType} completed`, {
        operation: operationName,
        executionTimeMs: executionTime,
        success: true,
      });

      // Record operation metrics
      await this.recordOperationMetrics({
        operationType,
        operationName,
        executionTimeMs: executionTime,
        status: 'success',
        traceId: traceContext.traceId,
      });

      return result;
    } catch (error) {
      const executionTime =
        Number(process.hrtime.bigint() - startTime) / 1_000_000;

      this.logger.error(`${operationType} failed`, {
        operation: operationName,
        executionTimeMs: executionTime,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });

      await this.recordOperationMetrics({
        operationType,
        operationName,
        executionTimeMs: executionTime,
        status: 'failed',
        errorType: (error as Error).name,
        traceId: traceContext.traceId,
      });

      throw error;
    }
  }

  private async recordOperationMetrics(
    metrics: OperationMetrics
  ): Promise<void> {
    // Send metrics to monitoring backend
  }
}
```

## Key Features

- **Distributed Tracing**: Complete trace context propagation across services
- **Performance Monitoring**: Detailed timing metrics for all operations
- **Structured Logging**: Comprehensive logging with trace correlation
- **Cache Performance**: Monitoring of cache hit rates and performance
- **Database Metrics**: Tracking of repository operation performance
- **Error Tracking**: Detailed error context with trace information
- **Resilience Integration**: Circuit breakers and retry patterns with
  observability
- **Middleware Instrumentation**: Automatic tracking of all CQRS operations

## Usage Examples

```typescript
// Configure buses with observability
const commandBus = new CommandBus();
commandBus.use(new ObservabilityMiddleware());
commandBus.use(new TracingMiddleware());

const queryBus = new QueryBus();
queryBus.use(new ObservabilityMiddleware());
queryBus.use(new CacheMiddleware());

// Execute command with trace context
const traceContext: TraceContext = {
  traceId: 'trace-123',
  spanId: 'span-456',
  baggage: {
    userId: 'user-789',
    sessionId: 'session-123',
  },
};

const createOrderCommand = new CreateOrderCommand(
  {
    orderId: 'order-123',
    customerId: 'customer-456',
    items: [
      /* ... */
    ],
    totalAmount: 150.0,
    paymentMethod: 'CREDIT_CARD',
  },
  traceContext
);

const result = await commandBus.execute(createOrderCommand);

// Execute query with tracing
const historyQuery = new GetOrderHistoryQuery(
  'customer-456',
  { status: 'COMPLETED', limit: 10 },
  traceContext
);

const orders = await queryBus.execute(historyQuery);
```

## Common Pitfalls

- **Missing Trace Context**: Always propagate trace context through the call
  chain
- **Excessive Logging**: Balance between observability and performance impact
- **Metric Cardinality**: Avoid high-cardinality tags that can overwhelm
  monitoring systems
- **Span Leaks**: Always close spans to avoid memory leaks
- **Synchronous Metrics**: Use async metric collection to avoid blocking
  operations
- **Missing Error Context**: Include relevant context in error logs and metrics

## Related Examples

- [Basic Command Handlers](../basic/example-1.md) - Foundation command patterns
- [Query Optimization](../basic/example-2.md) - Query performance patterns
- [Security Policies](./example-2.md) - Policy-based authorization
- [Distributed CQRS](../advanced/example-1.md) - Advanced distributed patterns
