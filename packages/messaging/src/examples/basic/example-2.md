# Message Retry and Dead Letter Queue

**Version**: 1.0.0  
**Package**: @vytches/ddd-messaging  
**Complexity**: Basic  
**Domain**: Payment Processing  
**Patterns**: Retry Pattern, Dead Letter Queue, Exponential Backoff  
**Dependencies**: @vytches/ddd-messaging, @vytches/ddd-core

## Description

This example demonstrates implementing reliable message processing with
automatic retries and dead letter queue (DLQ) handling. It shows how to handle
transient failures gracefully while ensuring problematic messages don't block
the system.

## Business Context

Payment processing systems often interact with external payment gateways that
may experience temporary outages. Using retry mechanisms with exponential
backoff prevents overwhelming the external service while ensuring eventual
processing. Messages that repeatedly fail are moved to a DLQ for manual
inspection.

## Code Example

```typescript
// payment-retry.service.ts
import {
  MessageProcessor,
  RetryableMessage,
  DeadLetterQueue,
  ExponentialBackoff,
} from '@vytches/ddd-messaging';
import { Result } from '@vytches/ddd-utils';
import { PaymentDetails, ExternalApiResponse } from './types';

// Message processor with retry logic
export class PaymentMessageProcessor extends MessageProcessor<PaymentDetails> {
  constructor(
    private paymentGateway: IPaymentGateway,
    private deadLetterQueue: DeadLetterQueue
  ) {
    super({
      maxRetries: 5,
      backoffStrategy: new ExponentialBackoff({
        initialDelay: 1000, // 1 second
        maxDelay: 60000, // 1 minute
        multiplier: 2,
      }),
      deadLetterQueue,
    });
  }

  async processMessage(
    message: RetryableMessage<PaymentDetails>
  ): Promise<Result<void, Error>> {
    const { payload, metadata } = message;

    try {
      // Attempt to process payment
      const response = await this.paymentGateway.processPayment(payload);

      if (response.success) {
        console.log(`Payment processed: ${payload.transactionId}`);
        return Result.success(undefined);
      }

      // Check if error is retryable
      if (this.isRetryableError(response.error)) {
        return Result.failure(
          new Error(`Transient error: ${response.error.message}`)
        );
      }

      // Non-retryable error - send to DLQ
      await this.moveToDeadLetter(message, response.error.message);
      return Result.success(undefined); // Don't retry
    } catch (error) {
      // Network or unexpected errors are retryable
      return Result.failure(new Error(`Processing failed: ${error.message}`));
    }
  }

  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      'GATEWAY_TIMEOUT',
      'SERVICE_UNAVAILABLE',
      'RATE_LIMIT_EXCEEDED',
      'NETWORK_ERROR',
    ];
    return retryableCodes.includes(error?.code);
  }

  async onMaxRetriesExceeded(
    message: RetryableMessage<PaymentDetails>
  ): Promise<void> {
    console.error(
      `Payment ${message.payload.transactionId} failed after ${message.attempts} attempts`
    );

    // Store in DLQ with context
    await this.deadLetterQueue.add({
      ...message,
      failureReason: 'Max retries exceeded',
      failedAt: new Date(),
      context: {
        lastError: message.lastError,
        processingHistory: message.attemptHistory,
      },
    });
  }
}

// Service orchestrating payment processing
export class PaymentService {
  private processor: PaymentMessageProcessor;

  constructor(
    paymentGateway: IPaymentGateway,
    deadLetterQueue: DeadLetterQueue
  ) {
    this.processor = new PaymentMessageProcessor(
      paymentGateway,
      deadLetterQueue
    );
  }

  async processPaymentQueue(messages: PaymentDetails[]): Promise<void> {
    // Convert to retryable messages
    const retryableMessages = messages.map(payment =>
      RetryableMessage.create(payment, {
        messageId: `payment-${payment.orderId}`,
        priority: payment.amount > 1000 ? 'high' : 'normal',
      })
    );

    // Process with automatic retry handling
    await Promise.all(
      retryableMessages.map(msg => this.processor.process(msg))
    );
  }

  async reprocessDeadLetterQueue(): Promise<void> {
    const deadMessages = await this.processor.deadLetterQueue.getMessages({
      limit: 50,
      filter: {
        failedBefore: new Date(Date.now() - 3600000), // 1 hour ago
      },
    });

    for (const message of deadMessages) {
      // Reset retry count and reprocess
      const retryable = RetryableMessage.create(message.payload, {
        ...message.metadata,
        attempts: 0,
        isReprocessed: true,
      });

      await this.processor.process(retryable);
    }
  }
}

// Monitoring service for DLQ
export class DeadLetterMonitor {
  constructor(
    private deadLetterQueue: DeadLetterQueue,
    private alertService: IAlertService
  ) {}

  async checkDeadLetterQueue(): Promise<void> {
    const stats = await this.deadLetterQueue.getStatistics();

    // Alert if too many messages in DLQ
    if (stats.totalMessages > 100) {
      await this.alertService.sendAlert({
        severity: 'high',
        title: 'Dead Letter Queue Growing',
        message: `${stats.totalMessages} messages in DLQ`,
        metadata: stats,
      });
    }

    // Alert on specific error patterns
    const errorPatterns = await this.deadLetterQueue.getErrorDistribution();
    for (const [error, count] of Object.entries(errorPatterns)) {
      if (count > 10) {
        await this.alertService.sendAlert({
          severity: 'medium',
          title: `Repeated Error Pattern: ${error}`,
          message: `${count} occurrences in last hour`,
        });
      }
    }
  }
}
```

## Key Features

- **Exponential Backoff**: Prevents overwhelming external services during
  outages
- **Smart Retry Logic**: Distinguishes between retryable and permanent failures
- **Dead Letter Queue**: Isolates problematic messages for manual inspection
- **Monitoring Integration**: Alerts on DLQ growth and error patterns
- **Reprocessing Capability**: Ability to retry messages from DLQ after fixes

## Common Pitfalls

- **Infinite retries**: Always set a maximum retry limit to prevent resource
  exhaustion
- **No backoff strategy**: Immediate retries can worsen service degradation
- **Ignoring DLQ**: Unmonitored DLQ can hide systemic issues
- **Missing idempotency**: Payment processing must be idempotent to handle
  retries safely

## Related Examples

- [Circuit Breaker Pattern](/packages/resilience/src/examples/basic/example-1.md)
- [Outbox Pattern Implementation](/packages/messaging/src/examples/basic/example-1.md)
- [Event Error Handling](/packages/events/src/examples/intermediate/example-1.md)
