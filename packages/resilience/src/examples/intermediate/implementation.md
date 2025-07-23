# Resilience with Events Integration Implementation

**Focus**: Advanced resilience patterns integrated with events system for
observability  
**Domain**: E-commerce Order Processing  
**Complexity**: Intermediate  
**Dependencies**: @vytches-ddd/resilience, @vytches-ddd/events, @vytches-ddd/di,
@vytches-ddd/utils

## Business Context

This example demonstrates advanced resilience patterns integrated with the
events system for a comprehensive e-commerce order processing platform:

- Resilience events for monitoring and alerting
- Event-driven circuit breaker state changes
- Integration with order processing workflows
- Comprehensive observability and metrics
- Automated failure recovery workflows

## Implementation

```typescript
// resilience-events.ts
import { DomainEvent, IntegrationEvent } from '@vytches-ddd/events';
import { CircuitBreakerState, ResilienceMetrics } from '../types'; // ALWAYS import from app

// Resilience domain events
export class CircuitBreakerStateChangedEvent extends DomainEvent {
  constructor(
    public readonly circuitBreakerName: string,
    public readonly previousState: CircuitBreakerState,
    public readonly newState: CircuitBreakerState,
    public readonly reason: string,
    public readonly failureCount: number,
    public readonly lastFailureTime?: Date
  ) {
    super('CircuitBreakerStateChanged', {
      circuitBreakerName,
      previousState,
      newState,
      reason,
      failureCount,
      lastFailureTime,
    });
  }
}

export class ResilienceFailureEvent extends DomainEvent {
  constructor(
    public readonly serviceName: string,
    public readonly operationName: string,
    public readonly failureType:
      | 'timeout'
      | 'circuit-breaker'
      | 'bulkhead'
      | 'retry-exhausted',
    public readonly errorMessage: string,
    public readonly attemptNumber: number,
    public readonly totalAttempts: number,
    public readonly context: Record<string, any>
  ) {
    super('ResilienceFailure', {
      serviceName,
      operationName,
      failureType,
      errorMessage,
      attemptNumber,
      totalAttempts,
      context,
    });
  }
}

export class ResilienceRecoveryEvent extends DomainEvent {
  constructor(
    public readonly serviceName: string,
    public readonly operationName: string,
    public readonly recoveryType:
      | 'circuit-breaker-closed'
      | 'retry-success'
      | 'manual-recovery',
    public readonly downDuration: number,
    public readonly successfulAttempts: number,
    public readonly context: Record<string, any>
  ) {
    super('ResilienceRecovery', {
      serviceName,
      operationName,
      recoveryType,
      downDuration,
      successfulAttempts,
      context,
    });
  }
}

export class ResilienceMetricsEvent extends IntegrationEvent {
  constructor(
    public readonly serviceName: string,
    public readonly metrics: ResilienceMetrics,
    public readonly timeWindow: string,
    public readonly timestamp: Date
  ) {
    super('ResilienceMetrics', {
      serviceName,
      metrics,
      timeWindow,
      timestamp,
    });
  }
}

// event-aware-resilience.ts
import {
  CircuitBreaker,
  RetryStrategy,
  TimeoutStrategy,
  BulkheadStrategy,
  ResiliencePolicyBuilder,
  ResilienceContext,
} from '@vytches-ddd/resilience';
import { UnifiedEventBus } from '@vytches-ddd/events';
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';
import { Logger } from '@vytches-ddd/logging';
import { Result } from '@vytches-ddd/utils';

// ⭐ Event-Aware Circuit Breaker
export class EventAwareCircuitBreaker extends CircuitBreaker {
  private logger = Logger.forContext('EventAwareCircuitBreaker');

  constructor(
    config: any,
    private eventBus: UnifiedEventBus,
    private serviceName: string
  ) {
    super(config);
  }

  protected onStateChange(
    previousState: CircuitBreakerState,
    newState: CircuitBreakerState,
    reason: string
  ): void {
    this.logger.info('Circuit breaker state changed', {
      serviceName: this.serviceName,
      circuitBreakerName: this.getName(),
      previousState,
      newState,
      reason,
    });

    // Publish state change event
    const event = new CircuitBreakerStateChangedEvent(
      this.getName(),
      previousState,
      newState,
      reason,
      this.getFailureCount(),
      this.getLastFailureTime()
    );

    this.eventBus.publish(event);
  }

  protected onFailureRecorded(error: Error, context: ResilienceContext): void {
    this.logger.warn('Circuit breaker failure recorded', {
      serviceName: this.serviceName,
      circuitBreakerName: this.getName(),
      error: error.message,
      failureCount: this.getFailureCount(),
    });

    // Publish failure event
    const event = new ResilienceFailureEvent(
      this.serviceName,
      context.operationName || 'unknown',
      'circuit-breaker',
      error.message,
      1,
      1,
      {
        circuitBreakerName: this.getName(),
        currentState: this.getState(),
        failureCount: this.getFailureCount(),
      }
    );

    this.eventBus.publish(event);
  }

  protected onSuccessRecorded(context: ResilienceContext): void {
    // Check if this success closes the circuit
    if (this.getState() === 'CLOSED' && this.getFailureCount() === 0) {
      this.logger.info('Circuit breaker recovered', {
        serviceName: this.serviceName,
        circuitBreakerName: this.getName(),
      });

      // Publish recovery event
      const event = new ResilienceRecoveryEvent(
        this.serviceName,
        context.operationName || 'unknown',
        'circuit-breaker-closed',
        this.getDownDuration(),
        this.getSuccessCount(),
        {
          circuitBreakerName: this.getName(),
        }
      );

      this.eventBus.publish(event);
    }
  }

  private getDownDuration(): number {
    const lastFailureTime = this.getLastFailureTime();
    return lastFailureTime ? Date.now() - lastFailureTime.getTime() : 0;
  }
}

// event-aware-retry-strategy.ts
export class EventAwareRetryStrategy extends RetryStrategy {
  private logger = Logger.forContext('EventAwareRetryStrategy');

  constructor(
    config: any,
    private eventBus: UnifiedEventBus,
    private serviceName: string
  ) {
    super(config);
  }

  protected onRetryAttempt(
    attempt: number,
    maxAttempts: number,
    error: Error,
    context: ResilienceContext
  ): void {
    this.logger.warn('Retry attempt', {
      serviceName: this.serviceName,
      operationName: context.operationName,
      attempt,
      maxAttempts,
      error: error.message,
    });

    // Publish retry failure event
    const event = new ResilienceFailureEvent(
      this.serviceName,
      context.operationName || 'unknown',
      'retry-exhausted',
      error.message,
      attempt,
      maxAttempts,
      {
        retryDelay: this.calculateDelay(attempt),
        nextAttemptIn: this.calculateDelay(attempt + 1),
      }
    );

    this.eventBus.publish(event);
  }

  protected onRetrySuccess(attempt: number, context: ResilienceContext): void {
    this.logger.info('Retry successful', {
      serviceName: this.serviceName,
      operationName: context.operationName,
      attempt,
      totalAttempts: attempt,
    });

    // Publish recovery event
    const event = new ResilienceRecoveryEvent(
      this.serviceName,
      context.operationName || 'unknown',
      'retry-success',
      this.calculateDelay(attempt) * attempt, // Approximate total retry time
      1,
      {
        totalAttempts: attempt,
      }
    );

    this.eventBus.publish(event);
  }

  protected onRetryExhausted(
    maxAttempts: number,
    finalError: Error,
    context: ResilienceContext
  ): void {
    this.logger.error('Retry exhausted', {
      serviceName: this.serviceName,
      operationName: context.operationName,
      maxAttempts,
      finalError: finalError.message,
    });

    // Publish retry exhausted event
    const event = new ResilienceFailureEvent(
      this.serviceName,
      context.operationName || 'unknown',
      'retry-exhausted',
      finalError.message,
      maxAttempts,
      maxAttempts,
      {
        totalRetryTime: this.calculateTotalRetryTime(maxAttempts),
      }
    );

    this.eventBus.publish(event);
  }

  private calculateTotalRetryTime(attempts: number): number {
    let totalTime = 0;
    for (let i = 1; i <= attempts; i++) {
      totalTime += this.calculateDelay(i);
    }
    return totalTime;
  }
}

// resilient-order-service.ts
import {
  OrderService,
  InventoryService,
  PaymentService,
  ShippingService,
  Order,
  OrderRequest,
  OrderResult,
} from '../types'; // ALWAYS import from app

// ⭐ Resilient Order Service with Events Integration
@DomainService('resilientOrderService', {
  lifetime: ServiceLifetime.Singleton,
  context: 'OrderProcessing',
})
export class ResilientOrderService {
  private logger = Logger.forContext('ResilientOrderService');
  private inventoryResiliencePolicy: any;
  private paymentResiliencePolicy: any;
  private shippingResiliencePolicy: any;
  private metricsCollector: ResilienceMetricsCollector;

  constructor(
    private inventoryService: InventoryService,
    private paymentService: PaymentService,
    private shippingService: ShippingService,
    private eventBus: UnifiedEventBus
  ) {
    this.initializeResiliencePolicies();
    this.metricsCollector = new ResilienceMetricsCollector(this.eventBus);
    this.startMetricsCollection();
  }

  private initializeResiliencePolicies(): void {
    // Inventory service resilience
    this.inventoryResiliencePolicy = ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        name: 'InventoryService',
        failureThreshold: 5,
        recoveryTimeout: 30000,
        eventBus: this.eventBus,
        serviceName: 'OrderService',
      })
      .withRetry({
        maxAttempts: 3,
        baseDelay: 1000,
        backoffMultiplier: 2,
        eventBus: this.eventBus,
        serviceName: 'OrderService',
      })
      .withTimeout({
        timeout: 10000,
        eventBus: this.eventBus,
        serviceName: 'OrderService',
      })
      .withBulkhead({
        maxConcurrentCalls: 20,
        maxQueueSize: 100,
      })
      .build();

    // Payment service resilience (more conservative)
    this.paymentResiliencePolicy = ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        name: 'PaymentService',
        failureThreshold: 3,
        recoveryTimeout: 60000,
        eventBus: this.eventBus,
        serviceName: 'OrderService',
      })
      .withRetry({
        maxAttempts: 5,
        baseDelay: 2000,
        backoffMultiplier: 2,
        eventBus: this.eventBus,
        serviceName: 'OrderService',
      })
      .withTimeout({
        timeout: 30000,
        eventBus: this.eventBus,
        serviceName: 'OrderService',
      })
      .withBulkhead({
        maxConcurrentCalls: 10,
        maxQueueSize: 50,
      })
      .build();

    // Shipping service resilience
    this.shippingResiliencePolicy = ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        name: 'ShippingService',
        failureThreshold: 7,
        recoveryTimeout: 45000,
        eventBus: this.eventBus,
        serviceName: 'OrderService',
      })
      .withRetry({
        maxAttempts: 4,
        baseDelay: 1500,
        backoffMultiplier: 1.5,
        eventBus: this.eventBus,
        serviceName: 'OrderService',
      })
      .withTimeout({
        timeout: 20000,
        eventBus: this.eventBus,
        serviceName: 'OrderService',
      })
      .withBulkhead({
        maxConcurrentCalls: 15,
        maxQueueSize: 75,
      })
      .build();
  }

  async processOrder(
    orderRequest: OrderRequest
  ): Promise<Result<OrderResult, Error>> {
    try {
      this.logger.info('Processing order with resilience', {
        orderId: orderRequest.orderId,
        customerId: orderRequest.customerId,
        itemCount: orderRequest.items.length,
      });

      // Step 1: Reserve inventory with resilience
      const inventoryResult = await this.inventoryResiliencePolicy.execute(
        async () => {
          return await this.inventoryService.reserveItems(orderRequest.items);
        },
        { operationName: 'reserveInventory', orderId: orderRequest.orderId }
      );

      if (inventoryResult.isFailure()) {
        return Result.failure(
          new Error(
            `Inventory reservation failed: ${inventoryResult.error.message}`
          )
        );
      }

      // Step 2: Process payment with resilience
      const paymentResult = await this.paymentResiliencePolicy.execute(
        async () => {
          return await this.paymentService.processPayment({
            orderId: orderRequest.orderId,
            amount: orderRequest.totalAmount,
            paymentMethod: orderRequest.paymentMethod,
          });
        },
        { operationName: 'processPayment', orderId: orderRequest.orderId }
      );

      if (paymentResult.isFailure()) {
        // Compensate: Release inventory
        await this.compensateInventory(orderRequest.items);
        return Result.failure(
          new Error(`Payment processing failed: ${paymentResult.error.message}`)
        );
      }

      // Step 3: Arrange shipping with resilience
      const shippingResult = await this.shippingResiliencePolicy.execute(
        async () => {
          return await this.shippingService.arrangeShipping({
            orderId: orderRequest.orderId,
            items: orderRequest.items,
            shippingAddress: orderRequest.shippingAddress,
          });
        },
        { operationName: 'arrangeShipping', orderId: orderRequest.orderId }
      );

      if (shippingResult.isFailure()) {
        // Compensate: Release inventory and refund payment
        await this.compensateInventory(orderRequest.items);
        await this.compensatePayment(
          orderRequest.orderId,
          orderRequest.totalAmount
        );
        return Result.failure(
          new Error(
            `Shipping arrangement failed: ${shippingResult.error.message}`
          )
        );
      }

      const orderResult: OrderResult = {
        orderId: orderRequest.orderId,
        status: 'confirmed',
        inventoryReservation: inventoryResult.value,
        paymentConfirmation: paymentResult.value,
        shippingDetails: shippingResult.value,
        processedAt: new Date(),
      };

      this.logger.info('Order processed successfully', {
        orderId: orderRequest.orderId,
        totalAmount: orderRequest.totalAmount,
      });

      return Result.success(orderResult);
    } catch (error) {
      this.logger.error('Order processing failed', {
        orderId: orderRequest.orderId,
        error: error.message,
      });

      return Result.failure(
        new Error(`Order processing failed: ${error.message}`)
      );
    }
  }

  private async compensateInventory(items: any[]): Promise<void> {
    try {
      await this.inventoryService.releaseItems(items);
      this.logger.info('Inventory compensation completed', {
        itemCount: items.length,
      });
    } catch (error) {
      this.logger.error('Inventory compensation failed', {
        error: error.message,
      });
    }
  }

  private async compensatePayment(
    orderId: string,
    amount: number
  ): Promise<void> {
    try {
      await this.paymentService.refundPayment(orderId, amount);
      this.logger.info('Payment compensation completed', { orderId, amount });
    } catch (error) {
      this.logger.error('Payment compensation failed', {
        orderId,
        error: error.message,
      });
    }
  }

  // Get comprehensive resilience status
  getResilienceStatus(): {
    inventory: any;
    payment: any;
    shipping: any;
    overall: any;
  } {
    return {
      inventory: this.inventoryResiliencePolicy.getStatus(),
      payment: this.paymentResiliencePolicy.getStatus(),
      shipping: this.shippingResiliencePolicy.getStatus(),
      overall: this.calculateOverallHealth(),
    };
  }

  private calculateOverallHealth(): { status: string; score: number } {
    const statuses = [
      this.inventoryResiliencePolicy.getStatus(),
      this.paymentResiliencePolicy.getStatus(),
      this.shippingResiliencePolicy.getStatus(),
    ];

    const openCircuits = statuses.filter(
      s => s.circuitBreaker.state === 'OPEN'
    ).length;
    const halfOpenCircuits = statuses.filter(
      s => s.circuitBreaker.state === 'HALF_OPEN'
    ).length;

    let score = 100;
    score -= openCircuits * 40;
    score -= halfOpenCircuits * 20;

    let status = 'healthy';
    if (score < 50) {
      status = 'unhealthy';
    } else if (score < 80) {
      status = 'degraded';
    }

    return { status, score };
  }

  private startMetricsCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectAndPublishMetrics();
    }, 30000);
  }

  private collectAndPublishMetrics(): void {
    const metrics = this.gatherResilienceMetrics();

    const event = new ResilienceMetricsEvent(
      'OrderService',
      metrics,
      '30s',
      new Date()
    );

    this.eventBus.publish(event);
  }

  private gatherResilienceMetrics(): ResilienceMetrics {
    return {
      circuitBreakers: {
        inventory: this.inventoryResiliencePolicy.getMetrics(),
        payment: this.paymentResiliencePolicy.getMetrics(),
        shipping: this.shippingResiliencePolicy.getMetrics(),
      },
      overallHealth: this.calculateOverallHealth(),
      requestCounts: {
        total: this.metricsCollector.getTotalRequests(),
        successful: this.metricsCollector.getSuccessfulRequests(),
        failed: this.metricsCollector.getFailedRequests(),
      },
    };
  }
}

// resilience-metrics-collector.ts
export class ResilienceMetricsCollector {
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private logger = Logger.forContext('ResilienceMetricsCollector');

  constructor(private eventBus: UnifiedEventBus) {
    this.subscribeToEvents();
  }

  private subscribeToEvents(): void {
    this.eventBus.subscribe(
      'ResilienceFailure',
      (event: ResilienceFailureEvent) => {
        this.failedRequests++;
        this.totalRequests++;
        this.logFailureMetrics(event);
      }
    );

    this.eventBus.subscribe(
      'ResilienceRecovery',
      (event: ResilienceRecoveryEvent) => {
        this.successfulRequests++;
        this.totalRequests++;
        this.logRecoveryMetrics(event);
      }
    );
  }

  private logFailureMetrics(event: ResilienceFailureEvent): void {
    this.logger.warn('Resilience failure recorded', {
      serviceName: event.serviceName,
      operationName: event.operationName,
      failureType: event.failureType,
      attemptNumber: event.attemptNumber,
      totalFailures: this.failedRequests,
    });
  }

  private logRecoveryMetrics(event: ResilienceRecoveryEvent): void {
    this.logger.info('Resilience recovery recorded', {
      serviceName: event.serviceName,
      operationName: event.operationName,
      recoveryType: event.recoveryType,
      downDuration: event.downDuration,
      totalRecoveries: this.successfulRequests,
    });
  }

  getTotalRequests(): number {
    return this.totalRequests;
  }

  getSuccessfulRequests(): number {
    return this.successfulRequests;
  }

  getFailedRequests(): number {
    return this.failedRequests;
  }

  getSuccessRate(): number {
    return this.totalRequests > 0
      ? (this.successfulRequests / this.totalRequests) * 100
      : 0;
  }

  reset(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
  }
}
```

