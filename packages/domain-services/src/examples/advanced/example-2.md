# Resilient Domain Service - Advanced Example

**Version**: 1.0.0 **Package**: @vytches/ddd-domain-services **Complexity**:
advanced **Domain**: order-management **Patterns**: domain-service, resilience,
fault-tolerance **Dependencies**: @vytches/ddd-core, @vytches/ddd-resilience

## Description

This example demonstrates a domain service with comprehensive resilience
patterns including circuit breakers, retry logic, bulkhead isolation, and
timeout handling. It shows how to build fault-tolerant services that gracefully
handle failures.

## Business Context

In distributed systems, services must be resilient to failures. External service
calls can fail, timeouts can occur, and dependencies can become unavailable.
Resilience patterns help services maintain availability and provide graceful
degradation.

## Code Example

````typescript
// resilient-order.service.ts
import { BaseDomainService } from '@vytches/ddd-domain-services';
import {
  CircuitBreaker,
  RetryPolicy,
  BulkheadStrategy,
  TimeoutStrategy,
  ResiliencePolicyBuilder,
  CompositeResilienceStrategy,
} from '@vytches/ddd-resilience';
import { Result } from '@vytches/ddd-utils';
import {
  Order,
  Customer,
  CreateOrderCommand,
  OrderProcessingResult,
  IOrderRepository,
  ICustomerRepository,
  IPaymentGateway,
  INotificationService,
} from '../types';

/**
 * @llm-summary Resilient domain service with comprehensive fault tolerance
 * @llm-domain order-management
 * @llm-complexity Complex
 *
 * @description
 * Demonstrates resilience patterns including circuit breakers, retry logic,
 * bulkhead isolation, and timeout handling for fault-tolerant operations.
 *
 * @example
 * ```typescript
 * const service = new ResilientOrderService(repositories, services);
 * const result = await service.processOrderWithResilience(command);
 * ```
 */
