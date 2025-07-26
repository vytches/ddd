# Recurring Events and Cron Scheduling - Basic Implementation

**Version**: 1.0.0 **Package**: @vytches/ddd-event-scheduling **Complexity**:
basic **Domain**: Scheduling **Patterns**: recurring-events, cron-scheduling,
periodic-tasks

## Description

Basic implementation of recurring events and cron-like scheduling for periodic
tasks such as report generation, data cleanup, and maintenance operations.

## Business Context

SaaS application needs to schedule recurring tasks like daily reports, weekly
data backups, monthly billing cycles, and quarterly compliance audits with
flexible timing patterns.

## Code Example

```typescript
// recurring-scheduling.ts
import {
  InMemorySchedulerAdapter,
  ScheduledEvent,
} from '@vytches/ddd-event-scheduling';
import { JobStatus } from '@vytches/ddd-contracts';
import { ReportData, BackupData, BillingData } from './types'; // From your app

// ⭐ FOCUS: Recurring event implementation
export class RecurringScheduledEvent<T = any> extends ScheduledEvent<T> {
  public readonly cronExpression?: string;
  public readonly recurringOptions?: RecurringOptions;

  constructor(
    aggregateId: string,
    scheduleAt: Date,
    payload?: T,
    recurringOptions?: RecurringOptions,
    cronExpression?: string
  ) {
    super(aggregateId, scheduleAt, payload, {
      maxRetries: 3,
      backoff: 'exponential',
    });

    this.recurringOptions = recurringOptions;
    this.cronExpression = cronExpression;
  }

  // ✅ FOCUS: Calculate next occurrence
  getNextOccurrence(): Date | null {
    if (!this.recurringOptions) return null;

    const now = new Date();
    const { pattern, interval, endDate } = this.recurringOptions;

    if (endDate && now > endDate) {
      return null; // Recurring has ended
    }

    let nextDate = new Date(this.scheduleAt);

    switch (pattern) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + (interval || 1));
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7 * (interval || 1));
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + (interval || 1));
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + (interval || 1));
        break;
      default:
        return null;
    }

    return nextDate > now ? nextDate : null;
  }
}

// ⭐ FOCUS: Specific recurring event types
export class DailyReportEvent extends RecurringScheduledEvent<ReportData> {
  constructor(reportData: ReportData, startTime: Date = new Date()) {
    const recurringOptions: RecurringOptions = {
      pattern: 'daily',
      interval: 1,
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    };

    super('daily-report', startTime, reportData, recurringOptions);
  }
}

export class WeeklyBackupEvent extends RecurringScheduledEvent<BackupData> {
  constructor(backupData: BackupData, startTime: Date) {
    const recurringOptions: RecurringOptions = {
      pattern: 'weekly',
      interval: 1,
      dayOfWeek: 0, // Sunday
    };

    super('weekly-backup', startTime, backupData, recurringOptions);
  }
}

export class MonthlyBillingEvent extends RecurringScheduledEvent<BillingData> {
  constructor(billingData: BillingData, startTime: Date) {
    const recurringOptions: RecurringOptions = {
      pattern: 'monthly',
      interval: 1,
      dayOfMonth: 1, // First day of month
    };

    super('monthly-billing', startTime, billingData, recurringOptions);
  }
}

// ⭐ FOCUS: Recurring scheduler service
export class RecurringSchedulerService {
  private scheduler: InMemorySchedulerAdapter;
  private recurringJobs: Map<string, RecurringJobInfo> = new Map();

  constructor() {
    this.scheduler = new InMemorySchedulerAdapter({
      defaultMaxRetries: 3,
      defaultTimeout: 60000,
      enableLogging: true,
    });
  }

  async start(): Promise<void> {
    await this.scheduler.start();
    this.setupEventHandlers();
  }

  async stop(): Promise<void> {
    await this.scheduler.stop();
  }

  // ✅ FOCUS: Schedule recurring event
  async scheduleRecurring<T>(
    event: RecurringScheduledEvent<T>,
    jobId?: string
  ): Promise<string> {
    const finalJobId = jobId || `recurring-${event.aggregateId}-${Date.now()}`;

    // Schedule the first occurrence
    const scheduledJobId = await this.scheduler.schedule(event);

    // Track as recurring job
    this.recurringJobs.set(finalJobId, {
      id: finalJobId,
      originalEvent: event,
      currentJobId: scheduledJobId,
      nextOccurrence: event.getNextOccurrence(),
      isActive: true,
      executionCount: 0,
    });

    console.log(`Recurring event scheduled: ${finalJobId}`, {
      eventType: event.constructor.name,
      firstExecution: event.scheduleAt,
      nextOccurrence: event.getNextOccurrence(),
      pattern: event.recurringOptions?.pattern,
    });

    return finalJobId;
  }

  // ✅ FOCUS: Cancel recurring event
  async cancelRecurring(recurringJobId: string): Promise<void> {
    const recurringJob = this.recurringJobs.get(recurringJobId);

    if (!recurringJob) {
      throw new Error(`Recurring job ${recurringJobId} not found`);
    }

    // Cancel current scheduled job
    try {
      await this.scheduler.cancel(recurringJob.currentJobId);
    } catch (error) {
      // Job might already be completed or cancelled
      console.warn(`Failed to cancel current job: ${error.message}`);
    }

    // Mark as inactive
    recurringJob.isActive = false;

    console.log(`Recurring event cancelled: ${recurringJobId}`);
  }

  // ✅ FOCUS: Get recurring job status
  async getRecurringJobStatus(
    recurringJobId: string
  ): Promise<RecurringJobStatus | null> {
    const recurringJob = this.recurringJobs.get(recurringJobId);

    if (!recurringJob) {
      return null;
    }

    const currentJob = await this.scheduler.getJob(recurringJob.currentJobId);

    return {
      id: recurringJob.id,
      isActive: recurringJob.isActive,
      executionCount: recurringJob.executionCount,
      nextOccurrence: recurringJob.nextOccurrence,
      currentJobStatus: currentJob?.status || JobStatus.COMPLETED,
      lastExecuted: currentJob?.completedAt,
      eventType: recurringJob.originalEvent.constructor.name,
    };
  }

  // ✅ FOCUS: List all recurring jobs
  async listRecurringJobs(): Promise<RecurringJobStatus[]> {
    const statuses: RecurringJobStatus[] = [];

    for (const [recurringJobId] of this.recurringJobs) {
      const status = await this.getRecurringJobStatus(recurringJobId);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses.sort((a, b) => {
      if (!a.nextOccurrence) return 1;
      if (!b.nextOccurrence) return -1;
      return a.nextOccurrence.getTime() - b.nextOccurrence.getTime();
    });
  }

  private setupEventHandlers(): void {
    // Set up completion handler to schedule next occurrence
    this.scheduler.onJobCompleted(async job => {
      await this.handleJobCompletion(job);
    });

    this.scheduler.onJobFailed(async job => {
      console.error(`Scheduled job failed: ${job.id}`, {
        eventType: job.event.type,
        error: job.lastError,
        attempts: job.attempts,
      });
    });
  }

  private async handleJobCompletion(job: any): Promise<void> {
    // Find recurring job that matches this completed job
    for (const [recurringJobId, recurringJob] of this.recurringJobs) {
      if (recurringJob.currentJobId === job.id && recurringJob.isActive) {
        recurringJob.executionCount++;

        // Calculate next occurrence
        const nextOccurrence = recurringJob.originalEvent.getNextOccurrence();

        if (nextOccurrence) {
          // Create new event for next occurrence
          const nextEvent = this.createNextEvent(
            recurringJob.originalEvent,
            nextOccurrence
          );

          // Schedule next occurrence
          const nextJobId = await this.scheduler.schedule(nextEvent);

          // Update recurring job info
          recurringJob.currentJobId = nextJobId;
          recurringJob.nextOccurrence = nextEvent.getNextOccurrence();

          console.log(`Next occurrence scheduled for ${recurringJobId}`, {
            nextExecution: nextOccurrence,
            executionCount: recurringJob.executionCount,
          });
        } else {
          // No more occurrences, mark as inactive
          recurringJob.isActive = false;
          recurringJob.nextOccurrence = null;

          console.log(`Recurring job completed: ${recurringJobId}`, {
            totalExecutions: recurringJob.executionCount,
          });
        }

        break;
      }
    }
  }

  private createNextEvent<T>(
    originalEvent: RecurringScheduledEvent<T>,
    nextTime: Date
  ): RecurringScheduledEvent<T> {
    // Create a new event instance for the next occurrence
    return new (originalEvent.constructor as new (
      ...args: any[]
    ) => RecurringScheduledEvent<T>)(originalEvent.payload, nextTime);
  }
}

// ⭐ FOCUS: Event handlers for recurring events
export class RecurringEventHandlers {
  constructor(private scheduler: RecurringSchedulerService) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle daily reports
    this.scheduler.scheduler.onEvent(
      'DailyReportEvent',
      async (event: DailyReportEvent) => {
        await this.handleDailyReport(event);
      }
    );

    // Handle weekly backups
    this.scheduler.scheduler.onEvent(
      'WeeklyBackupEvent',
      async (event: WeeklyBackupEvent) => {
        await this.handleWeeklyBackup(event);
      }
    );

    // Handle monthly billing
    this.scheduler.scheduler.onEvent(
      'MonthlyBillingEvent',
      async (event: MonthlyBillingEvent) => {
        await this.handleMonthlyBilling(event);
      }
    );
  }

  private async handleDailyReport(event: DailyReportEvent): Promise<void> {
    const reportData = event.payload;

    console.log('Generating daily report...', {
      reportType: reportData.type,
      dateRange: reportData.dateRange,
    });

    // Implementation would generate actual report
    await this.generateReport(reportData);
  }

  private async handleWeeklyBackup(event: WeeklyBackupEvent): Promise<void> {
    const backupData = event.payload;

    console.log('Performing weekly backup...', {
      databases: backupData.databases,
      destination: backupData.destination,
    });

    // Implementation would perform actual backup
    await this.performBackup(backupData);
  }

  private async handleMonthlyBilling(
    event: MonthlyBillingEvent
  ): Promise<void> {
    const billingData = event.payload;

    console.log('Processing monthly billing...', {
      customerCount: billingData.customers.length,
      billingPeriod: billingData.period,
    });

    // Implementation would process actual billing
    await this.processBilling(billingData);
  }

  private async generateReport(reportData: ReportData): Promise<void> {
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Daily report generated successfully');
  }

  private async performBackup(backupData: BackupData): Promise<void> {
    // Simulate backup operation
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('Weekly backup completed successfully');
  }

  private async processBilling(billingData: BillingData): Promise<void> {
    // Simulate billing processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('Monthly billing processed successfully');
  }
}
```

