# Event Scheduling with Priority and Queuing - Basic Implementation

**Version**: 1.0.0
**Package**: @vytches-ddd/event-scheduling
**Complexity**: basic
**Domain**: Scheduling
**Patterns**: priority-queuing, job-prioritization, resource-management

## Description

Basic implementation of priority-based event scheduling with queuing mechanisms for handling different priority levels and resource constraints in scheduled event execution.

## Business Context

Customer support system needs to schedule various notifications and follow-up actions with different priority levels - urgent customer issues need immediate attention while routine maintenance can be deferred.

## Code Example

```typescript
// priority-scheduling.ts
import { InMemorySchedulerAdapter, ScheduledEvent } from '@vytches-ddd/event-scheduling';
import { SchedulePriority, JobStatus } from '@vytches-ddd/contracts';
import { 
  CustomerIssueData, 
  MaintenanceTaskData, 
  NotificationData 
} from './types'; // From your app

// ⭐ FOCUS: Priority-aware scheduled events
export class PriorityScheduledEvent<T = any> extends ScheduledEvent<T> {
  public readonly priority: SchedulePriority;
  public readonly queueName: string;

  constructor(
    aggregateId: string,
    scheduleAt: Date,
    payload: T,
    priority: SchedulePriority = SchedulePriority.NORMAL,
    queueName: string = 'default'
  ) {
    super(aggregateId, scheduleAt, payload, {
      maxRetries: priority === SchedulePriority.CRITICAL ? 5 : 3,
      backoff: 'exponential'
    });
    
    this.priority = priority;
    this.queueName = queueName;
  }

  // ✅ FOCUS: Priority comparison for sorting
  static comparePriority(a: PriorityScheduledEvent, b: PriorityScheduledEvent): number {
    // Higher priority values come first
    const priorityDiff = b.priority - a.priority;
    if (priorityDiff !== 0) return priorityDiff;
    
    // If same priority, earlier scheduled time comes first
    return a.scheduleAt.getTime() - b.scheduleAt.getTime();
  }
}

// ⭐ FOCUS: Specific priority event types
export class UrgentCustomerIssueEvent extends PriorityScheduledEvent<CustomerIssueData> {
  constructor(
    customerId: string,
    issueData: CustomerIssueData,
    scheduleAt: Date = new Date() // Immediate by default
  ) {
    super(customerId, scheduleAt, issueData, SchedulePriority.CRITICAL, 'customer-support');
  }
}

export class RoutineMaintenanceEvent extends PriorityScheduledEvent<MaintenanceTaskData> {
  constructor(
    taskId: string,
    taskData: MaintenanceTaskData,
    scheduleAt: Date
  ) {
    super(taskId, scheduleAt, taskData, SchedulePriority.LOW, 'maintenance');
  }
}

export class StandardNotificationEvent extends PriorityScheduledEvent<NotificationData> {
  constructor(
    userId: string,
    notificationData: NotificationData,
    scheduleAt: Date
  ) {
    super(userId, scheduleAt, notificationData, SchedulePriority.NORMAL, 'notifications');
  }
}

// ⭐ FOCUS: Priority queue manager
export class PriorityQueueManager {
  private queues: Map<string, PriorityQueue> = new Map();
  private processing: Set<string> = new Set();
  private maxConcurrentJobs: number;

  constructor(maxConcurrentJobs: number = 10) {
    this.maxConcurrentJobs = maxConcurrentJobs;
  }

  // ✅ FOCUS: Add event to priority queue
  addToQueue(event: PriorityScheduledEvent, jobId: string): void {
    const queueName = event.queueName;
    
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, new PriorityQueue(queueName));
    }
    
    const queue = this.queues.get(queueName)!;
    queue.enqueue({ event, jobId, addedAt: new Date() });
    
    console.log(`Event queued: ${jobId}`, {
      queue: queueName,
      priority: event.priority,
      queueSize: queue.size()
    });
  }

  // ✅ FOCUS: Get next event to process
  getNextEvent(): QueueItem | null {
    // Sort queues by highest priority event
    const queuesWithItems = Array.from(this.queues.values())
      .filter(queue => queue.size() > 0)
      .sort((a, b) => {
        const aNext = a.peek();
        const bNext = b.peek();
        if (!aNext || !bNext) return 0;
        return PriorityScheduledEvent.comparePriority(aNext.event, bNext.event);
      });

    if (queuesWithItems.length === 0) {
      return null;
    }

    return queuesWithItems[0].dequeue();
  }

  // ✅ FOCUS: Check if can process more jobs
  canProcessMoreJobs(): boolean {
    return this.processing.size < this.maxConcurrentJobs;
  }

  // ✅ FOCUS: Mark job as processing
  markProcessing(jobId: string): void {
    this.processing.add(jobId);
  }

  // ✅ FOCUS: Mark job as completed
  markCompleted(jobId: string): void {
    this.processing.delete(jobId);
  }

  // ✅ FOCUS: Get queue statistics
  getQueueStats(): QueueStats {
    const stats: QueueStats = {
      totalQueued: 0,
      processing: this.processing.size,
      byQueue: {},
      byPriority: {
        [SchedulePriority.CRITICAL]: 0,
        [SchedulePriority.HIGH]: 0,
        [SchedulePriority.NORMAL]: 0,
        [SchedulePriority.LOW]: 0
      }
    };

    for (const [queueName, queue] of this.queues) {
      const queueSize = queue.size();
      stats.totalQueued += queueSize;
      stats.byQueue[queueName] = queueSize;

      // Count by priority
      queue.getAllItems().forEach(item => {
        stats.byPriority[item.event.priority]++;
      });
    }

    return stats;
  }
}

// ⭐ FOCUS: Priority queue implementation
class PriorityQueue {
  private items: QueueItem[] = [];
  
  constructor(public readonly name: string) {}

  enqueue(item: QueueItem): void {
    this.items.push(item);
    // Sort by priority (highest first, then by schedule time)
    this.items.sort((a, b) => PriorityScheduledEvent.comparePriority(a.event, b.event));
  }

  dequeue(): QueueItem | null {
    return this.items.shift() || null;
  }

  peek(): QueueItem | null {
    return this.items[0] || null;
  }

  size(): number {
    return this.items.length;
  }

  getAllItems(): QueueItem[] {
    return [...this.items];
  }
}

// ⭐ FOCUS: Priority scheduler service
export class PrioritySchedulerService {
  private scheduler: InMemorySchedulerAdapter;
  private queueManager: PriorityQueueManager;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(maxConcurrentJobs: number = 10) {
    this.scheduler = new InMemorySchedulerAdapter({
      defaultMaxRetries: 3,
      defaultTimeout: 30000,
      enableLogging: true
    });
    
    this.queueManager = new PriorityQueueManager(maxConcurrentJobs);
  }

  async start(): Promise<void> {
    await this.scheduler.start();
    this.startProcessingLoop();
    this.setupEventHandlers();
  }

  async stop(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    await this.scheduler.stop();
  }

  // ✅ FOCUS: Schedule priority event
  async schedulePriorityEvent<T>(
    event: PriorityScheduledEvent<T>
  ): Promise<string> {
    const jobId = await this.scheduler.schedule(event);
    
    // Add to priority queue for processing
    this.queueManager.addToQueue(event, jobId);
    
    console.log(`Priority event scheduled: ${jobId}`, {
      eventType: event.constructor.name,
      priority: event.priority,
      queue: event.queueName,
      scheduledAt: event.scheduleAt
    });

    return jobId;
  }

  // ✅ FOCUS: Schedule urgent customer issue
  async scheduleUrgentIssue(
    customerId: string,
    issueData: CustomerIssueData,
    delayMinutes: number = 0
  ): Promise<string> {
    const scheduleAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    const event = new UrgentCustomerIssueEvent(customerId, issueData, scheduleAt);
    
    return await this.schedulePriorityEvent(event);
  }

  // ✅ FOCUS: Schedule routine maintenance
  async scheduleMaintenanceTask(
    taskId: string,
    taskData: MaintenanceTaskData,
    scheduleAt: Date
  ): Promise<string> {
    const event = new RoutineMaintenanceEvent(taskId, taskData, scheduleAt);
    
    return await this.schedulePriorityEvent(event);
  }

  // ✅ FOCUS: Schedule standard notification
  async scheduleNotification(
    userId: string,
    notificationData: NotificationData,
    delayMinutes: number = 5
  ): Promise<string> {
    const scheduleAt = new Date(Date.now() + delayMinutes * 60 * 1000);
    const event = new StandardNotificationEvent(userId, notificationData, scheduleAt);
    
    return await this.schedulePriorityEvent(event);
  }

  // ✅ FOCUS: Get priority queue statistics
  getPriorityQueueStats(): QueueStats {
    return this.queueManager.getQueueStats();
  }

  // ✅ FOCUS: Get scheduler statistics  
  async getSchedulerStats(): Promise<SchedulerStats> {
    const schedulerStats = await this.scheduler.getStats();
    const queueStats = this.queueManager.getQueueStats();
    
    return {
      scheduled: schedulerStats.scheduled + schedulerStats.pending,
      completed: schedulerStats.completed,
      failed: schedulerStats.failed,
      running: schedulerStats.running,
      queued: queueStats.totalQueued,
      processing: queueStats.processing,
      queueBreakdown: queueStats.byQueue,
      priorityBreakdown: queueStats.byPriority
    };
  }

  private startProcessingLoop(): void {
    this.processingInterval = setInterval(async () => {
      await this.processQueuedEvents();
    }, 1000); // Check every second
  }

  private async processQueuedEvents(): Promise<void> {
    while (this.queueManager.canProcessMoreJobs()) {
      const nextItem = this.queueManager.getNextEvent();
      
      if (!nextItem) {
        break; // No more items to process
      }

      // Check if scheduled time has arrived
      if (nextItem.event.scheduleAt > new Date()) {
        // Put it back in queue (it will be sorted properly)
        this.queueManager.addToQueue(nextItem.event, nextItem.jobId);
        break;
      }

      // Mark as processing and execute
      this.queueManager.markProcessing(nextItem.jobId);
      
      // Process asynchronously
      this.executeQueuedEvent(nextItem).catch(error => {
        console.error(`Failed to execute queued event: ${nextItem.jobId}`, error);
        this.queueManager.markCompleted(nextItem.jobId);
      });
    }
  }

  private async executeQueuedEvent(item: QueueItem): Promise<void> {
    try {
      const job = await this.scheduler.getJob(item.jobId);
      
      if (!job || job.status !== JobStatus.SCHEDULED) {
        return; // Job was cancelled or already processed
      }

      // Execute the scheduled job
      await this.processScheduledJob(job);
      
      console.log(`Priority event executed: ${item.jobId}`, {
        priority: item.event.priority,
        waitTime: Date.now() - item.addedAt.getTime()
      });
      
    } finally {
      this.queueManager.markCompleted(item.jobId);
    }
  }

  private async processScheduledJob(job: any): Promise<void> {
    // Delegate to scheduler's processing logic
    // This would normally be handled by the scheduler automatically
    // but we're managing the execution timing through our priority queue
  }

  private setupEventHandlers(): void {
    // Handle urgent customer issues
    this.scheduler.onEvent('UrgentCustomerIssueEvent', async (event: UrgentCustomerIssueEvent) => {
      await this.handleUrgentCustomerIssue(event);
    });

    // Handle routine maintenance
    this.scheduler.onEvent('RoutineMaintenanceEvent', async (event: RoutineMaintenanceEvent) => {
      await this.handleMaintenanceTask(event);
    });

    // Handle standard notifications
    this.scheduler.onEvent('StandardNotificationEvent', async (event: StandardNotificationEvent) => {
      await this.handleNotification(event);
    });
  }

  private async handleUrgentCustomerIssue(event: UrgentCustomerIssueEvent): Promise<void> {
    const issueData = event.payload;
    
    console.log(`🚨 URGENT: Processing customer issue for ${event.aggregateId}`, {
      issueType: issueData.type,
      priority: issueData.priority,
      description: issueData.description
    });

    // Simulate urgent processing
    await this.escalateToSupport(issueData);
    await this.notifyManager(issueData);
  }

  private async handleMaintenanceTask(event: RoutineMaintenanceEvent): Promise<void> {
    const taskData = event.payload;
    
    console.log(`🔧 Processing maintenance task: ${event.aggregateId}`, {
      taskType: taskData.type,
      estimatedDuration: taskData.estimatedDuration
    });

    // Simulate maintenance processing
    await this.performMaintenance(taskData);
  }

  private async handleNotification(event: StandardNotificationEvent): Promise<void> {
    const notificationData = event.payload;
    
    console.log(`📢 Sending notification to ${event.aggregateId}`, {
      type: notificationData.type,
      channel: notificationData.channel
    });

    // Simulate notification sending
    await this.sendNotification(notificationData);
  }

  private async escalateToSupport(issueData: CustomerIssueData): Promise<void> {
    // Simulate support escalation
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Issue escalated to support team');
  }

  private async notifyManager(issueData: CustomerIssueData): Promise<void> {
    // Simulate manager notification
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('Manager notified of urgent issue');
  }

  private async performMaintenance(taskData: MaintenanceTaskData): Promise<void> {
    // Simulate maintenance work
    const duration = taskData.estimatedDuration || 5000;
    await new Promise(resolve => setTimeout(resolve, duration));
    console.log('Maintenance task completed');
  }

  private async sendNotification(notificationData: NotificationData): Promise<void> {
    // Simulate notification sending
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('Notification sent successfully');
  }
}
```