export class ResilientOrderService extends BaseDomainService {
  private readonly paymentCircuitBreaker: CircuitBreaker;
  private readonly notificationCircuitBreaker: CircuitBreaker;
  private readonly retryPolicy: RetryPolicy;
  private readonly bulkheadStrategy: BulkheadStrategy;
  private readonly timeoutStrategy: TimeoutStrategy;
  private readonly compositeStrategy: CompositeResilienceStrategy;

  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly customerRepository: ICustomerRepository,
    private readonly paymentGateway: IPaymentGateway,
    private readonly notificationService: INotificationService
  ) {
    super('ResilientOrderService');
    this.initializeResilienceStrategies();
  }

  /**
   * Processes order with comprehensive resilience patterns
   *
   * @param command - Order creation command
   * @returns Result containing processing result or error
   */
  async processOrderWithResilience(
    command: CreateOrderCommand
  ): Promise<Result<OrderProcessingResult, Error>> {
    try {
      // Use composite resilience strategy for entire operation
      const result = await this.compositeStrategy.execute(
        async () => await this.executeOrderProcessing(command),
        {
          operationName: 'processOrder',
          correlationId: this.generateCorrelationId(),
          metadata: { orderId: command.orderId },
        }
      );

      if (result.isFailure()) {
        return Result.failure(result.error);
      }

      return Result.success(result.value);
    } catch (error) {
      return Result.failure(
        new Error(`Resilient order processing failed: ${error.message}`)
      );
    }
  }

  /**
   * Executes order processing with individual resilience patterns
   */
  private async executeOrderProcessing(
    command: CreateOrderCommand
  ): Promise<OrderProcessingResult> {
    // Step 1: Create order with retry for transient failures
    const order = await this.retryPolicy.execute(
      async () => await this.createOrder(command),
      {
        operationName: 'createOrder',
        correlationId: this.generateCorrelationId(),
      }
    );

    // Step 2: Process payment with circuit breaker and timeout
    const paymentResult = await this.processPaymentWithResilience(order);

    // Step 3: Send notifications with bulkhead isolation
    await this.sendNotificationsWithBulkhead(order);

    // Step 4: Update order status
    await this.updateOrderStatus(order, 'confirmed');

    return {
      orderId: order.id,
      status: order.status,
      paymentId: paymentResult.transactionId,
      inventoryUpdates: [],
      notifications: [],
    };
  }

  /**
   * Processes payment with circuit breaker protection
   */
  private async processPaymentWithResilience(
    order: Order
  ): Promise<PaymentResult> {
    return await this.paymentCircuitBreaker.execute(
      async () => {
        // Apply timeout strategy to payment processing
        return await this.timeoutStrategy.execute(
          async () => {
            const payment = {
              id: this.generatePaymentId(),
              orderId: order.id,
              amount: order.totalAmount,
              status: 'pending',
              method: 'credit_card',
            };

            return await this.paymentGateway.processPayment(payment);
          },
          {
            operationName: 'processPayment',
            correlationId: this.generateCorrelationId(),
            metadata: { orderId: order.id },
          }
        );
      },
      {
        operationName: 'paymentProcessing',
        correlationId: this.generateCorrelationId(),
        metadata: { orderId: order.id, amount: order.totalAmount },
      }
    );
  }

  /**
   * Sends notifications with bulkhead isolation
   */
  private async sendNotificationsWithBulkhead(order: Order): Promise<void> {
    await this.bulkheadStrategy.execute(
      async () => {
        // Send multiple notifications with circuit breaker
        const notifications = [
          this.sendEmailNotification(order),
          this.sendSMSNotification(order),
          this.sendPushNotification(order),
        ];

        // Execute notifications concurrently with individual circuit breakers
        await Promise.allSettled(notifications);
      },
      {
        operationName: 'sendNotifications',
        correlationId: this.generateCorrelationId(),
        metadata: { orderId: order.id },
      }
    );
  }

  /**
   * Sends email notification with circuit breaker
   */
  private async sendEmailNotification(order: Order): Promise<void> {
    await this.notificationCircuitBreaker.execute(
      async () => {
        const customer = await this.customerRepository.findById(order.userId);
        if (customer) {
          await this.notificationService.sendEmail(
            customer.email,
            'Order Confirmation',
            `Your order ${order.id} has been confirmed.`
          );
        }
      },
      {
        operationName: 'sendEmail',
        correlationId: this.generateCorrelationId(),
        metadata: { orderId: order.id },
      }
    );
  }

  /**
   * Sends SMS notification with circuit breaker
   */
  private async sendSMSNotification(order: Order): Promise<void> {
    await this.notificationCircuitBreaker.execute(
      async () => {
        const customer = await this.customerRepository.findById(order.userId);
        if (customer) {
          // Assume phone number is available
          await this.notificationService.sendSMS(
            '+1234567890',
            `Order ${order.id} confirmed. Total: $${order.totalAmount}`
          );
        }
      },
      {
        operationName: 'sendSMS',
        correlationId: this.generateCorrelationId(),
        metadata: { orderId: order.id },
      }
    );
  }

  /**
   * Sends push notification with circuit breaker
   */
  private async sendPushNotification(order: Order): Promise<void> {
    await this.notificationCircuitBreaker.execute(
      async () => {
        const customer = await this.customerRepository.findById(order.userId);
        if (customer) {
          await this.notificationService.sendPush(
            customer.id,
            `Order ${order.id} confirmed!`
          );
        }
      },
      {
        operationName: 'sendPush',
        correlationId: this.generateCorrelationId(),
        metadata: { orderId: order.id },
      }
    );
  }

  /**
   * Handles order processing with graceful degradation
   */
  async processOrderWithDegradation(
    command: CreateOrderCommand
  ): Promise<Result<OrderProcessingResult, Error>> {
    try {
      const order = await this.createOrder(command);

      // Try payment processing with fallback
      let paymentResult: PaymentResult | null = null;

      try {
        paymentResult = await this.processPaymentWithResilience(order);
      } catch (error) {
        // Graceful degradation: Mark order as pending payment
        await this.updateOrderStatus(order, 'pending_payment');
        console.warn(
          `Payment failed, order marked as pending: ${error.message}`
        );
      }

      // Try notifications with fallback
      try {
        await this.sendNotificationsWithBulkhead(order);
      } catch (error) {
        // Graceful degradation: Log notification failure, continue processing
        console.warn(`Notifications failed, continuing: ${error.message}`);
      }

      const result: OrderProcessingResult = {
        orderId: order.id,
        status: order.status,
        paymentId: paymentResult?.transactionId,
        inventoryUpdates: [],
        notifications: [],
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure(
        new Error(`Order processing with degradation failed: ${error.message}`)
      );
    }
  }

  /**
   * Gets resilience metrics for monitoring
   */
  getResilienceMetrics(): ResilienceMetrics {
    return {
      paymentCircuitBreaker: this.paymentCircuitBreaker.getMetrics(),
      notificationCircuitBreaker: this.notificationCircuitBreaker.getMetrics(),
      retryPolicy: this.retryPolicy.getMetrics(),
      bulkheadStrategy: this.bulkheadStrategy.getMetrics(),
      timeoutStrategy: this.timeoutStrategy.getMetrics(),
    };
  }

  /**
   * Initializes resilience strategies
   */
  private initializeResilienceStrategies(): void {
    // Circuit breaker for payment processing
    this.paymentCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 10000,
      name: 'PaymentCircuitBreaker',
    });

    // Circuit breaker for notifications
    this.notificationCircuitBreaker = new CircuitBreaker({
      failureThreshold: 10,
      resetTimeout: 30000,
      monitoringPeriod: 5000,
      name: 'NotificationCircuitBreaker',
    });

    // Retry policy for transient failures
    this.retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryCondition: error => {
        // Retry on specific error types
        return (
          error.message.includes('timeout') ||
          error.message.includes('network') ||
          error.message.includes('temporary')
        );
      },
    });

    // Bulkhead strategy for resource isolation
    this.bulkheadStrategy = new BulkheadStrategy({
      maxConcurrentCalls: 10,
      maxQueueSize: 20,
      queueTimeout: 5000,
      name: 'NotificationBulkhead',
    });

    // Timeout strategy
    this.timeoutStrategy = new TimeoutStrategy({
      timeout: 30000,
      name: 'PaymentTimeout',
    });

    // Composite strategy combining all patterns
    this.compositeStrategy = ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 10000,
      })
      .withRetry({
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
      })
      .withTimeout({
        timeout: 120000,
      })
      .withBulkhead({
        maxConcurrentCalls: 5,
        maxQueueSize: 10,
        queueTimeout: 5000,
      })
      .build();
  }

  /**
   * Creates order entity
   */
  private async createOrder(command: CreateOrderCommand): Promise<Order> {
    // Simulate potential transient failure
    if (Math.random() < 0.1) {
      throw new Error('Temporary database connection issue');
    }

    const order: Order = {
      id: this.generateOrderId(),
      userId: command.userId,
      items: command.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: 100, // Simplified
        name: `Product ${item.productId}`,
      })),
      status: 'pending',
      totalAmount: command.items.reduce(
        (sum, item) => sum + item.quantity * 100,
        0
      ),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return await this.orderRepository.save(order);
  }

  /**
   * Updates order status
   */
  private async updateOrderStatus(order: Order, status: string): Promise<void> {
    order.status = status;
    order.updatedAt = new Date();
    await this.orderRepository.save(order);
  }

  /**
   * Generates unique order identifier
   */
  private generateOrderId(): string {
    return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates unique payment identifier
   */
  private generatePaymentId(): string {
    return `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generates correlation identifier
   */
  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Resilience metrics interface
 */
interface ResilienceMetrics {
  paymentCircuitBreaker: any;
  notificationCircuitBreaker: any;
  retryPolicy: any;
  bulkheadStrategy: any;
  timeoutStrategy: any;
}
````

## Key Features

- **Circuit Breaker Pattern**: Prevents cascading failures and provides
  fail-fast behavior
- **Retry Logic**: Handles transient failures with exponential backoff and
  jitter
- **Bulkhead Isolation**: Isolates resources to prevent failure propagation
- **Timeout Handling**: Prevents operations from hanging indefinitely
- **Graceful Degradation**: Continues operation even when some components fail
- **Composite Strategies**: Combines multiple resilience patterns

## Common Pitfalls

- **Circuit Breaker Tuning**: Tune thresholds based on actual failure patterns
- **Retry Storms**: Avoid overwhelming failing services with retries
- **Timeout Values**: Set appropriate timeouts based on SLA requirements
- **Monitoring**: Implement comprehensive monitoring and alerting
- **Fallback Logic**: Provide meaningful fallback behavior

## Related Examples

- [Saga-Orchestrated Domain Service](./example-1.md) - Long-running processes
- [Enterprise Domain Service](./example-3.md) - Complete enterprise setup
- [Resilience examples](../../resilience/examples/) - Resilience pattern details