## Usage Example

```typescript
// usage-example.ts
import {
  RecurringSchedulerService,
  RecurringEventHandlers,
  DailyReportEvent,
  WeeklyBackupEvent,
  MonthlyBillingEvent,
} from './recurring-scheduling';

async function demonstrateRecurringScheduling() {
  const scheduler = new RecurringSchedulerService();
  const handlers = new RecurringEventHandlers(scheduler);

  await scheduler.start();

  try {
    // Schedule daily report (starting tomorrow at 9 AM)
    const tomorrow9AM = new Date();
    tomorrow9AM.setDate(tomorrow9AM.getDate() + 1);
    tomorrow9AM.setHours(9, 0, 0, 0);

    const dailyReportEvent = new DailyReportEvent(
      {
        type: 'sales-summary',
        dateRange: { start: new Date(), end: new Date() },
        recipients: ['manager@company.com'],
      },
      tomorrow9AM
    );

    const dailyJobId = await scheduler.scheduleRecurring(dailyReportEvent);
    console.log('Daily report scheduled:', dailyJobId);

    // Schedule weekly backup (starting this Sunday at 2 AM)
    const nextSunday2AM = new Date();
    nextSunday2AM.setDate(
      nextSunday2AM.getDate() + (7 - nextSunday2AM.getDay())
    );
    nextSunday2AM.setHours(2, 0, 0, 0);

    const weeklyBackupEvent = new WeeklyBackupEvent(
      {
        databases: ['users', 'orders', 'products'],
        destination: 's3://backup-bucket/weekly',
        compression: true,
      },
      nextSunday2AM
    );

    const weeklyJobId = await scheduler.scheduleRecurring(weeklyBackupEvent);
    console.log('Weekly backup scheduled:', weeklyJobId);

    // Schedule monthly billing (starting first day of next month)
    const nextMonth1st = new Date();
    nextMonth1st.setMonth(nextMonth1st.getMonth() + 1, 1);
    nextMonth1st.setHours(0, 0, 0, 0);

    const monthlyBillingEvent = new MonthlyBillingEvent(
      {
        period: { year: 2024, month: 1 },
        customers: ['customer-1', 'customer-2'],
        currency: 'USD',
      },
      nextMonth1st
    );

    const monthlyJobId = await scheduler.scheduleRecurring(monthlyBillingEvent);
    console.log('Monthly billing scheduled:', monthlyJobId);

    // List all recurring jobs
    const recurringJobs = await scheduler.listRecurringJobs();
    console.log('All recurring jobs:', recurringJobs);

    // Get status of specific job
    const dailyJobStatus = await scheduler.getRecurringJobStatus(dailyJobId);
    console.log('Daily job status:', dailyJobStatus);
  } finally {
    await scheduler.stop();
  }
}

demonstrateRecurringScheduling().catch(console.error);
```

## Key Features

- **Recurring Patterns**: Support for daily, weekly, monthly, and yearly
  recurring events
- **Flexible Scheduling**: Custom intervals and specific days/dates for
  recurring events
- **Automatic Continuation**: Events automatically schedule their next
  occurrence after completion
- **End Date Support**: Optional end dates for finite recurring schedules
- **Job Tracking**: Track execution counts and status for recurring jobs
- **Cancellation**: Cancel entire recurring schedules or individual occurrences
- **Error Handling**: Built-in retry policies for failed recurring events

## Common Pitfalls

- **Clock Drift**: Ensure system clocks are synchronized for accurate recurring
  scheduling
- **Overlap Prevention**: Consider execution time when scheduling frequent
  recurring events
- **Resource Management**: Monitor resource usage for long-running recurring
  schedules
- **Time Zone Changes**: Handle daylight saving time transitions properly

## Related Examples

- [Basic Event Scheduling](./example-1.md) - Simple one-time event scheduling
- [Advanced Recurring Patterns](../advanced/example-1.md) - Complex recurring
  event patterns
- [Distributed Scheduling](../advanced/example-2.md) - Multi-node recurring
  scheduling
