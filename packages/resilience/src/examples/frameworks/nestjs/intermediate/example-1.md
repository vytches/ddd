# Composite Resilience Strategy - NestJS Intermediate Integration

**Version**: 1.0.0 **Package**: @vytches-ddd/resilience **Framework**: NestJS
**Complexity**: Intermediate **Domain**: Order Management System **Patterns**:
Composite Strategy, Health Check Integration, Manual Setup **Dependencies**:
@nestjs/common, @nestjs/schedule, @vytches-ddd/resilience

## Description

This example demonstrates intermediate NestJS integration with composite
resilience strategies that combine circuit breakers, retries, timeouts, and
bulkheads. The service manages complex order processing with health-aware
resilience adaptation.

## Business Context

An order management system processes orders through multiple external services
(inventory, payment, shipping) with different reliability characteristics. The
system needs sophisticated resilience patterns that adapt based on service
health and coordinate across multiple dependencies.

## Code Example

```typescript
// order-resilience.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CompositeResilienceStrategy,
  ResiliencePolicyBuilder,
  HealthCheckIntegratedStrategy,
} from '@vytches-ddd/resilience';
import { Order, OrderProcessingResult, ServiceHealthMetrics } from './types'; // From your application

@Injectable()
export class OrderResilienceService {
  private readonly logger = new Logger(OrderResilienceService.name);
  private readonly inventoryStrategy: CompositeResilienceStrategy;
  private readonly paymentStrategy: CompositeResilienceStrategy;
  private readonly shippingStrategy: CompositeResilienceStrategy;
  private readonly serviceHealthMetrics: Map<string, ServiceHealthMetrics>;

  constructor() {
    this.serviceHealthMetrics = new Map();

    // ⭐ FOCUS: Manual composite strategy setup for inventory service
    this.inventoryStrategy = ResiliencePolicyBuilder.createComposite()
      .withCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 30000,
        halfOpenMaxCalls: 3,
        monitoringWindow: 120000,
      })
      .withRetry({
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 8000,
        backoff: 'exponential',
        jitter: true,
        retryCondition: error => this.isRetryableInventoryError(error),
      })
      .withTimeout({
        defaultTimeout: 10000,
        operationTimeouts: {
          'check-availability': 5000,
          'reserve-items': 15000,
          'release-reservation': 8000,
        },
        timeoutStrategy: 'graceful',
      })
      .withBulkhead({
        maxConcurrency: 10,
        queueSize: 50,
        queueTimeout: 30000,
        rejectionStrategy: 'fail',
      })
      .build();

    // ⭐ FOCUS: Manual composite strategy setup for payment service
    this.paymentStrategy = ResiliencePolicyBuilder.createComposite()
      .withCircuitBreaker({
        failureThreshold: 3, // More sensitive for payments
        resetTimeout: 60000, // Longer recovery time
        halfOpenMaxCalls: 2,
        monitoringWindow: 300000,
      })
      .withRetry({
        maxAttempts: 2, // Fewer retries for payments
        baseDelay: 2000,
        maxDelay: 10000,
        backoff: 'linear', // Linear backoff for payments
        jitter: false, // No jitter for payment consistency
        retryCondition: error => this.isRetryablePaymentError(error),
      })
      .withTimeout({
        defaultTimeout: 30000, // Longer timeout for payments
        operationTimeouts: {
          authorize: 15000,
          capture: 20000,
          refund: 25000,
        },
        timeoutStrategy: 'abort', // Abort immediately for payments
      })
      .withBulkhead({
        maxConcurrency: 5, // Lower concurrency for payments
        queueSize: 20,
        queueTimeout: 45000,
        rejectionStrategy: 'wait', // Wait for payment processing
      })
      .build();

    // ⭐ FOCUS: Manual composite strategy setup for shipping service
    this.shippingStrategy = ResiliencePolicyBuilder.createComposite()
      .withCircuitBreaker({
        failureThreshold: 7, // More tolerance for shipping
        resetTimeout: 45000,
        halfOpenMaxCalls: 5,
        monitoringWindow: 180000,
      })
      .withRetry({
        maxAttempts: 4,
        baseDelay: 1500,
        maxDelay: 20000,
        backoff: 'exponential',
        jitter: true,
        retryCondition: error => this.isRetryableShippingError(error),
      })
      .withTimeout({
        defaultTimeout: 20000,
        operationTimeouts: {
          'calculate-shipping': 8000,
          'create-label': 12000,
          'track-package': 5000,
        },
        timeoutStrategy: 'graceful',
      })
      .withBulkhead({
        maxConcurrency: 15, // Higher concurrency for shipping
        queueSize: 100,
        queueTimeout: 60000,
        rejectionStrategy: 'drop', // Drop low-priority shipping requests
      })
      .build();

    this.startHealthMonitoring();
  }

  // ✅ FOCUS: Thin wrapper around library functionality with health adaptation
  async processOrder(order: Order): Promise<OrderProcessingResult> {
    const orderContext = {
      operationId: 'process-order',
      correlationId: order.orderId,
      startTime: new Date(),
      attempt: 1,
      previousAttempts: [],
      orderPriority: order.priority,
      customerTier: order.customerTier,
    };

    try {
      // Step 1: Check inventory with adaptive resilience
      const inventoryResult = await this.executeWithHealthAdaptation(
        'inventory',
        () => this.checkInventoryAvailability(order),
        orderContext
      );

      if (!inventoryResult.available) {
        return {
          orderId: order.orderId,
          status: 'failed',
          reason: 'Inventory not available',
          step: 'inventory-check',
        };
      }

      // Step 2: Process payment with strict resilience
      const paymentResult = await this.executeWithHealthAdaptation(
        'payment',
        () => this.processPayment(order),
        orderContext
      );

      if (!paymentResult.success) {
        // Compensate inventory reservation
        await this.compensateInventoryReservation(
          order.orderId,
          inventoryResult.reservationId
        );

        return {
          orderId: order.orderId,
          status: 'failed',
          reason: 'Payment processing failed',
          step: 'payment-processing',
        };
      }

      // Step 3: Arrange shipping with flexible resilience
      const shippingResult = await this.executeWithHealthAdaptation(
        'shipping',
        () => this.arrangeShipping(order),
        orderContext
      );

      return {
        orderId: order.orderId,
        status: 'completed',
        inventoryReservation: inventoryResult.reservationId,
        paymentTransaction: paymentResult.transactionId,
        shippingLabel: shippingResult.labelId,
        estimatedDelivery: shippingResult.estimatedDelivery,
        processedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Order processing failed for ${order.orderId}:`,
        error.stack
      );

      return {
        orderId: order.orderId,
        status: 'failed',
        reason: error.message,
        failureType: this.classifyFailure(error),
        step: 'unknown',
      };
    }
  }

  // ✅ FOCUS: Health-aware strategy execution
  private async executeWithHealthAdaptation<T>(
    serviceId: string,
    operation: () => Promise<T>,
    context: any
  ): Promise<T> {
    const strategy = this.getStrategyForService(serviceId);
    const healthMetrics = this.serviceHealthMetrics.get(serviceId);

    // Adapt strategy based on service health
    if (healthMetrics) {
      await this.adaptStrategyForHealth(serviceId, strategy, healthMetrics);
    }

    return await strategy.execute(operation, context);
  }

  private async adaptStrategyForHealth(
    serviceId: string,
    strategy: CompositeResilienceStrategy,
    health: ServiceHealthMetrics
  ): Promise<void> {
    const healthScore = this.calculateHealthScore(health);

    if (healthScore < 0.7) {
      // Service degraded - tighten resilience
      this.logger.warn(
        `Service ${serviceId} degraded (${(healthScore * 100).toFixed(1)}%), tightening resilience`
      );

      await strategy.updateCircuitBreakerConfig({
        failureThreshold: Math.max(
          2,
          Math.floor(strategy.getCurrentCircuitBreakerThreshold() * 0.7)
        ),
        resetTimeout: strategy.getCurrentResetTimeout() * 1.5,
      });

      await strategy.updateTimeoutConfig({
        defaultTimeout: strategy.getCurrentTimeout() * 1.3,
      });
    } else if (healthScore > 0.9) {
      // Service healthy - relax resilience for better performance
      this.logger.log(
        `Service ${serviceId} healthy (${(healthScore * 100).toFixed(1)}%), optimizing for performance`
      );

      await strategy.updateTimeoutConfig({
        defaultTimeout: strategy.getCurrentTimeout() * 0.9,
      });
    }
  }

  private calculateHealthScore(metrics: ServiceHealthMetrics): number {
    const successRate =
      metrics.successfulRequests /
      (metrics.successfulRequests + metrics.failedRequests);
    const responseTimeFactor = Math.max(
      0,
      1 - metrics.averageResponseTime / 10000
    ); // 10s baseline
    const errorRateFactor = 1 - metrics.errorRate;

    return successRate * 0.5 + responseTimeFactor * 0.3 + errorRateFactor * 0.2;
  }

  private getStrategyForService(
    serviceId: string
  ): CompositeResilienceStrategy {
    switch (serviceId) {
      case 'inventory':
        return this.inventoryStrategy;
      case 'payment':
        return this.paymentStrategy;
      case 'shipping':
        return this.shippingStrategy;
      default:
        throw new Error(`Unknown service: ${serviceId}`);
    }
  }

  // ⭐ FOCUS: Health monitoring with automatic adaptation
  @Cron(CronExpression.EVERY_30_SECONDS)
  private async updateServiceHealth(): Promise<void> {
    const services = ['inventory', 'payment', 'shipping'];

    for (const serviceId of services) {
      try {
        const health = await this.checkServiceHealth(serviceId);
        this.serviceHealthMetrics.set(serviceId, health);

        this.logger.debug(
          `Service ${serviceId} health: ${(this.calculateHealthScore(health) * 100).toFixed(1)}%`
        );
      } catch (error) {
        this.logger.error(`Health check failed for ${serviceId}:`, error);
      }
    }
  }

  // Service health monitoring methods
  private async checkServiceHealth(
    serviceId: string
  ): Promise<ServiceHealthMetrics> {
    const strategy = this.getStrategyForService(serviceId);
    const metrics = strategy.getMetrics();

    // Simulate health check call
    const startTime = Date.now();
    try {
      await fetch(`https://${serviceId}-api.example.com/health`, {
        signal: AbortSignal.timeout(5000),
      });

      const responseTime = Date.now() - startTime;

      return {
        serviceId,
        successfulRequests: metrics.successfulExecutions || 0,
        failedRequests: metrics.failedExecutions || 0,
        averageResponseTime: responseTime,
        errorRate: metrics.errorRate || 0,
        lastCheck: new Date(),
        isHealthy: responseTime < 5000,
      };
    } catch (error) {
      return {
        serviceId,
        successfulRequests: 0,
        failedRequests: 1,
        averageResponseTime: 5000,
        errorRate: 1.0,
        lastCheck: new Date(),
        isHealthy: false,
      };
    }
  }

  private startHealthMonitoring(): void {
    this.logger.log('Starting health monitoring for order resilience');
  }

  // Business logic methods (simulated)
  private async checkInventoryAvailability(order: Order): Promise<any> {
    // Simulate inventory check
    await new Promise(resolve =>
      setTimeout(resolve, Math.random() * 2000 + 500)
    );
    return { available: true, reservationId: `res-${Date.now()}` };
  }

  private async processPayment(order: Order): Promise<any> {
    // Simulate payment processing
    await new Promise(resolve =>
      setTimeout(resolve, Math.random() * 3000 + 1000)
    );
    return { success: true, transactionId: `txn-${Date.now()}` };
  }

  private async arrangeShipping(order: Order): Promise<any> {
    // Simulate shipping arrangement
    await new Promise(resolve =>
      setTimeout(resolve, Math.random() * 1500 + 800)
    );
    return {
      labelId: `lbl-${Date.now()}`,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    };
  }

  private async compensateInventoryReservation(
    orderId: string,
    reservationId: string
  ): Promise<void> {
    this.logger.warn(
      `Compensating inventory reservation ${reservationId} for order ${orderId}`
    );
    // Compensation logic here
  }

  private isRetryableInventoryError(error: Error): boolean {
    return ['TIMEOUT', 'CONNECTION_RESET', 'SERVICE_BUSY'].some(code =>
      error.message.includes(code)
    );
  }

  private isRetryablePaymentError(error: Error): boolean {
    return ['NETWORK_ERROR', 'TEMPORARY_UNAVAILABLE'].some(code =>
      error.message.includes(code)
    );
  }

  private isRetryableShippingError(error: Error): boolean {
    return ['TIMEOUT', 'RATE_LIMITED', 'SERVICE_BUSY'].some(code =>
      error.message.includes(code)
    );
  }

  private classifyFailure(error: Error): string {
    if (error.message.includes('CIRCUIT_BREAKER_OPEN'))
      return 'Circuit Breaker';
    if (error.message.includes('TIMEOUT')) return 'Timeout';
    if (error.message.includes('BULKHEAD_REJECTED'))
      return 'Resource Exhaustion';
    if (error.message.includes('RETRY_EXHAUSTED')) return 'Persistent Failure';
    return 'Unknown';
  }

  // Public monitoring methods
  getResilienceStatus(): any {
    return {
      inventory: this.inventoryStrategy.getMetrics(),
      payment: this.paymentStrategy.getMetrics(),
      shipping: this.shippingStrategy.getMetrics(),
      healthMetrics: Object.fromEntries(this.serviceHealthMetrics),
      lastUpdate: new Date(),
    };
  }
}

