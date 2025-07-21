# Circuit Breaker Pattern - NestJS Basic Integration

**Version**: 1.0.0
**Package**: @vytches-ddd/resilience
**Framework**: NestJS
**Complexity**: Basic
**Domain**: Payment Processing Service
**Patterns**: Circuit Breaker, Manual Setup
**Dependencies**: @nestjs/common, @vytches-ddd/resilience

## Description

This example demonstrates basic NestJS integration with circuit breaker pattern using manual instantiation. The service protects against payment gateway failures while maintaining a simple, clear integration approach suitable for beginners.

## Business Context

A payment processing service needs to protect against third-party payment gateway failures. When the gateway becomes unresponsive, the circuit breaker prevents cascading failures and provides graceful degradation.

## Code Example

```typescript
// payment.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ResiliencePolicyBuilder, CircuitBreakerStrategy } from '@vytches-ddd/resilience';
import { PaymentRequest, PaymentResult, PaymentGatewayError } from './types'; // From your application

@Injectable()
export class PaymentService {
  private readonly paymentCircuitBreaker: CircuitBreakerStrategy;

  constructor() {
    // ⭐ FOCUS: Manual circuit breaker setup (beginner-friendly)
    this.paymentCircuitBreaker = ResiliencePolicyBuilder
      .create()
      .withCircuitBreaker({
        failureThreshold: 5,        // Open after 5 consecutive failures
        resetTimeout: 30000,        // Try recovery every 30 seconds
        halfOpenMaxCalls: 3,        // Test with 3 calls during recovery
        monitoringWindow: 120000    // 2-minute monitoring window
      })
      .build();
  }

  // ✅ FOCUS: Thin wrapper around library functionality
  async processPayment(paymentRequest: PaymentRequest): Promise<PaymentResult> {
    try {
      const result = await this.paymentCircuitBreaker.execute(
        () => this.callPaymentGateway(paymentRequest),
        {
          operationId: 'process-payment',
          correlationId: paymentRequest.transactionId,
          startTime: new Date(),
          attempt: 1,
          previousAttempts: []
        }
      );

      return {
        transactionId: paymentRequest.transactionId,
        status: 'success',
        amount: paymentRequest.amount,
        gatewayResponse: result,
        processedAt: new Date()
      };

    } catch (error) {
      if (error.message.includes('CIRCUIT_BREAKER_OPEN')) {
        throw new HttpException(
          'Payment service temporarily unavailable. Please try again later.',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      
      throw new HttpException(
        'Payment processing failed',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async getPaymentStatus(): Promise<{ circuitBreakerState: string; isHealthy: boolean }> {
    const state = this.paymentCircuitBreaker.getState();
    
    return {
      circuitBreakerState: state,
      isHealthy: state === 'CLOSED'
    };
  }

  private async callPaymentGateway(request: PaymentRequest): Promise<any> {
    // Simulate payment gateway call
    const response = await fetch('https://payment-gateway.example.com/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new PaymentGatewayError(`Gateway error: ${response.status}`);
    }

    return await response.json();
  }
}

// payment.controller.ts
import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentRequest } from './types'; // From your application

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('process')
  @HttpCode(HttpStatus.OK)
  async processPayment(@Body() paymentRequest: PaymentRequest) {
    return await this.paymentService.processPayment(paymentRequest);
  }

  @Get('health')
  async getHealth() {
    return await this.paymentService.getPaymentStatus();
  }
}

// payment.module.ts
import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService]
})
export class PaymentModule {}
```

## Key Features

- **Simple Integration**: Manual circuit breaker instantiation in constructor
- **NestJS Patterns**: Uses standard NestJS decorators and dependency injection
- **Error Handling**: Converts circuit breaker errors to appropriate HTTP responses
- **Health Monitoring**: Provides endpoint to check circuit breaker status
- **Type Safety**: Full TypeScript integration with imported application types

## Circuit Breaker Configuration

- **Failure Threshold**: 5 consecutive failures trigger circuit breaker opening
- **Reset Timeout**: 30-second recovery attempts
- **Half-Open Testing**: 3 test calls during recovery phase
- **Monitoring Window**: 2-minute failure rate calculation window

## Usage Example

```typescript
// Example API calls
const paymentRequest = {
  transactionId: 'txn-12345',
  amount: 99.99,
  currency: 'USD',
  customerId: 'customer-789'
};

// Process payment with circuit breaker protection
const result = await fetch('/payments/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(paymentRequest)
});

// Check payment service health
const health = await fetch('/payments/health');
console.log(await health.json()); // { circuitBreakerState: "CLOSED", isHealthy: true }
```

## Common Pitfalls

- **Static Configuration**: Circuit breaker settings not adjustable at runtime
- **Single Gateway**: No fallback payment gateway integration
- **Limited Monitoring**: Basic health check without detailed metrics
- **Error Mapping**: Simple error handling without detailed failure classification

## Related Examples

- [Retry Pattern with NestJS](./example-2.md)
- [Bulkhead Pattern](../intermediate/example-1.md)
- [Advanced Circuit Breaker](../advanced/example-1.md)