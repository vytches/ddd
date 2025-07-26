# Event System - NestJS Intermediate Integration

**Version**: 1.0.0 **Package**: @vytches/ddd-events **Complexity**: intermediate
**Domain**: Integration **Patterns**: batch-processing, context-filtering,
event-middleware, resilience **Dependencies**: @nestjs/common,
@vytches/ddd-events, @vytches/ddd-di, @vytches/ddd-resilience

## Description

Advanced NestJS integration with batch event processing, context filtering, and
resilience patterns. This example demonstrates enterprise-grade event handling
with middleware, circuit breakers, and performance optimization for
high-throughput applications.

## Business Context

High-volume applications need sophisticated event processing with batch
operations, context-aware routing, and fault tolerance. This includes scenarios
like processing thousands of orders, handling multi-tenant events, and ensuring
system resilience during peak loads or service failures.

## Code Example

```typescript
// batch-order.service.ts
import { DomainService, ServiceLifetime } from '@vytches/ddd-di';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { CircuitBreaker, RetryPolicy } from '@vytches/ddd-resilience';
import { BatchOrderRequest, Order, ProcessingResult } from './types'; // From your app

@DomainService({
  serviceId: 'batchOrderService',
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderProcessing',
})
export class BatchOrderService {
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryPolicy: RetryPolicy;

  constructor(
    private readonly eventBus: UnifiedEventBus,
    private readonly orderRepository: OrderRepository
  ) {
    // ⭐ FOCUS: Resilience patterns for batch processing
    this.circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 1 minute recovery
    this.retryPolicy = new RetryPolicy(3, 1000); // 3 attempts, 1 second base delay
  }

  async processBatchOrders(
    batchRequest: BatchOrderRequest,
    contextId?: string
  ): Promise<ProcessingResult> {
    try {
      // ⭐ FOCUS: Batch processing with resilience
      const result = await this.circuitBreaker.execute(async () => {
        return await this.retryPolicy.execute(async () => {
          return await this.processOrderBatch(batchRequest, contextId);
        });
      });

      return result;
    } catch (error) {
      throw new Error(`Batch order processing failed: ${error.message}`);
    }
  }

  private async processOrderBatch(
    batchRequest: BatchOrderRequest,
    contextId?: string
  ): Promise<ProcessingResult> {
    const results: ProcessingResult[] = [];
    const batchSize = 50; // Process in chunks of 50

    // ⭐ FOCUS: Chunk processing for performance
    for (let i = 0; i < batchRequest.orders.length; i += batchSize) {
      const chunk = batchRequest.orders.slice(i, i + batchSize);
      const chunkResults = await Promise.allSettled(
        chunk.map(orderData =>
          this.processIndividualOrder(orderData, contextId)
        )
      );

      // ⭐ FOCUS: Collect results with error handling
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            orderId: chunk[index].orderId,
            error: result.reason.message,
          });
        }
      });
    }

    // ⭐ FOCUS: Publish batch completion event
    const batchEvent = new BatchOrderProcessedEvent(
      batchRequest.batchId,
      results,
      contextId
    );

    await this.eventBus.publish(batchEvent);

    return {
      batchId: batchRequest.batchId,
      totalOrders: batchRequest.orders.length,
      successfulOrders: results.filter(r => r.success).length,
      failedOrders: results.filter(r => !r.success).length,
      results,
    };
  }

  private async processIndividualOrder(
    orderData: any,
    contextId?: string
  ): Promise<ProcessingResult> {
    try {
      const order = Order.create(orderData, contextId);

      // ⭐ FOCUS: Context-aware event publishing
      if (contextId) {
        order.setContext(contextId);
      }

      await this.orderRepository.save(order);

      return {
        success: true,
        orderId: order.id,
        processedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        orderId: orderData.orderId,
        error: error.message,
      };
    }
  }
}

// context-aware-event.handler.ts
import { DomainService } from '@vytches/ddd-di';
import { UnifiedEventBus, EventHandler } from '@vytches/ddd-events';
import { OrderCreatedEvent, PaymentProcessedEvent } from './types'; // From your app

@DomainService('contextEventHandler')
export class ContextAwareEventHandler {
  constructor(private readonly eventBus: UnifiedEventBus) {
    this.setupContextualHandlers();
  }

  private setupContextualHandlers(): void {
    // ⭐ FOCUS: Context-filtered event handling
    this.eventBus.subscribe(
      'OrderCreated',
      async (event: OrderCreatedEvent) => {
        // Handle based on tenant context
        const tenantId = event.metadata?.tenantId;

        if (tenantId === 'enterprise') {
          await this.handleEnterpriseOrder(event);
        } else if (tenantId === 'premium') {
          await this.handlePremiumOrder(event);
        } else {
          await this.handleStandardOrder(event);
        }
      },
      {
        contextFilter: event => {
          // ⭐ FOCUS: Only handle events from specific contexts
          const allowedContexts = ['order-processing', 'batch-processing'];
          return allowedContexts.includes(event.contextId || 'default');
        },
      }
    );

    // ⭐ FOCUS: Multi-tenant payment processing
    this.eventBus.subscribe(
      'PaymentProcessed',
      async (event: PaymentProcessedEvent) => {
        const region = event.metadata?.region;

        // Route to regional payment handlers
        switch (region) {
          case 'US':
            await this.handleUSPayment(event);
            break;
          case 'EU':
            await this.handleEUPayment(event);
            break;
          case 'APAC':
            await this.handleAPACPayment(event);
            break;
          default:
            await this.handleGlobalPayment(event);
        }
      }
    );
  }

  private async handleEnterpriseOrder(event: OrderCreatedEvent): Promise<void> {
    console.log(`Processing enterprise order: ${event.orderId}`);
    // Enhanced processing for enterprise customers
    // - Priority queue
    // - Dedicated support
    // - Custom pricing rules
  }

  private async handlePremiumOrder(event: OrderCreatedEvent): Promise<void> {
    console.log(`Processing premium order: ${event.orderId}`);
    // Premium customer processing
    // - Faster fulfillment
    // - Premium support notifications
  }

  private async handleStandardOrder(event: OrderCreatedEvent): Promise<void> {
    console.log(`Processing standard order: ${event.orderId}`);
    // Standard processing flow
  }

  private async handleUSPayment(event: PaymentProcessedEvent): Promise<void> {
    console.log(`Processing US payment: ${event.paymentId}`);
    // US-specific payment processing
    // - Compliance requirements
    // - Tax calculations
    // - Fraud detection rules
  }

  private async handleEUPayment(event: PaymentProcessedEvent): Promise<void> {
    console.log(`Processing EU payment: ${event.paymentId}`);
    // EU-specific processing (GDPR, PSD2, etc.)
  }

  private async handleAPACPayment(event: PaymentProcessedEvent): Promise<void> {
    console.log(`Processing APAC payment: ${event.paymentId}`);
    // APAC-specific processing
  }

  private async handleGlobalPayment(
    event: PaymentProcessedEvent
  ): Promise<void> {
    console.log(`Processing global payment: ${event.paymentId}`);
    // Global payment processing
  }
}

// event-middleware.service.ts
import { DomainService } from '@vytches/ddd-di';
import { UnifiedEventBus, DomainEvent } from '@vytches/ddd-events';
import { Logger } from '@vytches/ddd-logging';

@DomainService('eventMiddleware')
export class EventMiddlewareService {
  private readonly logger = Logger.forContext('EventMiddleware');

  constructor(private readonly eventBus: UnifiedEventBus) {
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // ⭐ FOCUS: Logging middleware
    this.eventBus.addMiddleware(
      async (event: DomainEvent, next: () => Promise<void>) => {
        const startTime = Date.now();

        this.logger.info('Event processing started', {
          eventType: event.eventType,
          eventId: event.eventId,
          contextId: event.contextId,
        });

        try {
          await next();

          const duration = Date.now() - startTime;
          this.logger.info('Event processing completed', {
            eventType: event.eventType,
            eventId: event.eventId,
            duration,
            status: 'success',
          });
        } catch (error) {
          const duration = Date.now() - startTime;
          this.logger.error('Event processing failed', {
            eventType: event.eventType,
            eventId: event.eventId,
            duration,
            error: error.message,
            status: 'failed',
          });
          throw error;
        }
      }
    );

    // ⭐ FOCUS: Validation middleware
    this.eventBus.addMiddleware(
      async (event: DomainEvent, next: () => Promise<void>) => {
        if (!event.eventId || !event.eventType || !event.timestamp) {
          throw new Error(`Invalid event structure: ${JSON.stringify(event)}`);
        }

        // Context validation
        if (event.contextId && !this.isValidContext(event.contextId)) {
          throw new Error(`Invalid context: ${event.contextId}`);
        }

        await next();
      }
    );

    // ⭐ FOCUS: Rate limiting middleware
    const rateLimiter = new Map<string, { count: number; resetTime: number }>();
    this.eventBus.addMiddleware(
      async (event: DomainEvent, next: () => Promise<void>) => {
        const key = `${event.eventType}_${event.contextId || 'default'}`;
        const now = Date.now();
        const windowSize = 60000; // 1 minute
        const maxEvents = 1000; // Max 1000 events per minute per context

        const current = rateLimiter.get(key);
        if (!current || now > current.resetTime) {
          rateLimiter.set(key, { count: 1, resetTime: now + windowSize });
        } else {
          current.count++;
          if (current.count > maxEvents) {
            throw new Error(
              `Rate limit exceeded for ${event.eventType} in context ${event.contextId}`
            );
          }
        }

        await next();
      }
    );
  }

  private isValidContext(contextId: string): boolean {
    const validContexts = [
      'order-processing',
      'batch-processing',
      'payment-processing',
      'inventory-management',
      'user-management',
    ];
    return validContexts.includes(contextId);
  }
}

// batch-order.controller.ts
import { Controller, Post, Body, Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { BatchOrderService } from './batch-order.service';
import { BatchOrderRequest } from './types'; // From your app

@Injectable()
@Controller('batch-orders')
export class BatchOrderController {
  private readonly batchOrderService: BatchOrderService;

  constructor() {
    // ⭐ FOCUS: Resolve from VytchesDDD container
    this.batchOrderService = VytchesDDD.resolve<BatchOrderService>(
      'batchOrderService',
      'OrderProcessing'
    );
  }

  @Post('process')
  async processBatch(@Body() request: BatchOrderRequest) {
    try {
      // ⭐ FOCUS: Add context for multi-tenant processing
      const contextId = request.tenantId || 'default';

      const result = await this.batchOrderService.processBatchOrders(
        request,
        contextId
      );

      return {
        success: true,
        batchId: result.batchId,
        totalOrders: result.totalOrders,
        processed: result.successfulOrders,
        failed: result.failedOrders,
        processingTime: Date.now() - request.submittedAt.getTime(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('process/:tenantId')
  async processTenantBatch(
    @Body() request: BatchOrderRequest,
    @Param('tenantId') tenantId: string
  ) {
    // ⭐ FOCUS: Explicit tenant context
    return await this.batchOrderService.processBatchOrders(request, tenantId);
  }
}

// order.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';
import { BatchOrderController } from './batch-order.controller';

@Module({
  controllers: [BatchOrderController],
})
export class OrderModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ FOCUS: Initialize with context-aware container
    const container = new SimpleContainer();

    // Configure context-specific services
    VytchesDDD.configureContext('OrderProcessing', container);

    await VytchesDDD.configure(container);
  }
}
```