## Key Features

- **Event-Driven Resilience**: Circuit breaker state changes and failures
  published as events
- **Comprehensive Observability**: Detailed metrics and monitoring through
  events
- **Service Integration**: Resilience patterns applied to inventory, payment,
  and shipping services
- **Compensation Logic**: Automatic rollback when downstream services fail
- **Metrics Collection**: Real-time collection and publishing of resilience
  metrics
- **Health Monitoring**: Overall system health calculation based on individual
  service states

## Usage Example

```typescript
// Usage in order controller
export class OrderController {
  constructor(private resilientOrderService: ResilientOrderService) {}

  async createOrder(
    orderData: OrderRequest
  ): Promise<Result<OrderResult, Error>> {
    try {
      // Process order with full resilience
      const result = await this.resilientOrderService.processOrder(orderData);

      if (result.isFailure()) {
        // Get resilience status for debugging
        const status = this.resilientOrderService.getResilienceStatus();
        console.log('Resilience status:', status);

        return Result.failure(result.error);
      }

      return Result.success(result.value);
    } catch (error) {
      return Result.failure(
        new Error(`Order creation failed: ${error.message}`)
      );
    }
  }

  async getSystemHealth(): Promise<{
    status: string;
    resilience: any;
    timestamp: Date;
  }> {
    const resilience = this.resilientOrderService.getResilienceStatus();

    return {
      status: resilience.overall.status,
      resilience,
      timestamp: new Date(),
    };
  }
}
```

## Common Pitfalls

- **Event Flooding**: Be careful not to publish too many events, especially in
  high-traffic scenarios
- **Metric Overhead**: Monitor the performance impact of metrics collection
- **Compensation Complexity**: Ensure compensation logic is thoroughly tested
- **State Consistency**: Handle eventual consistency between resilience events
  and business state
- **Error Correlation**: Maintain correlation IDs across all resilience events
  for debugging