// order.service.ts
import { Injectable } from '@nestjs/common';
import { OrderResilienceService } from './order-resilience.service';
import { Order } from './types'; // From your application

@Injectable()
export class OrderService {
  constructor(
    private readonly orderResilienceService: OrderResilienceService
  ) {}

  // ✅ FOCUS: Simple delegation to resilience service
  async processOrder(order: Order) {
    return await this.orderResilienceService.processOrder(order);
  }

  async getOrderSystemStatus() {
    return await this.orderResilienceService.getResilienceStatus();
  }
}

// order.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from './types'; // From your application

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  async processOrder(@Body() order: Order) {
    return await this.orderService.processOrder(order);
  }

  @Get('system/status')
  async getSystemStatus() {
    return await this.orderService.getOrderSystemStatus();
  }
}

// order.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderResilienceService } from './order-resilience.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [OrderController],
  providers: [OrderService, OrderResilienceService],
  exports: [OrderService],
})
export class OrderModule {}
```

## Key Features

- **Composite Strategies**: Combines circuit breaker, retry, timeout, and
  bulkhead patterns
- **Health-Aware Adaptation**: Automatically adjusts resilience based on service
  health
- **Service-Specific Configuration**: Different resilience patterns per service
  type
- **Automatic Health Monitoring**: Scheduled health checks with NestJS Cron
- **Compensation Logic**: Handles partial failures with proper compensation
- **Comprehensive Monitoring**: Detailed metrics and status reporting

## Strategy Composition

### Inventory Service

- **Circuit Breaker**: Moderate sensitivity (5 failures)
- **Retry**: 3 attempts with exponential backoff
- **Timeout**: 10s default, operation-specific timeouts
- **Bulkhead**: 10 concurrent operations

### Payment Service

- **Circuit Breaker**: High sensitivity (3 failures)
- **Retry**: 2 attempts with linear backoff
- **Timeout**: 30s default, strict abort strategy
- **Bulkhead**: 5 concurrent operations, wait strategy

### Shipping Service

- **Circuit Breaker**: Low sensitivity (7 failures)
- **Retry**: 4 attempts with exponential backoff
- **Timeout**: 20s default, graceful strategy
- **Bulkhead**: 15 concurrent operations, drop strategy

## Health Adaptation Logic

1. **Healthy Services (>90%)**: Relax timeouts for better performance
2. **Normal Services (70-90%)**: Standard resilience configuration
3. **Degraded Services (<70%)**: Tighten circuit breakers and increase timeouts

## Common Pitfalls

- **Over-Adaptation**: Changing configurations too frequently based on health
- **Compensation Complexity**: Complex compensation logic causing additional
  failures
- **Health Check Overhead**: Too frequent health checks impacting performance
- **Strategy Conflicts**: Conflicting patterns within composite strategies

## Related Examples

- [Circuit Breaker Pattern](../basic/example-1.md)
- [Retry Pattern](../basic/example-2.md)
- [Advanced DI Integration](../advanced/example-1.md)
