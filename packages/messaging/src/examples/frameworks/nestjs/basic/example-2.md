# NestJS Message Processing with Retry Logic

**Version**: 1.0.0  
**Package**: @vytches/ddd-messaging  
**Framework**: NestJS  
**Complexity**: Basic  
**Focus**: Manual integration of message processing with retry and dead letter
queue handling

## Description

This example demonstrates implementing message processing with retry logic and
dead letter queue handling in NestJS using manual service setup. Perfect for
understanding the fundamentals before moving to advanced DI integration.

## Business Context

A notification service processes various message types (emails, SMS, push
notifications) with different external service providers. Some providers may be
temporarily unavailable, requiring intelligent retry logic.

## Code Example

```typescript
// notification-processor.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  MessageProcessor,
  RetryableMessage,
  DeadLetterQueue,
  ExponentialBackoff,
} from '@vytches/ddd-messaging';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationRequest } from './types'; // From your application

@Injectable()
export class NotificationProcessorService
  implements OnModuleInit, OnModuleDestroy
{
  private emailProcessor: MessageProcessor<EmailNotification>;
  private smsProcessor: MessageProcessor<SmsNotification>;
  private pushProcessor: MessageProcessor<PushNotification>;
  private deadLetterQueue: DeadLetterQueue;

  constructor(
    private emailService: EmailService, // Your email service
    private smsService: SmsService, // Your SMS service
    private pushService: PushService, // Your push notification service
    @InjectRepository(ProcessingLog)
    private logRepository: Repository<ProcessingLog>
  ) {
    this.setupProcessors();
  }

  private setupProcessors(): void {
    // Initialize dead letter queue
    this.deadLetterQueue = new DeadLetterQueue({
      storage: this.createDLQStorage(),
      alertThreshold: 50, // Alert when 50+ messages in DLQ
      alertCallback: this.handleDLQAlert.bind(this),
    });

    // Email processor with aggressive retry
    this.emailProcessor = new MessageProcessor<EmailNotification>({
      processFunction: this.processEmail.bind(this),
      maxRetries: 10, // Emails are critical
      backoffStrategy: new ExponentialBackoff({
        initialDelay: 2000, // 2 seconds
        maxDelay: 300000, // 5 minutes
        multiplier: 2,
      }),
      deadLetterQueue: this.deadLetterQueue,
      onSuccess: this.logSuccess.bind(this),
      onFailure: this.logFailure.bind(this),
    });

    // SMS processor with moderate retry
    this.smsProcessor = new MessageProcessor<SmsNotification>({
      processFunction: this.processSms.bind(this),
      maxRetries: 5,
      backoffStrategy: new ExponentialBackoff({
        initialDelay: 1000,
        maxDelay: 60000,
        multiplier: 1.5,
      }),
      deadLetterQueue: this.deadLetterQueue,
    });

    // Push processor with minimal retry (fast but less reliable)
    this.pushProcessor = new MessageProcessor<PushNotification>({
      processFunction: this.processPush.bind(this),
      maxRetries: 3,
      backoffStrategy: new ExponentialBackoff({
        initialDelay: 500,
        maxDelay: 10000,
        multiplier: 2,
      }),
      deadLetterQueue: this.deadLetterQueue,
    });
  }

  async processNotification(
    request: NotificationRequest
  ): Promise<ProcessingResult> {
    const retryableMessage = RetryableMessage.create(request, {
      messageId: `notif-${request.id}`,
      priority: this.determinePriority(request),
      metadata: {
        userId: request.userId,
        type: request.type,
        timestamp: new Date(),
      },
    });

    try {
      switch (request.type) {
        case 'email':
          return await this.emailProcessor.process(retryableMessage);

        case 'sms':
          return await this.smsProcessor.process(retryableMessage);

        case 'push':
          return await this.pushProcessor.process(retryableMessage);

        default:
          throw new Error(`Unsupported notification type: ${request.type}`);
      }
    } catch (error) {
      await this.logProcessingError(request, error);
      throw error;
    }
  }

  // Individual processing functions
  private async processEmail(
    message: RetryableMessage<EmailNotification>
  ): Promise<Result<void, Error>> {
    const { payload } = message;

    try {
      await this.emailService.sendEmail({
        to: payload.recipient,
        subject: payload.subject,
        body: payload.body,
        template: payload.template,
      });

      return Result.success(undefined);
    } catch (error) {
      // Determine if error is retryable
      if (this.isRetryableEmailError(error)) {
        return Result.failure(
          new Error(`Email service error: ${error.message}`)
        );
      }

      // Non-retryable error - move to DLQ immediately
      await this.deadLetterQueue.add({
        ...message,
        failureReason: 'Non-retryable email error',
        errorDetails: error,
      });

      return Result.success(undefined); // Don't retry
    }
  }

  private async processSms(
    message: RetryableMessage<SmsNotification>
  ): Promise<Result<void, Error>> {
    const { payload } = message;

    try {
      await this.smsService.sendSms({
        phoneNumber: payload.phoneNumber,
        message: payload.text,
        sender: payload.senderId,
      });

      return Result.success(undefined);
    } catch (error) {
      if (this.isRetryableSmsError(error)) {
        return Result.failure(new Error(`SMS service error: ${error.message}`));
      }

      await this.deadLetterQueue.add({
        ...message,
        failureReason: 'Invalid phone number or blocked',
        errorDetails: error,
      });

      return Result.success(undefined);
    }
  }

  private async processPush(
    message: RetryableMessage<PushNotification>
  ): Promise<Result<void, Error>> {
    const { payload } = message;

    try {
      await this.pushService.sendPushNotification({
        deviceToken: payload.deviceToken,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      });

      return Result.success(undefined);
    } catch (error) {
      if (this.isRetryablePushError(error)) {
        return Result.failure(
          new Error(`Push service error: ${error.message}`)
        );
      }

      await this.deadLetterQueue.add({
        ...message,
        failureReason: 'Invalid device token',
        errorDetails: error,
      });

      return Result.success(undefined);
    }
  }

  // Error classification helpers
  private isRetryableEmailError(error: any): boolean {
    const retryableCodes = ['TIMEOUT', 'RATE_LIMIT', 'SERVER_ERROR'];
    return retryableCodes.includes(error.code) || error.status >= 500;
  }

  private isRetryableSmsError(error: any): boolean {
    return error.code === 'RATE_LIMIT' || error.code === 'TIMEOUT';
  }

  private isRetryablePushError(error: any): boolean {
    return error.code !== 'INVALID_TOKEN' && error.status >= 500;
  }

  // Dead Letter Queue management
  async reprocessDeadLetterMessages(): Promise<ReprocessingResult> {
    const deadMessages = await this.deadLetterQueue.getMessages({
      limit: 100,
      olderThan: new Date(Date.now() - 3600000), // 1 hour old
    });

    const results = {
      processed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const message of deadMessages) {
      // Check if error is now resolved
      if (await this.shouldRetryDeadMessage(message)) {
        try {
          const retryable = RetryableMessage.create(message.payload, {
            ...message.metadata,
            attempts: 0, // Reset attempts
            isReprocessed: true,
          });

          await this.processNotification(retryable.payload);
          await this.deadLetterQueue.removeMessage(message.id);
          results.processed++;
        } catch (error) {
          results.failed++;
        }
      } else {
        results.skipped++;
      }
    }

    return results;
  }

  private async shouldRetryDeadMessage(message: DeadLetterMessage): boolean {
    // Business logic to determine if message should be retried
    if (message.failureReason === 'Invalid phone number') return false;
    if (message.failureReason === 'Invalid device token') return false;
    if (message.attempts > 20) return false; // Hard limit

    return true;
  }

  // Monitoring and alerting
  private async handleDLQAlert(stats: DLQStatistics): Promise<void> {
    console.warn(`Dead Letter Queue Alert: ${stats.totalMessages} messages`);

    // Send alert to operations team
    await this.processNotification({
      type: 'email',
      recipient: 'ops-team@company.com',
      subject: 'DLQ Alert - High Volume',
      body: `Dead Letter Queue has ${stats.totalMessages} messages. Please investigate.`,
      priority: 'high',
    });
  }

  private async logSuccess(message: RetryableMessage<any>): Promise<void> {
    await this.logRepository.save({
      messageId: message.metadata.messageId,
      type: message.payload.type,
      status: 'success',
      attempts: message.attempts,
      processedAt: new Date(),
    });
  }

  private async logFailure(
    message: RetryableMessage<any>,
    error: Error
  ): Promise<void> {
    await this.logRepository.save({
      messageId: message.metadata.messageId,
      type: message.payload.type,
      status: 'failed',
      attempts: message.attempts,
      error: error.message,
      processedAt: new Date(),
    });
  }

  async onModuleInit(): Promise<void> {
    console.log('Notification processors initialized');
  }

  async onModuleDestroy(): Promise<void> {
    // Cleanup processors
    await this.emailProcessor.shutdown();
    await this.smsProcessor.shutdown();
    await this.pushProcessor.shutdown();
  }
}

// notification.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { NotificationProcessorService } from './notification-processor.service';
import { SendNotificationDto } from './dto'; // From your application

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notificationProcessor: NotificationProcessorService
  ) {}

  @Post('send')
  async sendNotification(@Body() dto: SendNotificationDto) {
    try {
      const result = await this.notificationProcessor.processNotification(dto);
      return {
        success: true,
        messageId: result.messageId,
        status: 'queued',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('reprocess-failed')
  async reprocessFailed() {
    try {
      const result =
        await this.notificationProcessor.reprocessDeadLetterMessages();
      return {
        success: true,
        results: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
```

## Key Features

- **Multiple Processors**: Different retry strategies for different notification
  types
- **Smart Error Handling**: Distinguish between retryable and permanent failures
- **Dead Letter Queue**: Isolate problematic messages for investigation
- **Monitoring Integration**: Alerts and logging for operational visibility
- **Reprocessing**: Ability to retry failed messages after fixes

## Benefits of Manual Setup

- **Type Safety**: Full TypeScript support with proper error handling
- **Flexibility**: Different retry strategies for different message types
- **Observability**: Comprehensive logging and monitoring
- **Control**: Full control over processing logic and error handling

## Common Pitfalls

- **Resource Leaks**: Ensure processors are properly shutdown
- **Infinite Loops**: Always set maximum retry limits
- **Memory Usage**: Monitor DLQ growth and implement cleanup policies
- **Error Classification**: Properly classify retryable vs permanent errors

## Related Examples

- [Advanced DI Integration](/packages/messaging/src/examples/frameworks/nestjs/intermediate/example-1.md)
- [Outbox Pattern](/packages/messaging/src/examples/basic/example-1.md)
- [Resilience Integration](/packages/resilience/src/examples/frameworks/nestjs/basic/example-1.md)
