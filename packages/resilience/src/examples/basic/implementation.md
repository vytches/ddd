# Basic Circuit Breaker Implementation

**Focus**: Basic circuit breaker pattern for external service calls  
**Domain**: Payment Processing  
**Complexity**: Basic  
**Dependencies**: @vytches-ddd/resilience, @vytches-ddd/utils

## Business Context

This example demonstrates basic resilience patterns for a payment processing system:
- Circuit breaker protects against cascading failures when payment gateway is down
- Retry mechanism handles transient network issues
- Timeout strategy prevents hanging requests
- Bulkhead isolates critical payment operations

## Implementation

```typescript
// payment-service.ts
import { 
  CircuitBreaker, 
  RetryStrategy, 
  TimeoutStrategy,
  BulkheadStrategy,
  ResiliencePolicyBuilder 
} from '@vytches-ddd/resilience';
import { Result } from '@vytches-ddd/utils';
import { PaymentRequest, PaymentResponse, PaymentGateway } from '../types'; // ALWAYS import from app

// ⭐ Basic Payment Service with Circuit Breaker
export class PaymentService {
  private circuitBreaker: CircuitBreaker;
  private retryStrategy: RetryStrategy;
  private timeoutStrategy: TimeoutStrategy;
  private bulkheadStrategy: BulkheadStrategy;

  constructor(private paymentGateway: PaymentGateway) {
    this.initializeResilienceStrategies();
  }

  private initializeResilienceStrategies(): void {
    // Circuit breaker configuration
    this.circuitBreaker = new CircuitBreaker({
      name: 'PaymentGateway',
      failureThreshold: 5,     // Trip after 5 failures
      recoveryTimeout: 30000,  // 30 seconds before retry
      monitoringPeriod: 60000, // 1 minute monitoring window
      successThreshold: 3      // 3 successes to close circuit
    });

    // Retry strategy with exponential backoff
    this.retryStrategy = new RetryStrategy({
      maxAttempts: 3,
      baseDelay: 1000,        // 1 second base delay
      maxDelay: 10000,        // 10 seconds max delay
      backoffMultiplier: 2,   // Exponential backoff
      jitter: true            // Add random jitter
    });

    // Timeout strategy
    this.timeoutStrategy = new TimeoutStrategy({
      timeout: 15000          // 15 seconds timeout
    });

    // Bulkhead strategy for resource isolation
    this.bulkheadStrategy = new BulkheadStrategy({
      maxConcurrentCalls: 10,  // Maximum 10 concurrent payment calls
      maxQueueSize: 50         // Queue up to 50 requests
    });
  }

  async processPayment(paymentRequest: PaymentRequest): Promise<Result<PaymentResponse, Error>> {
    try {
      // Check circuit breaker state
      if (this.circuitBreaker.isOpen()) {
        return Result.failure(new Error('Payment gateway is currently unavailable (circuit breaker open)'));
      }

      // Execute payment with all resilience strategies
      const result = await this.executeWithResilience(paymentRequest);
      
      if (result.isSuccess()) {
        // Record success for circuit breaker
        this.circuitBreaker.recordSuccess();
        return result;
      } else {
        // Record failure for circuit breaker
        this.circuitBreaker.recordFailure();
        return result;
      }
    } catch (error) {
      // Record failure and return error
      this.circuitBreaker.recordFailure();
      return Result.failure(new Error(`Payment processing failed: ${error.message}`));
    }
  }

  private async executeWithResilience(paymentRequest: PaymentRequest): Promise<Result<PaymentResponse, Error>> {
    // Wrap the payment call with all resilience strategies
    const resilientPayment = async (): Promise<PaymentResponse> => {
      // Apply bulkhead (resource isolation)
      return await this.bulkheadStrategy.execute(async () => {
        // Apply timeout strategy
        return await this.timeoutStrategy.execute(async () => {
          // Make the actual payment gateway call
          return await this.paymentGateway.processPayment(paymentRequest);
        });
      });
    };

    // Apply retry strategy
    return await this.retryStrategy.execute(async () => {
      const response = await resilientPayment();
      return Result.success(response);
    });
  }

  // Check if payment gateway is available
  async isPaymentGatewayAvailable(): Promise<boolean> {
    return !this.circuitBreaker.isOpen();
  }

  // Get circuit breaker status
  getCircuitBreakerStatus(): {
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime?: Date;
  } {
    return {
      state: this.circuitBreaker.getState(),
      failureCount: this.circuitBreaker.getFailureCount(),
      successCount: this.circuitBreaker.getSuccessCount(),
      lastFailureTime: this.circuitBreaker.getLastFailureTime()
    };
  }

  // Manual circuit breaker control
  async testPaymentGateway(): Promise<Result<void, Error>> {
    try {
      // Simple health check
      const healthCheck = await this.timeoutStrategy.execute(async () => {
        return await this.paymentGateway.healthCheck();
      });

      if (healthCheck.isHealthy) {
        this.circuitBreaker.recordSuccess();
        return Result.success(undefined);
      } else {
        this.circuitBreaker.recordFailure();
        return Result.failure(new Error('Payment gateway health check failed'));
      }
    } catch (error) {
      this.circuitBreaker.recordFailure();
      return Result.failure(new Error(`Health check failed: ${error.message}`));
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    // Close bulkhead to prevent new requests
    await this.bulkheadStrategy.shutdown();
    
    // Wait for pending operations to complete
    await this.waitForPendingOperations();
  }

  private async waitForPendingOperations(): Promise<void> {
    // Wait for any pending operations to complete
    return new Promise((resolve) => {
      const checkPending = () => {
        if (this.bulkheadStrategy.getPendingCount() === 0) {
          resolve();
        } else {
          setTimeout(checkPending, 100);
        }
      };
      checkPending();
    });
  }
}

// resilience-policy-builder.ts
import { ResiliencePolicyBuilder } from '@vytches-ddd/resilience';

// ⭐ Fluent Policy Builder for Complex Scenarios
export class PaymentResiliencePolicy {
  static createStandardPolicy(): ResiliencePolicyBuilder {
    return ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        name: 'StandardPayment',
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000
      })
      .withRetry({
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true
      })
      .withTimeout({
        timeout: 15000
      })
      .withBulkhead({
        maxConcurrentCalls: 10,
        maxQueueSize: 50
      });
  }

  static createHighValuePolicy(): ResiliencePolicyBuilder {
    return ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        name: 'HighValuePayment',
        failureThreshold: 3,      // More sensitive
        recoveryTimeout: 60000,   // Longer recovery
        monitoringPeriod: 120000
      })
      .withRetry({
        maxAttempts: 5,           // More retries
        baseDelay: 2000,          // Longer delays
        maxDelay: 30000,
        backoffMultiplier: 2,
        jitter: true
      })
      .withTimeout({
        timeout: 30000            // Longer timeout
      })
      .withBulkhead({
        maxConcurrentCalls: 5,    // More conservative
        maxQueueSize: 20
      });
  }

  static createRobustPolicy(): ResiliencePolicyBuilder {
    return ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        name: 'RobustPayment',
        failureThreshold: 10,
        recoveryTimeout: 15000,
        monitoringPeriod: 30000
      })
      .withRetry({
        maxAttempts: 2,
        baseDelay: 500,
        maxDelay: 5000,
        backoffMultiplier: 1.5,
        jitter: true
      })
      .withTimeout({
        timeout: 10000
      })
      .withBulkhead({
        maxConcurrentCalls: 20,
        maxQueueSize: 100
      });
  }
}

// advanced-payment-service.ts
export class AdvancedPaymentService {
  private standardPolicy: any;
  private highValuePolicy: any;
  private robustPolicy: any;

  constructor(private paymentGateway: PaymentGateway) {
    this.initializePolicies();
  }

  private initializePolicies(): void {
    this.standardPolicy = PaymentResiliencePolicy.createStandardPolicy().build();
    this.highValuePolicy = PaymentResiliencePolicy.createHighValuePolicy().build();
    this.robustPolicy = PaymentResiliencePolicy.createRobustPolicy().build();
  }

  async processPayment(paymentRequest: PaymentRequest): Promise<Result<PaymentResponse, Error>> {
    try {
      // Select appropriate policy based on payment amount
      const policy = this.selectPolicy(paymentRequest);
      
      // Execute payment with selected resilience policy
      const result = await policy.execute(async () => {
        return await this.paymentGateway.processPayment(paymentRequest);
      });

      return Result.success(result);
    } catch (error) {
      return Result.failure(new Error(`Payment processing failed: ${error.message}`));
    }
  }

  private selectPolicy(paymentRequest: PaymentRequest): any {
    if (paymentRequest.amount > 10000) {
      return this.highValuePolicy;
    } else if (paymentRequest.priority === 'high') {
      return this.robustPolicy;
    } else {
      return this.standardPolicy;
    }
  }

  // Get metrics from all policies
  getResilienceMetrics(): {
    standard: any;
    highValue: any;
    robust: any;
  } {
    return {
      standard: this.standardPolicy.getMetrics(),
      highValue: this.highValuePolicy.getMetrics(),
      robust: this.robustPolicy.getMetrics()
    };
  }
}

// resilience-decorators.ts
import { CircuitBreaker, Retry, Timeout, Bulkhead } from '@vytches-ddd/resilience';

// ⭐ Decorator-based Resilience
export class DecoratorPaymentService {
  constructor(private paymentGateway: PaymentGateway) {}

  @CircuitBreaker({
    name: 'PaymentGateway',
    failureThreshold: 5,
    recoveryTimeout: 30000
  })
  @Retry({
    maxAttempts: 3,
    baseDelay: 1000,
    backoffMultiplier: 2
  })
  @Timeout({
    timeout: 15000
  })
  @Bulkhead({
    maxConcurrentCalls: 10,
    maxQueueSize: 50
  })
  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    return await this.paymentGateway.processPayment(paymentRequest);
  }

  @CircuitBreaker({
    name: 'PaymentValidation',
    failureThreshold: 3,
    recoveryTimeout: 15000
  })
  @Retry({
    maxAttempts: 2,
    baseDelay: 500
  })
  @Timeout({
    timeout: 5000
  })
  async validatePayment(paymentRequest: PaymentRequest): Promise<boolean> {
    return await this.paymentGateway.validatePayment(paymentRequest);
  }
}
```

