# NestJS Basic Scheduling Integration - Manual Setup and Service Injection

**Version**: 1.0.0 **Package**: @vytches-ddd/event-scheduling  
**Framework**: NestJS **Complexity**: basic **Integration**: Manual scheduler
setup with standard NestJS dependency injection

## Description

Basic NestJS integration demonstrating manual event scheduler setup with service
injection, health checks, and basic scheduling operations for order processing
and notification systems.

## Business Context

E-commerce application using NestJS needs basic scheduled event capabilities for
order reminders, payment processing, and customer notifications with simple
retry policies and health monitoring.

## Code Example

```typescript
// order-scheduling.service.ts
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  InMemorySchedulerAdapter,
  ScheduledEvent,
} from '@vytches-ddd/event-scheduling';
import { Result } from '@vytches-ddd/utils';
import {
  OrderData,
  NotificationData,
  SchedulingStats,
  OrderReminderConfig,
} from './types'; // From your app

@Injectable()
export class OrderSchedulingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderSchedulingService.name);
  private scheduler: InMemorySchedulerAdapter;

  constructor() {
    // ⭐ FOCUS: Manual scheduler instantiation (beginner-friendly)
    this.scheduler = new InMemorySchedulerAdapter({
      defaultMaxRetries: 3,
      defaultTimeout: 30000,
      enableLogging: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.scheduler.start();
    this.setupEventHandlers();
    this.logger.log('Order scheduling service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.scheduler.stop();
    this.logger.log('Order scheduling service destroyed');
  }

  // ✅ FOCUS: Schedule order reminder with simple configuration
  async scheduleOrderReminder(
    orderId: string,
    orderData: OrderData,
    reminderDelayMinutes: number = 30
  ): Promise<Result<string, Error>> {
    try {
      const scheduleAt = new Date(
        Date.now() + reminderDelayMinutes * 60 * 1000
      );

      const reminderEvent = new OrderReminderEvent(
        orderId,
        {
          ...orderData,
          reminderType: 'order-completion',
          customerEmail: orderData.customerEmail,
          orderTotal: orderData.total,
        },
        scheduleAt
      );

      const jobId = await this.scheduler.schedule(reminderEvent);

      this.logger.log(`Order reminder scheduled: ${orderId} -> ${jobId}`);
      return Result.ok(jobId);
    } catch (error) {
      this.logger.error(`Failed to schedule order reminder: ${error.message}`);
      return Result.fail(
        new Error(`Order reminder scheduling failed: ${error.message}`)
      );
    }
  }

  // ✅ FOCUS: Schedule payment processing with retry policy
  async schedulePaymentProcessing(
    orderId: string,
    paymentData: any,
    processingDelayMinutes: number = 5
  ): Promise<Result<string, Error>> {
    try {
      const scheduleAt = new Date(
        Date.now() + processingDelayMinutes * 60 * 1000
      );

      const paymentEvent = new PaymentProcessingEvent(
        orderId,
        {
          ...paymentData,
          processedAt: new Date(),
          retryPolicy: 'exponential',
        },
        scheduleAt
      );

      const jobId = await this.scheduler.schedule(paymentEvent);

      this.logger.log(`Payment processing scheduled: ${orderId} -> ${jobId}`);
      return Result.ok(jobId);
    } catch (error) {
      this.logger.error(
        `Failed to schedule payment processing: ${error.message}`
      );
      return Result.fail(
        new Error(`Payment processing scheduling failed: ${error.message}`)
      );
    }
  }

  // ✅ FOCUS: Schedule customer notification
  async scheduleCustomerNotification(
    customerId: string,
    notificationData: NotificationData,
    delayMinutes: number = 0
  ): Promise<Result<string, Error>> {
    try {
      const scheduleAt = new Date(Date.now() + delayMinutes * 60 * 1000);

      const notificationEvent = new CustomerNotificationEvent(
        customerId,
        notificationData,
        scheduleAt
      );

      const jobId = await this.scheduler.schedule(notificationEvent);

      this.logger.log(
        `Customer notification scheduled: ${customerId} -> ${jobId}`
      );
      return Result.ok(jobId);
    } catch (error) {
      this.logger.error(
        `Failed to schedule customer notification: ${error.message}`
      );
      return Result.fail(
        new Error(`Notification scheduling failed: ${error.message}`)
      );
    }
  }

  // ✅ FOCUS: Cancel scheduled event
  async cancelScheduledEvent(jobId: string): Promise<Result<void, Error>> {
    try {
      await this.scheduler.cancel(jobId);
      this.logger.log(`Scheduled event cancelled: ${jobId}`);
      return Result.ok(undefined);
    } catch (error) {
      this.logger.error(`Failed to cancel scheduled event: ${error.message}`);
      return Result.fail(
        new Error(`Event cancellation failed: ${error.message}`)
      );
    }
  }

  // ✅ FOCUS: Get scheduler statistics
  async getSchedulingStats(): Promise<SchedulingStats> {
    try {
      const stats = await this.scheduler.getStats();
      return {
        totalScheduled: stats.scheduled + stats.pending,
        completed: stats.completed,
        failed: stats.failed,
        cancelled: stats.cancelled || 0,
        running: stats.running,
      };
    } catch (error) {
      this.logger.error(`Failed to get scheduling stats: ${error.message}`);
      return {
        totalScheduled: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        running: 0,
      };
    }
  }

  // ✅ FOCUS: Health check for scheduler
  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check - try to get stats
      await this.scheduler.getStats();
      return true;
    } catch (error) {
      this.logger.error(`Scheduler health check failed: ${error.message}`);
      return false;
    }
  }

  private setupEventHandlers(): void {
    // Set up basic event handlers for different event types
    this.scheduler.onEvent(
      'OrderReminderEvent',
      async (event: OrderReminderEvent) => {
        await this.handleOrderReminder(event);
      }
    );

    this.scheduler.onEvent(
      'PaymentProcessingEvent',
      async (event: PaymentProcessingEvent) => {
        await this.handlePaymentProcessing(event);
      }
    );

    this.scheduler.onEvent(
      'CustomerNotificationEvent',
      async (event: CustomerNotificationEvent) => {
        await this.handleCustomerNotification(event);
      }
    );
  }

  private async handleOrderReminder(event: OrderReminderEvent): Promise<void> {
    try {
      this.logger.log(`Processing order reminder: ${event.aggregateId}`);

      // Simulate sending reminder email
      const reminderData = event.payload;
      await this.sendReminderEmail(reminderData.customerEmail, {
        orderId: event.aggregateId,
        orderTotal: reminderData.orderTotal,
        reminderType: reminderData.reminderType,
      });

      this.logger.log(
        `Order reminder processed successfully: ${event.aggregateId}`
      );
    } catch (error) {
      this.logger.error(`Failed to process order reminder: ${error.message}`);
      throw error;
    }
  }

  private async handlePaymentProcessing(
    event: PaymentProcessingEvent
  ): Promise<void> {
    try {
      this.logger.log(`Processing payment: ${event.aggregateId}`);

      // Simulate payment processing
      const paymentData = event.payload;
      await this.processPayment(paymentData);

      this.logger.log(`Payment processed successfully: ${event.aggregateId}`);
    } catch (error) {
      this.logger.error(`Failed to process payment: ${error.message}`);
      throw error;
    }
  }

  private async handleCustomerNotification(
    event: CustomerNotificationEvent
  ): Promise<void> {
    try {
      this.logger.log(`Sending customer notification: ${event.aggregateId}`);

      // Simulate sending notification
      const notificationData = event.payload;
      await this.sendNotification(notificationData);

      this.logger.log(
        `Customer notification sent successfully: ${event.aggregateId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send customer notification: ${error.message}`
      );
      throw error;
    }
  }

  private async sendReminderEmail(
    email: string,
    reminderData: any
  ): Promise<void> {
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 100));
    this.logger.debug(`Reminder email sent to: ${email}`);
  }

  private async processPayment(paymentData: any): Promise<void> {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 500));
    this.logger.debug(`Payment processed: ${paymentData.amount}`);
  }

  private async sendNotification(
    notificationData: NotificationData
  ): Promise<void> {
    // Simulate notification sending
    await new Promise(resolve => setTimeout(resolve, 200));
    this.logger.debug(
      `Notification sent via ${notificationData.channel}: ${notificationData.type}`
    );
  }
}

// ⭐ FOCUS: Order reminder event class
export class OrderReminderEvent extends ScheduledEvent {
  constructor(orderId: string, orderData: any, scheduleAt: Date) {
    super(orderId, scheduleAt, orderData, {
      maxRetries: 3,
      backoff: 'exponential',
    });
  }
}

// ⭐ FOCUS: Payment processing event class
export class PaymentProcessingEvent extends ScheduledEvent {
  constructor(orderId: string, paymentData: any, scheduleAt: Date) {
    super(orderId, scheduleAt, paymentData, {
      maxRetries: 5,
      backoff: 'exponential',
    });
  }
}

// ⭐ FOCUS: Customer notification event class
export class CustomerNotificationEvent extends ScheduledEvent {
  constructor(
    customerId: string,
    notificationData: NotificationData,
    scheduleAt: Date
  ) {
    super(customerId, scheduleAt, notificationData, {
      maxRetries: 2,
      backoff: 'fixed',
    });
  }
}
```

```typescript
// order-scheduling.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrderSchedulingService } from './order-scheduling.service';
import { Result } from '@vytches-ddd/utils';
import {
  ScheduleOrderReminderDto,
  SchedulePaymentDto,
  ScheduleNotificationDto,
  SchedulingStatsDto,
} from './dto'; // From your app

@ApiTags('order-scheduling')
@Controller('order-scheduling')
export class OrderSchedulingController {
  constructor(
    // ⭐ FOCUS: Standard NestJS DI injection
    private readonly orderSchedulingService: OrderSchedulingService
  ) {}

  @Post('order-reminder')
  @ApiOperation({ summary: 'Schedule order reminder' })
  @ApiResponse({
    status: 201,
    description: 'Order reminder scheduled successfully',
  })
  async scheduleOrderReminder(@Body() dto: ScheduleOrderReminderDto) {
    const result = await this.orderSchedulingService.scheduleOrderReminder(
      dto.orderId,
      {
        orderId: dto.orderId,
        customerId: dto.customerId,
        customerEmail: dto.customerEmail,
        total: dto.orderTotal,
        items: dto.items || [],
      },
      dto.reminderDelayMinutes
    );

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return {
      success: true,
      jobId: result.value,
      message: 'Order reminder scheduled successfully',
    };
  }

  @Post('payment-processing')
  @ApiOperation({ summary: 'Schedule payment processing' })
  @ApiResponse({
    status: 201,
    description: 'Payment processing scheduled successfully',
  })
  async schedulePaymentProcessing(@Body() dto: SchedulePaymentDto) {
    const result = await this.orderSchedulingService.schedulePaymentProcessing(
      dto.orderId,
      {
        paymentId: dto.paymentId,
        amount: dto.amount,
        currency: dto.currency,
        paymentMethod: dto.paymentMethod,
      },
      dto.processingDelayMinutes
    );

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return {
      success: true,
      jobId: result.value,
      message: 'Payment processing scheduled successfully',
    };
  }

  @Post('customer-notification')
  @ApiOperation({ summary: 'Schedule customer notification' })
  @ApiResponse({
    status: 201,
    description: 'Customer notification scheduled successfully',
  })
  async scheduleCustomerNotification(@Body() dto: ScheduleNotificationDto) {
    const result =
      await this.orderSchedulingService.scheduleCustomerNotification(
        dto.customerId,
        {
          userId: dto.customerId,
          type: dto.notificationType,
          channel: dto.channel,
          recipient: dto.recipient,
          message: dto.message,
          data: dto.data || {},
        },
        dto.delayMinutes
      );

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return {
      success: true,
      jobId: result.value,
      message: 'Customer notification scheduled successfully',
    };
  }

  @Delete(':jobId')
  @ApiOperation({ summary: 'Cancel scheduled event' })
  @ApiResponse({
    status: 200,
    description: 'Scheduled event cancelled successfully',
  })
  async cancelScheduledEvent(@Param('jobId') jobId: string) {
    const result =
      await this.orderSchedulingService.cancelScheduledEvent(jobId);

    if (result.isFailure()) {
      throw new Error(result.error.message);
    }

    return {
      success: true,
      message: 'Scheduled event cancelled successfully',
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get scheduling statistics' })
  @ApiResponse({
    status: 200,
    description: 'Scheduling statistics retrieved successfully',
  })
  async getSchedulingStats(): Promise<SchedulingStatsDto> {
    const stats = await this.orderSchedulingService.getSchedulingStats();

    return {
      totalScheduled: stats.totalScheduled,
      completed: stats.completed,
      failed: stats.failed,
      cancelled: stats.cancelled,
      running: stats.running,
      successRate:
        stats.totalScheduled > 0
          ? ((stats.completed / stats.totalScheduled) * 100).toFixed(2) + '%'
          : '0%',
      timestamp: new Date(),
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check scheduler health' })
  @ApiResponse({ status: 200, description: 'Scheduler health status' })
  async checkHealth() {
    const isHealthy = await this.orderSchedulingService.isHealthy();

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      service: 'order-scheduling',
    };
  }
}
```

```typescript
// order-scheduling.module.ts
import { Module } from '@nestjs/common';
import { OrderSchedulingService } from './order-scheduling.service';
import { OrderSchedulingController } from './order-scheduling.controller';

@Module({
  // ⭐ FOCUS: Simple module configuration with manual setup
  providers: [OrderSchedulingService],
  controllers: [OrderSchedulingController],
  exports: [OrderSchedulingService],
})
export class OrderSchedulingModule {}
```

```typescript
// dto/scheduling.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEmail,
  IsIn,
} from 'class-validator';

export class ScheduleOrderReminderDto {
  @ApiProperty({ description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  customerId: string;

  @ApiProperty({ description: 'Customer email address' })
  @IsEmail()
  customerEmail: string;

  @ApiProperty({ description: 'Order total amount' })
  @IsNumber()
  orderTotal: number;

  @ApiProperty({ description: 'Order items', required: false })
  @IsArray()
  @IsOptional()
  items?: string[];

  @ApiProperty({
    description: 'Delay in minutes before sending reminder',
    default: 30,
  })
  @IsNumber()
  @IsOptional()
  reminderDelayMinutes?: number;
}

export class SchedulePaymentDto {
  @ApiProperty({ description: 'Order ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Payment ID' })
  @IsString()
  paymentId: string;

  @ApiProperty({ description: 'Payment amount' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: 'Payment currency' })
  @IsString()
  currency: string;

  @ApiProperty({ description: 'Payment method' })
  @IsString()
  paymentMethod: string;

  @ApiProperty({
    description: 'Delay in minutes before processing payment',
    default: 5,
  })
  @IsNumber()
  @IsOptional()
  processingDelayMinutes?: number;
}

export class ScheduleNotificationDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  customerId: string;

  @ApiProperty({ description: 'Notification type' })
  @IsString()
  notificationType: string;

  @ApiProperty({ description: 'Notification channel' })
  @IsIn(['email', 'sms', 'push', 'webhook'])
  channel: 'email' | 'sms' | 'push' | 'webhook';

  @ApiProperty({ description: 'Recipient address' })
  @IsString()
  recipient: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'Additional notification data', required: false })
  @IsOptional()
  data?: Record<string, any>;

  @ApiProperty({
    description: 'Delay in minutes before sending notification',
    default: 0,
  })
  @IsNumber()
  @IsOptional()
  delayMinutes?: number;
}

export class SchedulingStatsDto {
  @ApiProperty({ description: 'Total scheduled events' })
  totalScheduled: number;

  @ApiProperty({ description: 'Completed events' })
  completed: number;

  @ApiProperty({ description: 'Failed events' })
  failed: number;

  @ApiProperty({ description: 'Cancelled events' })
  cancelled: number;

  @ApiProperty({ description: 'Currently running events' })
  running: number;

  @ApiProperty({ description: 'Success rate percentage' })
  successRate: string;

  @ApiProperty({ description: 'Statistics timestamp' })
  timestamp: Date;
}
```

## Usage Example

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { OrderSchedulingModule } from './order-scheduling/order-scheduling.module';

@Module({
  imports: [
    OrderSchedulingModule,
    // Other modules...
  ],
})
export class AppModule {}
```

```typescript
// usage-example.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { OrderSchedulingService } from './order-scheduling/order-scheduling.service';

@Injectable()
export class UsageExampleService {
  private readonly logger = new Logger(UsageExampleService.name);

  constructor(
    private readonly orderSchedulingService: OrderSchedulingService
  ) {}

  async demonstrateBasicScheduling(): Promise<void> {
    try {
      // Schedule an order reminder
      const orderReminderResult =
        await this.orderSchedulingService.scheduleOrderReminder(
          'ORDER-12345',
          {
            orderId: 'ORDER-12345',
            customerId: 'CUSTOMER-789',
            customerEmail: 'customer@example.com',
            total: 99.99,
            items: ['Product A', 'Product B'],
          },
          60 // 1 hour delay
        );

      if (orderReminderResult.isSuccess()) {
        this.logger.log(
          `Order reminder scheduled with job ID: ${orderReminderResult.value}`
        );
      }

      // Schedule payment processing
      const paymentResult =
        await this.orderSchedulingService.schedulePaymentProcessing(
          'ORDER-12345',
          {
            paymentId: 'PAY-98765',
            amount: 99.99,
            currency: 'USD',
            paymentMethod: 'credit-card',
          },
          10 // 10 minutes delay
        );

      if (paymentResult.isSuccess()) {
        this.logger.log(
          `Payment processing scheduled with job ID: ${paymentResult.value}`
        );
      }

      // Schedule customer notification
      const notificationResult =
        await this.orderSchedulingService.scheduleCustomerNotification(
          'CUSTOMER-789',
          {
            userId: 'CUSTOMER-789',
            type: 'order-confirmation',
            channel: 'email',
            recipient: 'customer@example.com',
            message: 'Your order has been confirmed and is being processed.',
          },
          5 // 5 minutes delay
        );

      if (notificationResult.isSuccess()) {
        this.logger.log(
          `Customer notification scheduled with job ID: ${notificationResult.value}`
        );
      }

      // Check scheduler statistics
      const stats = await this.orderSchedulingService.getSchedulingStats();
      this.logger.log('Scheduling Statistics:', stats);

      // Check scheduler health
      const isHealthy = await this.orderSchedulingService.isHealthy();
      this.logger.log(
        `Scheduler health status: ${isHealthy ? 'healthy' : 'unhealthy'}`
      );
    } catch (error) {
      this.logger.error(
        `Error in basic scheduling demonstration: ${error.message}`
      );
    }
  }
}
```

## Key Features

- **Manual Setup**: Simple scheduler instantiation with clear configuration
  options
- **NestJS Integration**: Standard dependency injection and lifecycle hooks
  (OnModuleInit, OnModuleDestroy)
- **Event Types**: Dedicated event classes for different business operations
- **Error Handling**: Comprehensive error handling with Result pattern
- **Health Checks**: Built-in health monitoring for scheduler status
- **Statistics**: Real-time scheduling statistics and metrics
- **REST API**: Complete RESTful API with OpenAPI documentation
- **Validation**: Input validation using class-validator decorators

## Common Pitfalls

- **Module Initialization**: Ensure scheduler is properly started/stopped with
  module lifecycle
- **Error Propagation**: Handle Result pattern errors appropriately in
  controllers
- **Memory Management**: Monitor scheduler memory usage in long-running
  applications
- **Event Handler Setup**: Ensure event handlers are registered before scheduler
  starts
- **Health Monitoring**: Implement proper health checks for production
  monitoring

## Related Examples

- [Basic Event Scheduling](../../../basic/example-1.md) - Core scheduling
  concepts
- [NestJS DI Integration](../intermediate/example-1.md) - Advanced dependency
  injection patterns
- [NestJS Enterprise Platform](../advanced/example-1.md) - Enterprise-grade
  NestJS integration
