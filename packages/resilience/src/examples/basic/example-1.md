# Circuit Breaker Pattern for Payment Processing

**Version**: 1.0.0 **Package**: @vytches/ddd-resilience **Complexity**: Basic
**Domain**: Payment Processing **Patterns**: Circuit Breaker Pattern, Fault
Tolerance, Service Protection **Dependencies**: @vytches/ddd-resilience

## Description

This example demonstrates the circuit breaker pattern for protecting payment
processing services from cascading failures. When a payment gateway becomes
unreliable, the circuit breaker automatically opens to prevent further requests,
allowing the system to fail fast and recover gracefully.

## Business Context

An e-commerce platform processes thousands of payments daily through multiple
payment gateways. When a payment gateway experiences issues (high latency,
timeouts, or errors), continuing to send requests can overwhelm the already
struggling service and impact the entire platform. The circuit breaker pattern
protects both the calling service and the failing dependency.

## Code Example

```typescript
// payment-service.ts
import {
  CircuitBreakerStrategy,
  ResiliencePolicyBuilder,
  ResilienceContext,
} from '@vytches/ddd-resilience';
import { PaymentRequest, PaymentResponse } from './types'; // From your application

// Payment service with circuit breaker protection
export class PaymentService {
  private paymentCircuitBreaker: CircuitBreakerStrategy;

  constructor() {
    // Configure circuit breaker for payment gateway
    this.paymentCircuitBreaker = ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        failureThreshold: 5, // Open after 5 consecutive failures
        resetTimeout: 60000, // Try to close after 60 seconds
        halfOpenMaxCalls: 3, // Allow 3 calls in half-open state
        monitoringWindow: 300000, // 5-minute monitoring window
        minimumThroughput: 10, // Minimum calls before opening
      })
      .build();
  }

  async processPayment(
    paymentRequest: PaymentRequest
  ): Promise<PaymentResponse> {
    const context: ResilienceContext = {
      operationId: 'process-payment',
      correlationId: paymentRequest.id,
      startTime: new Date(),
      attempt: 1,
      previousAttempts: [],
    };

    try {
      // Execute payment through circuit breaker
      const result = await this.paymentCircuitBreaker.execute(
        () => this.callPaymentGateway(paymentRequest),
        context
      );

      return {
        id: paymentRequest.id,
        status: 'success',
        transactionId: result.transactionId,
        processingTime: Date.now() - context.startTime.getTime(),
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Payment processing failed:', error);

      // Check if circuit breaker is open
      if (this.paymentCircuitBreaker.getState() === 'OPEN') {
        return {
          id: paymentRequest.id,
          status: 'failed',
          errorCode: 'CIRCUIT_BREAKER_OPEN',
          errorMessage: 'Payment gateway is temporarily unavailable',
          processingTime: Date.now() - context.startTime.getTime(),
          timestamp: new Date(),
        };
      }

      return {
        id: paymentRequest.id,
        status: 'failed',
        errorCode: 'PAYMENT_GATEWAY_ERROR',
        errorMessage: error.message,
        processingTime: Date.now() - context.startTime.getTime(),
        timestamp: new Date(),
      };
    }
  }

  private async callPaymentGateway(
    paymentRequest: PaymentRequest
  ): Promise<any> {
    // Simulate payment gateway call
    const response = await fetch('https://payment-gateway.api/charge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer payment-api-key',
      },
      body: JSON.stringify({
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        payment_method: paymentRequest.paymentMethod,
        customer_id: paymentRequest.customerId,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Payment gateway error: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }

  // Get circuit breaker status for monitoring
  getCircuitBreakerStatus(): {
    state: string;
    failureCount: number;
    lastFailureTime?: Date;
  } {
    return {
      state: this.paymentCircuitBreaker.getState(),
      failureCount: this.paymentCircuitBreaker.getFailureCount(),
      lastFailureTime: this.paymentCircuitBreaker.getLastFailureTime(),
    };
  }

  // Manual circuit breaker control for maintenance
  async openCircuitBreaker(): Promise<void> {
    await this.paymentCircuitBreaker.open();
    console.log('Payment circuit breaker manually opened');
  }

  async closeCircuitBreaker(): Promise<void> {
    await this.paymentCircuitBreaker.close();
    console.log('Payment circuit breaker manually closed');
  }
}

// Usage example
const paymentService = new PaymentService();

// Process a payment with circuit breaker protection
const paymentRequest: PaymentRequest = {
  id: 'payment-001',
  amount: 99.99,
  currency: 'USD',
  merchantId: 'merchant-123',
  customerId: 'customer-456',
  paymentMethod: 'credit_card',
};

try {
  const result = await paymentService.processPayment(paymentRequest);

  if (result.status === 'success') {
    console.log('Payment processed successfully:', result.transactionId);
  } else {
    console.log('Payment failed:', result.errorMessage);

    // Check circuit breaker status
    const cbStatus = paymentService.getCircuitBreakerStatus();
    console.log('Circuit breaker state:', cbStatus.state);
    console.log('Failure count:', cbStatus.failureCount);
  }
} catch (error) {
  console.error('Unexpected payment error:', error);
}

// Monitor circuit breaker status
setInterval(() => {
  const status = paymentService.getCircuitBreakerStatus();
  console.log(
    `Circuit Breaker Status: ${status.state} (failures: ${status.failureCount})`
  );
}, 30000); // Check every 30 seconds
```

## Key Features

- **Automatic Failure Detection**: Opens circuit after consecutive failures
- **Fast Failure**: Immediately rejects requests when circuit is open
- **Automatic Recovery**: Attempts to close circuit after timeout period
- **Half-Open State**: Gradually tests service recovery
- **Monitoring**: Provides circuit breaker status and metrics
- **Manual Control**: Allows manual circuit breaker management

## Circuit Breaker States

1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: Failing fast, requests immediately rejected
3. **HALF_OPEN**: Testing recovery, limited requests allowed

## Common Pitfalls

- **Threshold Too Low**: Opening circuit too quickly for normal fluctuations
- **Timeout Too Short**: Not allowing enough time for service recovery
- **No Monitoring**: Not tracking circuit breaker state and metrics
- **Missing Fallbacks**: Not providing alternative responses when circuit is
  open

## Related Examples

- [Retry Pattern with Circuit Breaker](./example-2.md)
- [Bulkhead Pattern for Resource Isolation](./example-3.md)
- [Timeout Strategy](../intermediate/example-1.md)
