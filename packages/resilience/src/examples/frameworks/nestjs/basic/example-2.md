# Retry Pattern with Exponential Backoff - NestJS Basic Integration

**Version**: 1.0.0
**Package**: @vytches-ddd/resilience
**Framework**: NestJS
**Complexity**: Basic
**Domain**: External API Integration
**Patterns**: Retry with Exponential Backoff, Manual Setup
**Dependencies**: @nestjs/common, @vytches-ddd/resilience

## Description

This example demonstrates basic NestJS integration with retry pattern using exponential backoff. The service handles transient failures when calling external APIs by automatically retrying with progressively longer delays.

## Business Context

An e-commerce service integrates with external inventory and shipping APIs that occasionally experience transient failures. The retry pattern ensures successful operations by automatically handling temporary network issues and service unavailability.

## Code Example

```typescript
// external-api.service.ts
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ResiliencePolicyBuilder, RetryStrategy } from '@vytches-ddd/resilience';
import { InventoryRequest, ShippingRequest, ExternalApiResponse } from './types'; // From your application

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(ExternalApiService.name);
  private readonly inventoryRetryStrategy: RetryStrategy;
  private readonly shippingRetryStrategy: RetryStrategy;

  constructor() {
    // ⭐ FOCUS: Manual retry strategy setup for inventory API
    this.inventoryRetryStrategy = ResiliencePolicyBuilder
      .create()
      .withRetry({
        maxAttempts: 3,             // Maximum 3 retry attempts
        baseDelay: 1000,            // Start with 1-second delay
        maxDelay: 10000,            // Cap at 10 seconds
        backoff: 'exponential',     // Exponential backoff (1s, 2s, 4s, 8s...)
        jitter: true,               // Add randomness to prevent thundering herd
        retryCondition: (error) => this.isRetryableError(error)
      })
      .build();

    // ⭐ FOCUS: Manual retry strategy setup for shipping API
    this.shippingRetryStrategy = ResiliencePolicyBuilder
      .create()
      .withRetry({
        maxAttempts: 5,             // More retries for shipping (less critical timing)
        baseDelay: 2000,            // Start with 2-second delay
        maxDelay: 30000,            // Cap at 30 seconds
        backoff: 'exponential',
        jitter: true,
        retryCondition: (error) => this.isRetryableShippingError(error)
      })
      .build();
  }

  // ✅ FOCUS: Thin wrapper around library functionality
  async checkInventory(request: InventoryRequest): Promise<ExternalApiResponse> {
    try {
      const result = await this.inventoryRetryStrategy.execute(
        () => this.callInventoryApi(request),
        {
          operationId: 'check-inventory',
          correlationId: request.productId,
          startTime: new Date(),
          attempt: 1,
          previousAttempts: []
        }
      );

      this.logger.log(`Inventory check successful for product: ${request.productId}`);
      return result;

    } catch (error) {
      this.logger.error(`Inventory check failed after retries for product: ${request.productId}`, error.stack);
      
      if (error.message.includes('RETRY_EXHAUSTED')) {
        throw new HttpException(
          'Inventory service temporarily unavailable',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      
      throw new HttpException(
        'Inventory check failed',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ FOCUS: Thin wrapper around library functionality
  async requestShipping(request: ShippingRequest): Promise<ExternalApiResponse> {
    try {
      const result = await this.shippingRetryStrategy.execute(
        () => this.callShippingApi(request),
        {
          operationId: 'request-shipping',
          correlationId: request.orderId,
          startTime: new Date(),
          attempt: 1,
          previousAttempts: []
        }
      );

      this.logger.log(`Shipping request successful for order: ${request.orderId}`);
      return result;

    } catch (error) {
      this.logger.error(`Shipping request failed after retries for order: ${request.orderId}`, error.stack);
      
      throw new HttpException(
        'Shipping service failed to process request',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  async getRetryMetrics(): Promise<{ inventory: any; shipping: any }> {
    return {
      inventory: this.inventoryRetryStrategy.getMetrics(),
      shipping: this.shippingRetryStrategy.getMetrics()
    };
  }

  private async callInventoryApi(request: InventoryRequest): Promise<ExternalApiResponse> {
    const response = await fetch('https://inventory-api.example.com/check', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.INVENTORY_API_KEY
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(5000) // 5-second timeout
    });

    if (!response.ok) {
      throw new Error(`Inventory API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async callShippingApi(request: ShippingRequest): Promise<ExternalApiResponse> {
    const response = await fetch('https://shipping-api.example.com/quote', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.SHIPPING_API_KEY
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(8000) // 8-second timeout
    });

    if (!response.ok) {
      throw new Error(`Shipping API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private isRetryableError(error: Error): boolean {
    const retryableConditions = [
      'ECONNRESET',           // Connection reset
      'ECONNREFUSED',         // Connection refused
      'ETIMEDOUT',            // Connection timeout
      'ENOTFOUND',            // DNS resolution failed
      'socket hang up',       // Socket closed unexpectedly
      '502',                  // Bad Gateway
      '503',                  // Service Unavailable
      '504'                   // Gateway Timeout
    ];
    
    return retryableConditions.some(condition => 
      error.message.includes(condition)
    );
  }

  private isRetryableShippingError(error: Error): boolean {
    // Shipping API has additional retryable conditions
    const shippingRetryableConditions = [
      ...this.isRetryableError(error) ? ['general'] : [],
      'RATE_LIMITED',         // Rate limiting
      'TEMPORARY_MAINTENANCE', // Scheduled maintenance
      'HIGH_LOAD'             // System under high load
    ];
    
    return shippingRetryableConditions.some(condition => 
      error.message.includes(condition) || condition === 'general'
    );
  }
}

// external-api.controller.ts
import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ExternalApiService } from './external-api.service';
import { InventoryRequest, ShippingRequest } from './types'; // From your application

@Controller('external')
export class ExternalApiController {
  constructor(private readonly externalApiService: ExternalApiService) {}

  @Post('inventory/check')
  @HttpCode(HttpStatus.OK)
  async checkInventory(@Body() request: InventoryRequest) {
    return await this.externalApiService.checkInventory(request);
  }

  @Post('shipping/quote')
  @HttpCode(HttpStatus.OK)
  async getShippingQuote(@Body() request: ShippingRequest) {
    return await this.externalApiService.requestShipping(request);
  }

  @Get('metrics')
  async getMetrics() {
    return await this.externalApiService.getRetryMetrics();
  }
}

// external-api.module.ts
import { Module } from '@nestjs/common';
import { ExternalApiController } from './external-api.controller';
import { ExternalApiService } from './external-api.service';

@Module({
  controllers: [ExternalApiController],
  providers: [ExternalApiService],
  exports: [ExternalApiService]
})
export class ExternalApiModule {}
```

## Key Features

- **Exponential Backoff**: Progressively longer delays between retry attempts
- **Jitter**: Randomization to prevent thundering herd problems
- **Custom Retry Conditions**: Different retry logic for different APIs
- **Configurable Limits**: Different max attempts and delays per service
- **NestJS Logging**: Integrated with NestJS Logger for operational visibility
- **Timeout Protection**: Request-level timeouts to prevent hanging

## Retry Configuration

### Inventory API
- **Max Attempts**: 3 retries
- **Base Delay**: 1 second
- **Max Delay**: 10 seconds
- **Backoff**: Exponential with jitter

### Shipping API
- **Max Attempts**: 5 retries (more tolerance for non-critical timing)
- **Base Delay**: 2 seconds
- **Max Delay**: 30 seconds
- **Backoff**: Exponential with jitter

## Usage Example

```typescript
// Example API calls
const inventoryRequest = {
  productId: 'product-123',
  quantity: 5,
  warehouseId: 'warehouse-456'
};

const shippingRequest = {
  orderId: 'order-789',
  destination: {
    address: '123 Main St',
    city: 'Anytown',
    zipCode: '12345'
  },
  weight: 2.5,
  dimensions: { length: 10, width: 8, height: 6 }
};

// Check inventory with retry protection
const inventoryResult = await fetch('/external/inventory/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(inventoryRequest)
});

// Get shipping quote with retry protection
const shippingResult = await fetch('/external/shipping/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(shippingRequest)
});

// Check retry metrics
const metrics = await fetch('/external/metrics');
console.log(await metrics.json());
```

## Retry Patterns

1. **Network Failures**: Automatic retry for connection issues
2. **Transient Errors**: Retry for temporary service unavailability
3. **Rate Limiting**: Exponential backoff respects API rate limits
4. **Custom Conditions**: Service-specific retry logic

## Common Pitfalls

- **Non-Idempotent Operations**: Retrying operations that aren't safe to repeat
- **Infinite Retries**: Not setting appropriate max attempts
- **Synchronous Blocking**: Long retry sequences blocking other operations
- **Error Amplification**: Retrying errors that indicate permanent failures

## Related Examples

- [Circuit Breaker Pattern](./example-1.md)
- [Composite Retry Strategy](../intermediate/example-1.md)
- [Advanced Retry with Circuit Breaker](../advanced/example-1.md)