## Key Features

- **Circuit Breaker**: Protects against cascading failures with configurable thresholds
- **Retry Strategy**: Exponential backoff with jitter for transient failures
- **Timeout Strategy**: Prevents hanging requests with configurable timeouts
- **Bulkhead Pattern**: Resource isolation with concurrent call limits
- **Fluent Policy Builder**: Chainable configuration for complex scenarios
- **Decorator Support**: Method-level resilience patterns

## Usage Example

```typescript
// Usage in application
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  async processPayment(paymentData: PaymentRequest): Promise<Result<PaymentResponse, Error>> {
    try {
      // Check if payment gateway is available
      const isAvailable = await this.paymentService.isPaymentGatewayAvailable();
      
      if (!isAvailable) {
        return Result.failure(new Error('Payment gateway is currently unavailable'));
      }

      // Process payment with resilience
      const result = await this.paymentService.processPayment(paymentData);
      
      if (result.isFailure()) {
        // Log circuit breaker status for debugging
        const status = this.paymentService.getCircuitBreakerStatus();
        console.log('Circuit breaker status:', status);
        
        return Result.failure(result.error);
      }

      return Result.success(result.value);
    } catch (error) {
      return Result.failure(new Error(`Payment controller error: ${error.message}`));
    }
  }

  async getPaymentGatewayHealth(): Promise<{
    isAvailable: boolean;
    circuitBreakerStatus: any;
    metrics: any;
  }> {
    const isAvailable = await this.paymentService.isPaymentGatewayAvailable();
    const status = this.paymentService.getCircuitBreakerStatus();
    
    return {
      isAvailable,
      circuitBreakerStatus: status,
      metrics: {
        state: status.state,
        failureCount: status.failureCount,
        successCount: status.successCount
      }
    };
  }
}
```

## Common Pitfalls

- **Threshold Tuning**: Set appropriate failure thresholds based on your system's characteristics
- **Timeout Configuration**: Balance between responsiveness and allowing operations to complete
- **Bulkhead Sizing**: Configure concurrent limits based on downstream capacity
- **Retry Logic**: Avoid retry storms by using exponential backoff with jitter
- **Circuit Breaker States**: Monitor and understand the three states (CLOSED, OPEN, HALF_OPEN)
- **Resource Cleanup**: Ensure proper cleanup of resources during shutdown