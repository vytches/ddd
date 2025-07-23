# Simple Event Scheduling - Basic Usage

**Version**: 1.0.0
**Package**: @vytches-ddd/event-scheduling
**Complexity**: basic
**Domain**: Scheduling
**Patterns**: event-scheduling, delayed-execution, job-management

## Description

Basic event scheduling implementation showing how to schedule future events with time-based execution, cancellation, and simple retry policies.

## Business Context

E-commerce platform needs to schedule various time-sensitive operations like order confirmations, payment reminders, and abandoned cart notifications with precise timing control.

## Code Example

```typescript
// basic-scheduling.ts
import { InMemorySchedulerAdapter, ScheduledEvent } from '@vytches-ddd/event-scheduling';
import { DomainEvent } from '@vytches-ddd/events';
import { OrderData, NotificationData } from './types'; // From your app

// ⭐ FOCUS: Basic scheduled event implementation
export class OrderReminderEvent extends ScheduledEvent<OrderData> {
  constructor(
    orderId: string,
    orderData: OrderData,
    scheduleAt: Date
  ) {
    super(orderId, scheduleAt, orderData, {
      maxRetries: 3,
      backoff: 'exponential'
    });
  }
}

export class PaymentReminderEvent extends ScheduledEvent<NotificationData> {
  constructor(
    userId: string,
    notificationData: NotificationData,
    scheduleAt: Date
  ) {
    super(userId, scheduleAt, notificationData, {
      maxRetries: 2,
      backoff: 'linear'
    });
  }
}

// ⭐ FOCUS: Basic scheduler service
export class BasicEventSchedulingService {
  private scheduler: InMemorySchedulerAdapter;

  constructor() {
    this.scheduler = new InMemorySchedulerAdapter({
      defaultMaxRetries: 3,
      defaultTimeout: 30000,
      enableLogging: true
    });
  }

  async start(): Promise<void> {
    await this.scheduler.start();
  }

  async stop(): Promise<void> {
    await this.scheduler.stop();
  }

  // ✅ FOCUS: Schedule order confirmation reminder
  async scheduleOrderReminder(
    orderId: string,
    orderData: OrderData,
    delayMinutes: number = 30
  ): Promise<string> {
    const scheduleAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    
    const event = new OrderReminderEvent(orderId, orderData, scheduleAt);
    
    return await this.scheduler.schedule(event);
  }

  // ✅ FOCUS: Schedule payment reminder
  async schedulePaymentReminder(
    userId: string,
    notificationData: NotificationData,
    delayHours: number = 24
  ): Promise<string> {
    const scheduleAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);
    
    const event = new PaymentReminderEvent(userId, notificationData, scheduleAt);
    
    return await this.scheduler.schedule(event);
  }

  // ✅ FOCUS: Cancel scheduled event
  async cancelScheduledEvent(jobId: string): Promise<void> {
    try {
      await this.scheduler.cancel(jobId);
    } catch (error) {
      throw new Error(`Failed to cancel scheduled event: ${error.message}`);
    }
  }

  // ✅ FOCUS: Reschedule event to new time
  async rescheduleEvent(jobId: string, newTime: Date): Promise<void> {
    try {
      await this.scheduler.reschedule(jobId, newTime);
    } catch (error) {
      throw new Error(`Failed to reschedule event: ${error.message}`);
    }
  }

  // ✅ FOCUS: Get scheduling statistics
  async getSchedulingStats(): Promise<SchedulingStats> {
    const stats = await this.scheduler.getStats();
    
    return {
      totalScheduled: stats.scheduled + stats.pending,
      completed: stats.completed,
      failed: stats.failed,
      cancelled: stats.cancelled,
      running: stats.running
    };
  }

  // ✅ FOCUS: List scheduled jobs
  async listScheduledJobs(filter?: JobFilter): Promise<ScheduledJobSummary[]> {
    const result = await this.scheduler.listJobs({
      status: filter?.status || ['scheduled', 'pending'],
      limit: filter?.limit || 50,
      sortBy: 'scheduledAt',
      sortDirection: 'asc'
    });

    return result.jobs.map(job => ({
      jobId: job.id,
      eventType: job.event.type,
      scheduledAt: job.scheduledAt,
      status: job.status,
      attempts: job.attempts,
      nextRetryAt: job.nextRetryAt
    }));
  }
}

// ⭐ FOCUS: Event handler setup
export class ScheduledEventHandler {
  private schedulingService: BasicEventSchedulingService;

  constructor(schedulingService: BasicEventSchedulingService) {
    this.schedulingService = schedulingService;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle order reminder events
    this.schedulingService.scheduler.onEvent('OrderReminderEvent', async (event: OrderReminderEvent) => {
      await this.handleOrderReminder(event);
    });

    // Handle payment reminder events
    this.schedulingService.scheduler.onEvent('PaymentReminderEvent', async (event: PaymentReminderEvent) => {
      await this.handlePaymentReminder(event);
    });
  }

  private async handleOrderReminder(event: OrderReminderEvent): Promise<void> {
    const orderData = event.payload;
    
    // Send order confirmation reminder
    await this.sendOrderConfirmationEmail(orderData);
    
    console.log(`Order reminder sent for order ${event.aggregateId}`, {
      orderId: orderData.orderId,
      customerEmail: orderData.customerEmail,
      total: orderData.total
    });
  }

  private async handlePaymentReminder(event: PaymentReminderEvent): Promise<void> {
    const notificationData = event.payload;
    
    // Send payment reminder
    await this.sendPaymentReminderNotification(notificationData);
    
    console.log(`Payment reminder sent for user ${event.aggregateId}`, {
      userId: notificationData.userId,
      amount: notificationData.amount,
      dueDate: notificationData.dueDate
    });
  }

  private async sendOrderConfirmationEmail(orderData: OrderData): Promise<void> {
    // Implementation would integrate with email service
    console.log('Sending order confirmation email...', orderData);
  }

  private async sendPaymentReminderNotification(notificationData: NotificationData): Promise<void> {
    // Implementation would integrate with notification service
    console.log('Sending payment reminder notification...', notificationData);
  }
}
```