## Key Features

- **Batch Processing**: Handle large volumes with chunked processing and
  parallel execution
- **Context Filtering**: Multi-tenant and context-aware event processing
- **Resilience Patterns**: Circuit breaker and retry policies for fault
  tolerance
- **Event Middleware**: Logging, validation, and rate limiting middleware
- **Performance Optimization**: Chunked processing and efficient resource usage

## Performance Considerations

1. **Batch Size Optimization**: Balance between throughput and memory usage
2. **Parallel Processing**: Use Promise.allSettled for concurrent operations
3. **Circuit Breaker Tuning**: Adjust failure thresholds based on service
   characteristics
4. **Context Isolation**: Separate processing contexts for better resource
   management
5. **Rate Limiting**: Prevent system overload with event rate limiting

## Resilience Features

- **Circuit Breaker**: Prevents cascade failures during service degradation
- **Retry Logic**: Handles transient failures with exponential backoff
- **Graceful Degradation**: Continues processing successful orders when some
  fail
- **Error Isolation**: Prevents single order failures from stopping entire batch

## Common Pitfalls

- **Memory Exhaustion**: Large batches can consume excessive memory
- **Context Leakage**: Ensure proper context isolation between tenants
- **Rate Limit Tuning**: Set appropriate limits to prevent system overload
- **Circuit Breaker Configuration**: Tune parameters for each service's
  characteristics

## Related Examples

- [Batch Event Processing](../../intermediate/example-1.md)
- [Context-Aware Event Processing](../../basic/example-3.md)
- [NestJS Advanced Integration](../advanced/example-1.md)