## Usage Example

```typescript
// usage-example.ts
import { 
  PrioritySchedulerService,
  UrgentCustomerIssueEvent,
  RoutineMaintenanceEvent,
  StandardNotificationEvent
} from './priority-scheduling';

async function demonstratePriorityScheduling() {
  const scheduler = new PrioritySchedulerService(5); // Max 5 concurrent jobs
  
  await scheduler.start();
  
  try {
    // Schedule various events with different priorities
    
    // 1. Urgent customer issue (CRITICAL priority)
    const urgentIssueId = await scheduler.scheduleUrgentIssue('CUSTOMER-123', {
      type: 'billing-dispute',
      priority: 'critical',
      description: 'Customer unable to access paid features',
      reportedAt: new Date(),
      customerTier: 'premium'
    });
    
    // 2. Routine maintenance (LOW priority) - scheduled for tonight
    const tonight = new Date();
    tonight.setHours(23, 0, 0, 0);
    
    const maintenanceId = await scheduler.scheduleMaintenanceTask('MAINT-456', {
      type: 'database-cleanup',
      estimatedDuration: 30000, // 30 seconds
      resources: ['database', 'storage'],
      maintainer: 'system'
    }, tonight);
    
    // 3. Standard notification (NORMAL priority)
    const notificationId = await scheduler.scheduleNotification('USER-789', {
      type: 'welcome-email',
      channel: 'email',
      recipient: 'user@example.com',
      template: 'welcome-template',
      data: { userName: 'John Doe' }
    }, 10); // 10 minutes delay
    
    // 4. Another urgent issue (should be processed before notification)
    const anotherUrgentId = await scheduler.scheduleUrgentIssue('CUSTOMER-456', {
      type: 'service-outage',
      priority: 'critical',
      description: 'Customer reporting complete service unavailability',
      reportedAt: new Date(),
      customerTier: 'enterprise'
    }, 5); // 5 minutes delay
    
    console.log('All events scheduled:', {
      urgentIssue1: urgentIssueId,
      maintenance: maintenanceId,
      notification: notificationId,
      urgentIssue2: anotherUrgentId
    });
    
    // Monitor queue statistics
    const monitorStats = async () => {
      const stats = await scheduler.getSchedulerStats();
      const queueStats = scheduler.getPriorityQueueStats();
      
      console.log('📊 Scheduler Statistics:', stats);
      console.log('🔄 Queue Statistics:', queueStats);
    };
    
    // Monitor every 10 seconds
    const statsInterval = setInterval(monitorStats, 10000);
    
    // Let it run for a minute to see processing
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    clearInterval(statsInterval);
    
    // Final statistics
    await monitorStats();
    
  } finally {
    await scheduler.stop();
  }
}

demonstratePriorityScheduling().catch(console.error);
```

## Key Features

- **Priority Levels**: Support for CRITICAL, HIGH, NORMAL, and LOW priority events
- **Queue Management**: Separate queues for different types of events with priority ordering
- **Concurrent Processing**: Configurable maximum concurrent job execution
- **Resource Control**: Prevents system overload by limiting concurrent executions
- **Priority Sorting**: Higher priority events are processed before lower priority ones
- **Queue Statistics**: Monitoring and metrics for queue performance
- **Backpressure Handling**: Graceful handling of queue buildup

## Common Pitfalls

- **Priority Starvation**: Ensure low-priority jobs eventually get processed
- **Resource Exhaustion**: Monitor concurrent job limits to prevent system overload  
- **Queue Buildup**: Implement alerting for growing queue sizes
- **Priority Abuse**: Prevent overuse of high priority levels

## Related Examples

- [Basic Event Scheduling](./example-1.md) - Simple event scheduling without priorities
- [Recurring Events](./example-2.md) - Periodic task scheduling with priorities
- [Advanced Queue Management](../advanced/example-2.md) - Enterprise-scale queue management