## Usage Example

```typescript
// usage-example.ts
import { BasicEventSchedulingService, ScheduledEventHandler } from './basic-scheduling';
import { OrderData, NotificationData } from './types';

async function demonstrateBasicScheduling() {
  // ⭐ FOCUS: Initialize scheduling service
  const schedulingService = new BasicEventSchedulingService();
  const eventHandler = new ScheduledEventHandler(schedulingService);
  
  await schedulingService.start();
  
  try {
    // Schedule order reminder (30 minutes from now)
    const orderData: OrderData = {
      orderId: 'ORDER-123',
      customerId: 'CUSTOMER-456',
      customerEmail: 'customer@example.com',
      total: 99.99,
      items: ['Product A', 'Product B']
    };
    
    const orderReminderJobId = await schedulingService.scheduleOrderReminder(
      orderData.orderId,
      orderData,
      30 // 30 minutes
    );
    
    console.log('Order reminder scheduled:', orderReminderJobId);
    
    // Schedule payment reminder (24 hours from now)
    const notificationData: NotificationData = {
      userId: 'USER-789',
      type: 'payment-reminder',
      amount: 149.99,
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
      message: 'Your payment is due soon'
    };
    
    const paymentReminderJobId = await schedulingService.schedulePaymentReminder(
      notificationData.userId,
      notificationData,
      24 // 24 hours
    );
    
    console.log('Payment reminder scheduled:', paymentReminderJobId);
    
    // Get scheduling statistics
    const stats = await schedulingService.getSchedulingStats();
    console.log('Scheduling stats:', stats);
    
    // List scheduled jobs
    const scheduledJobs = await schedulingService.listScheduledJobs({
      limit: 10
    });
    console.log('Scheduled jobs:', scheduledJobs);
    
    // Reschedule payment reminder to 12 hours from now
    const newTime = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await schedulingService.rescheduleEvent(paymentReminderJobId, newTime);
    
    console.log('Payment reminder rescheduled to:', newTime);
    
  } finally {
    await schedulingService.stop();
  }
}

// Run the demonstration
demonstrateBasicScheduling().catch(console.error);
```

## Key Features

- **Simple Event Scheduling**: Schedule events to execute at specific future times
- **Retry Policies**: Built-in retry mechanisms with configurable backoff strategies
- **Job Management**: Cancel, reschedule, and monitor scheduled events
- **Statistics & Monitoring**: Track scheduling performance and job status
- **Event Handlers**: Seamless integration with domain event handlers
- **Type Safety**: Full TypeScript support with strong typing

## Common Pitfalls

- **Time Zone Handling**: Always use UTC times for scheduling to avoid time zone issues
- **Memory Leaks**: Ensure scheduler is properly stopped to clear timers and prevent memory leaks
- **Error Handling**: Implement proper error handling for scheduled event execution failures
- **Testing**: Use dependency injection for easier testing with mock schedulers

## Related Examples

- [Intermediate Event Scheduling](../intermediate/example-1.md) - Advanced scheduling patterns
- [Advanced Event Scheduling](../advanced/example-1.md) - Enterprise-scale scheduling architecture
- [NestJS Integration](../frameworks/nestjs/basic/example-1.md) - Framework integration patterns