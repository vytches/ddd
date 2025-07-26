# Advanced Queue Management - Dead Letter Queues and Backpressure

**Version**: 1.0.0 **Package**: @vytches/ddd-event-scheduling **Complexity**:
intermediate **Domain**: Infrastructure **Patterns**: dead-letter-queue,
backpressure-handling, advanced-queuing, error-recovery

## Description

Intermediate implementation of sophisticated queue management with dead letter
queues, backpressure handling, circuit breakers, and advanced error recovery
patterns for production-grade event scheduling.

## Business Context

High-volume e-commerce platform processing millions of scheduled events needs
robust error handling, backpressure management, and dead letter queue processing
to ensure no events are lost while maintaining system stability.

## Code Example

```typescript
// advanced-queue-management.ts
import {
  InMemorySchedulerAdapter,
  ScheduledEvent,
} from '@vytches/ddd-event-scheduling';
import { JobStatus, SchedulePriority } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';
import {
  DeadLetterQueueItem,
  SchedulingMetrics,
  BackpressureConfig,
  CircuitBreakerState,
} from './types'; // From your app

// ⭐ FOCUS: Advanced queue management with error handling
export class AdvancedQueueManager {
  private deadLetterQueue: Map<string, DeadLetterQueueItem> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private metrics: SchedulingMetrics = {
    totalEvents: 0,
    successRate: 0,
    averageExecutionTime: 0,
    queuedEvents: 0,
    failedEvents: 0,
    retriedEvents: 0,
  };

  private readonly logger = Logger.forContext('AdvancedQueueManager');
  private backpressureConfig: BackpressureConfig;

  constructor(backpressureConfig?: BackpressureConfig) {
    this.backpressureConfig = {
      maxQueueSize: 10000,
      highWaterMark: 8000,
      lowWaterMark: 2000,
      backpressureStrategy: 'drop-oldest',
      throttleMs: 1000,
      ...backpressureConfig,
    };
  }

  // ✅ FOCUS: Check if queue can accept more events
  canAcceptEvents(queueName: string, currentSize: number): boolean {
    // Check backpressure conditions
    if (currentSize >= this.backpressureConfig.maxQueueSize) {
      this.logger.warn('Queue at maximum capacity', {
        queueName,
        currentSize,
        maxSize: this.backpressureConfig.maxQueueSize,
      });
      return false;
    }

    // Check circuit breaker state
    const circuitBreaker = this.getCircuitBreaker(queueName);
    if (circuitBreaker.state === 'OPEN') {
      this.logger.warn('Circuit breaker open for queue', { queueName });
      return false;
    }

    return true;
  }

  // ✅ FOCUS: Handle backpressure when queue is full
  async handleBackpressure(
    queueName: string,
    currentEvents: QueuedEvent[],
    newEvent: QueuedEvent
  ): Promise<BackpressureResult> {
    const { backpressureStrategy } = this.backpressureConfig;

    switch (backpressureStrategy) {
      case 'drop-oldest':
        return this.dropOldestEvent(currentEvents, newEvent);

      case 'drop-lowest-priority':
        return this.dropLowestPriorityEvent(currentEvents, newEvent);

      case 'reject-new':
        return {
          accepted: false,
          dropped: null,
          reason: 'Queue full - rejecting new event',
        };

      case 'throttle':
        await this.throttleExecution();
        return {
          accepted: true,
          dropped: null,
          reason: 'Event throttled and accepted',
        };

      default:
        return {
          accepted: false,
          dropped: null,
          reason: 'Unknown backpressure strategy',
        };
    }
  }

  // ✅ FOCUS: Add event to dead letter queue
  async addToDeadLetterQueue(
    originalEvent: ScheduledEvent,
    jobId: string,
    failureReason: string,
    lastError: string,
    attempts: number
  ): Promise<void> {
    const deadLetterItem: DeadLetterQueueItem = {
      originalEvent,
      jobId,
      failureReason,
      failedAt: new Date(),
      attempts,
      lastError,
    };

    this.deadLetterQueue.set(jobId, deadLetterItem);

    this.logger.error('Event moved to dead letter queue', {
      jobId,
      eventType: originalEvent.constructor.name,
      failureReason,
      attempts,
      deadLetterQueueSize: this.deadLetterQueue.size,
    });

    // Update metrics
    this.metrics.failedEvents++;
    this.updateSuccessRate();
  }

  // ✅ FOCUS: Process dead letter queue items
  async processDeadLetterQueue(): Promise<ProcessingResult> {
    const processed: string[] = [];
    const requeued: string[] = [];
    const permanentFailures: string[] = [];

    for (const [jobId, item] of this.deadLetterQueue.entries()) {
      try {
        const result = await this.analyzeDeadLetterItem(item);

        switch (result.action) {
          case 'requeue':
            await this.requeueDeadLetterItem(item);
            requeued.push(jobId);
            this.deadLetterQueue.delete(jobId);
            break;

          case 'discard':
            permanentFailures.push(jobId);
            this.deadLetterQueue.delete(jobId);
            break;

          case 'keep':
            // Keep in dead letter queue for now
            break;
        }

        processed.push(jobId);
      } catch (error) {
        this.logger.error('Failed to process dead letter item', {
          jobId,
          error: error.message,
        });
      }
    }

    this.logger.info('Dead letter queue processing completed', {
      processed: processed.length,
      requeued: requeued.length,
      permanentFailures: permanentFailures.length,
      remaining: this.deadLetterQueue.size,
    });

    return {
      processed,
      requeued,
      permanentFailures,
      remaining: this.deadLetterQueue.size,
    };
  }

  // ✅ FOCUS: Circuit breaker management
  updateCircuitBreaker(queueName: string, success: boolean): void {
    const circuitBreaker = this.getCircuitBreaker(queueName);
    const now = new Date();

    if (success) {
      circuitBreaker.successCount++;
      circuitBreaker.consecutiveFailures = 0;

      // Close circuit if in half-open state and we have enough successes
      if (
        circuitBreaker.state === 'HALF_OPEN' &&
        circuitBreaker.successCount >= 5
      ) {
        circuitBreaker.state = 'CLOSED';
        circuitBreaker.lastStateChange = now;

        this.logger.info('Circuit breaker closed', { queueName });
      }
    } else {
      circuitBreaker.failureCount++;
      circuitBreaker.consecutiveFailures++;

      // Open circuit if failure threshold exceeded
      if (
        circuitBreaker.state === 'CLOSED' &&
        circuitBreaker.consecutiveFailures >= 10
      ) {
        circuitBreaker.state = 'OPEN';
        circuitBreaker.lastStateChange = now;
        circuitBreaker.nextAttemptAfter = new Date(now.getTime() + 60000); // 1 minute

        this.logger.warn('Circuit breaker opened', { queueName });
      }
    }

    // Check if we should move from OPEN to HALF_OPEN
    if (
      circuitBreaker.state === 'OPEN' &&
      now > circuitBreaker.nextAttemptAfter
    ) {
      circuitBreaker.state = 'HALF_OPEN';
      circuitBreaker.lastStateChange = now;
      circuitBreaker.successCount = 0;

      this.logger.info('Circuit breaker moved to half-open', { queueName });
    }
  }

  // ✅ FOCUS: Get queue metrics
  getQueueMetrics(): AdvancedQueueMetrics {
    const circuitBreakerStates = new Map<string, string>();

    for (const [queueName, breaker] of this.circuitBreakers) {
      circuitBreakerStates.set(queueName, breaker.state);
    }

    return {
      ...this.metrics,
      deadLetterQueueSize: this.deadLetterQueue.size,
      circuitBreakerStates,
      backpressureActive: this.isBackpressureActive(),
      queueCapacityUtilization: this.calculateCapacityUtilization(),
    };
  }

  private getCircuitBreaker(queueName: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(queueName)) {
      this.circuitBreakers.set(queueName, {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        consecutiveFailures: 0,
        lastStateChange: new Date(),
        nextAttemptAfter: new Date(),
      });
    }

    return this.circuitBreakers.get(queueName)!;
  }

  private dropOldestEvent(
    currentEvents: QueuedEvent[],
    newEvent: QueuedEvent
  ): BackpressureResult {
    if (currentEvents.length === 0) {
      return { accepted: true, dropped: null, reason: 'Queue empty' };
    }

    // Find oldest event (earliest schedule time)
    const oldestEvent = currentEvents.reduce((oldest, current) =>
      current.event.scheduleAt < oldest.event.scheduleAt ? current : oldest
    );

    return {
      accepted: true,
      dropped: oldestEvent,
      reason: 'Dropped oldest event due to backpressure',
    };
  }

  private dropLowestPriorityEvent(
    currentEvents: QueuedEvent[],
    newEvent: QueuedEvent
  ): BackpressureResult {
    // Find event with lowest priority
    const lowestPriorityEvent = currentEvents.reduce((lowest, current) => {
      const currentPriority =
        (current.event as any).priority || SchedulePriority.NORMAL;
      const lowestPriority =
        (lowest.event as any).priority || SchedulePriority.NORMAL;
      return currentPriority < lowestPriority ? current : lowest;
    });

    const newEventPriority =
      (newEvent.event as any).priority || SchedulePriority.NORMAL;
    const lowestCurrentPriority =
      (lowestPriorityEvent.event as any).priority || SchedulePriority.NORMAL;

    // Only accept if new event has higher priority than lowest current event
    if (newEventPriority > lowestCurrentPriority) {
      return {
        accepted: true,
        dropped: lowestPriorityEvent,
        reason: 'Dropped lowest priority event for higher priority event',
      };
    }

    return {
      accepted: false,
      dropped: null,
      reason: 'New event priority not higher than lowest queued event',
    };
  }

  private async throttleExecution(): Promise<void> {
    await new Promise(resolve =>
      setTimeout(resolve, this.backpressureConfig.throttleMs)
    );
  }

  private async analyzeDeadLetterItem(
    item: DeadLetterQueueItem
  ): Promise<DeadLetterAnalysis> {
    const { originalEvent, failureReason, attempts, failedAt } = item;
    const hoursSinceFailure =
      (Date.now() - failedAt.getTime()) / (1000 * 60 * 60);

    // Retry transient failures after some time
    if (this.isTransientFailure(failureReason) && hoursSinceFailure > 1) {
      return {
        action: 'requeue',
        reason: 'Transient failure, retry after delay',
      };
    }

    // Discard permanent failures after max attempts
    if (attempts >= 10 || this.isPermanentFailure(failureReason)) {
      return {
        action: 'discard',
        reason: 'Permanent failure or max attempts exceeded',
      };
    }

    // Keep in dead letter queue for manual review
    return { action: 'keep', reason: 'Needs manual review' };
  }

  private async requeueDeadLetterItem(
    item: DeadLetterQueueItem
  ): Promise<void> {
    // Create new scheduled event with adjusted timing
    const newScheduleTime = new Date(Date.now() + 300000); // 5 minutes from now
    const newEvent = item.originalEvent.reschedule(newScheduleTime);

    this.logger.info('Requeuing dead letter item', {
      jobId: item.jobId,
      originalScheduleTime: item.originalEvent.scheduleAt,
      newScheduleTime,
      attempts: item.attempts,
    });

    // Would need to integrate with actual scheduler to requeue
    // This is a placeholder for the actual requeuing logic
  }

  private isTransientFailure(failureReason: string): boolean {
    const transientPatterns = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'rate limit',
    ];

    return transientPatterns.some(pattern =>
      failureReason.toLowerCase().includes(pattern)
    );
  }

  private isPermanentFailure(failureReason: string): boolean {
    const permanentPatterns = [
      'validation',
      'authorization',
      'not found',
      'invalid format',
      'malformed',
    ];

    return permanentPatterns.some(pattern =>
      failureReason.toLowerCase().includes(pattern)
    );
  }

  private updateSuccessRate(): void {
    const total = this.metrics.totalEvents;
    const failed = this.metrics.failedEvents;
    const successful = total - failed;

    this.metrics.successRate = total > 0 ? (successful / total) * 100 : 0;
  }

  private isBackpressureActive(): boolean {
    return this.metrics.queuedEvents > this.backpressureConfig.highWaterMark;
  }

  private calculateCapacityUtilization(): number {
    return (
      (this.metrics.queuedEvents / this.backpressureConfig.maxQueueSize) * 100
    );
  }
}

// ⭐ FOCUS: Enhanced scheduler with queue management
export class EnhancedSchedulerService {
  private scheduler: InMemorySchedulerAdapter;
  private queueManager: AdvancedQueueManager;
  private readonly logger = Logger.forContext('EnhancedSchedulerService');
  private deadLetterProcessingInterval: NodeJS.Timeout | null = null;

  constructor(backpressureConfig?: BackpressureConfig) {
    this.scheduler = new InMemorySchedulerAdapter({
      defaultMaxRetries: 5,
      defaultTimeout: 30000,
      enableLogging: true,
    });

    this.queueManager = new AdvancedQueueManager(backpressureConfig);
  }

  async start(): Promise<void> {
    await this.scheduler.start();
    this.startDeadLetterProcessing();
    this.setupEventHandlers();

    this.logger.info('Enhanced scheduler service started');
  }

  async stop(): Promise<void> {
    if (this.deadLetterProcessingInterval) {
      clearInterval(this.deadLetterProcessingInterval);
    }

    await this.scheduler.stop();

    this.logger.info('Enhanced scheduler service stopped');
  }

  // ✅ FOCUS: Enhanced event scheduling with queue management
  async scheduleEventWithQueueManagement<T>(
    event: ScheduledEvent<T>,
    queueName: string = 'default'
  ): Promise<Result<string, Error>> {
    try {
      // Check if we can accept more events
      const currentQueueSize = await this.getCurrentQueueSize(queueName);

      if (!this.queueManager.canAcceptEvents(queueName, currentQueueSize)) {
        // Handle backpressure
        const currentEvents = await this.getCurrentEvents(queueName);
        const newQueuedEvent = { event, jobId: `temp-${Date.now()}` };

        const backpressureResult = await this.queueManager.handleBackpressure(
          queueName,
          currentEvents,
          newQueuedEvent
        );

        if (!backpressureResult.accepted) {
          return Result.fail(
            new Error(
              `Event rejected due to backpressure: ${backpressureResult.reason}`
            )
          );
        }

        if (backpressureResult.dropped) {
          this.logger.warn('Event dropped due to backpressure', {
            droppedJobId: backpressureResult.dropped.jobId,
            reason: backpressureResult.reason,
          });
        }
      }

      // Schedule the event
      const jobId = await this.scheduler.schedule(event);

      // Update circuit breaker on success
      this.queueManager.updateCircuitBreaker(queueName, true);

      this.logger.info('Event scheduled with queue management', {
        jobId,
        queueName,
        eventType: event.constructor.name,
      });

      return Result.ok(jobId);
    } catch (error) {
      // Update circuit breaker on failure
      this.queueManager.updateCircuitBreaker(queueName, false);

      return Result.fail(
        new Error(`Failed to schedule event: ${error.message}`)
      );
    }
  }

  // ✅ FOCUS: Get enhanced metrics
  async getEnhancedMetrics(): Promise<EnhancedSchedulerMetrics> {
    const queueMetrics = this.queueManager.getQueueMetrics();
    const schedulerStats = await this.scheduler.getStats();

    return {
      scheduler: {
        scheduled: schedulerStats.scheduled + schedulerStats.pending,
        completed: schedulerStats.completed,
        failed: schedulerStats.failed,
        running: schedulerStats.running,
      },
      queue: queueMetrics,
      deadLetterQueue: {
        size: queueMetrics.deadLetterQueueSize,
        oldestItem: await this.getOldestDeadLetterItem(),
        processingEnabled: this.deadLetterProcessingInterval !== null,
      },
      timestamp: new Date(),
    };
  }

  // ✅ FOCUS: Manual dead letter queue processing
  async processDeadLetterQueueManually(): Promise<ProcessingResult> {
    this.logger.info('Starting manual dead letter queue processing');
    return await this.queueManager.processDeadLetterQueue();
  }

  private async getCurrentQueueSize(queueName: string): Promise<number> {
    // In real implementation, this would query actual queue size
    // For demo, return simulated size
    return Math.floor(Math.random() * 100);
  }

  private async getCurrentEvents(queueName: string): Promise<QueuedEvent[]> {
    // In real implementation, this would return current queued events
    // For demo, return empty array
    return [];
  }

  private startDeadLetterProcessing(): void {
    // Process dead letter queue every 5 minutes
    this.deadLetterProcessingInterval = setInterval(async () => {
      try {
        const result = await this.queueManager.processDeadLetterQueue();

        if (result.processed.length > 0) {
          this.logger.info(
            'Dead letter queue processing cycle completed',
            result
          );
        }
      } catch (error) {
        this.logger.error('Dead letter queue processing failed', {
          error: error.message,
        });
      }
    }, 300000); // 5 minutes
  }

  private setupEventHandlers(): void {
    // Handle job failures to move to dead letter queue
    this.scheduler.onJobFailed(async job => {
      if (job.attempts >= (job.event.scheduleOptions?.maxRetries || 5)) {
        await this.queueManager.addToDeadLetterQueue(
          job.event,
          job.id,
          'Max retries exceeded',
          job.lastError || 'Unknown error',
          job.attempts
        );
      }
    });
  }

  private async getOldestDeadLetterItem(): Promise<Date | null> {
    const metrics = this.queueManager.getQueueMetrics();

    if (metrics.deadLetterQueueSize === 0) {
      return null;
    }

    // In real implementation, would return actual oldest timestamp
    return new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  }
}
```

## Usage Example

```typescript
// usage-example.ts
import {
  EnhancedSchedulerService,
  AdvancedQueueManager,
} from './advanced-queue-management';

async function demonstrateAdvancedQueueManagement() {
  // Configure backpressure handling
  const backpressureConfig = {
    maxQueueSize: 1000,
    highWaterMark: 800,
    lowWaterMark: 200,
    backpressureStrategy: 'drop-lowest-priority' as const,
    throttleMs: 2000,
  };

  const scheduler = new EnhancedSchedulerService(backpressureConfig);

  await scheduler.start();

  try {
    // Simulate high-volume event scheduling
    const scheduleResults = [];

    for (let i = 0; i < 50; i++) {
      const event = new OrderProcessingEvent(
        `ORDER-${i}`,
        {
          customerId: `CUSTOMER-${i % 10}`,
          amount: Math.random() * 1000,
          priority: i % 4, // Varies priority
        },
        new Date(Date.now() + i * 60000) // Spread over time
      );

      const result = await scheduler.scheduleEventWithQueueManagement(
        event,
        'order-processing'
      );

      scheduleResults.push(result);

      // Small delay to simulate realistic load
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(
      'Scheduled events:',
      scheduleResults.filter(r => r.isSuccess()).length
    );
    console.log(
      'Rejected events:',
      scheduleResults.filter(r => r.isFailure()).length
    );

    // Monitor metrics
    const monitorMetrics = async () => {
      const metrics = await scheduler.getEnhancedMetrics();

      console.log('📊 Enhanced Scheduler Metrics:', {
        scheduler: metrics.scheduler,
        queue: {
          totalEvents: metrics.queue.totalEvents,
          successRate: metrics.queue.successRate.toFixed(2) + '%',
          deadLetterQueueSize: metrics.queue.deadLetterQueueSize,
          backpressureActive: metrics.queue.backpressureActive,
          capacityUtilization:
            metrics.queue.queueCapacityUtilization.toFixed(1) + '%',
        },
        deadLetterQueue: metrics.deadLetterQueue,
        circuitBreakers: Object.fromEntries(metrics.queue.circuitBreakerStates),
      });
    };

    // Monitor every 30 seconds
    const metricsInterval = setInterval(monitorMetrics, 30000);

    // Initial metrics
    await monitorMetrics();

    // Simulate some failing events to test dead letter queue
    console.log(
      '\n🔧 Simulating failing events for dead letter queue testing...'
    );

    for (let i = 0; i < 5; i++) {
      const failingEvent = new FailingOrderEvent(
        `FAILING-ORDER-${i}`,
        { willFail: true },
        new Date(Date.now() + 5000) // 5 seconds from now
      );

      await scheduler.scheduleEventWithQueueManagement(
        failingEvent,
        'failing-queue'
      );
    }

    // Let it run for 2 minutes to see queue management in action
    await new Promise(resolve => setTimeout(resolve, 120000));

    // Process dead letter queue manually
    console.log('\n🔄 Processing dead letter queue manually...');
    const deadLetterResult = await scheduler.processDeadLetterQueueManually();
    console.log('Dead letter processing result:', deadLetterResult);

    clearInterval(metricsInterval);

    // Final metrics
    await monitorMetrics();
  } finally {
    await scheduler.stop();
  }
}

// Mock event classes for demonstration
class OrderProcessingEvent extends ScheduledEvent {
  constructor(orderId: string, orderData: any, scheduleAt: Date) {
    super(orderId, scheduleAt, orderData, {
      maxRetries: 3,
      backoff: 'exponential',
    });
  }
}

class FailingOrderEvent extends ScheduledEvent {
  constructor(orderId: string, orderData: any, scheduleAt: Date) {
    super(orderId, scheduleAt, orderData, {
      maxRetries: 2,
      backoff: 'fixed',
    });
  }
}

demonstrateAdvancedQueueManagement().catch(console.error);
```

## Key Features

- **Dead Letter Queue**: Automatic handling of permanently failed events with
  analysis and requeuing capabilities
- **Backpressure Management**: Multiple strategies for handling queue overflow
  (drop oldest, drop lowest priority, reject new, throttle)
- **Circuit Breakers**: Prevent cascade failures by temporarily stopping event
  processing when failure rates are high
- **Advanced Metrics**: Comprehensive monitoring of queue health, success rates,
  and capacity utilization
- **Error Classification**: Smart distinction between transient and permanent
  failures for appropriate handling
- **Automatic Recovery**: Dead letter queue processing with configurable retry
  strategies
- **Capacity Management**: Configurable queue limits with high/low watermarks
  for backpressure activation
- **Priority-Aware Dropping**: Intelligent event dropping based on priority
  levels during backpressure

## Common Pitfalls

- **Dead Letter Queue Buildup**: Monitor and periodically clean up dead letter
  queues to prevent unbounded growth
- **Circuit Breaker Tuning**: Carefully tune circuit breaker thresholds to
  balance fault tolerance and responsiveness
- **Backpressure Strategy**: Choose appropriate backpressure strategy based on
  business requirements
- **Memory Leaks**: Ensure proper cleanup of failed events and metrics data
- **Monitoring Overhead**: Balance comprehensive monitoring with system
  performance impact

## Related Examples

- [Basic Priority Queuing](../basic/example-3.md) - Foundation priority queue
  concepts
- [Distributed Scheduling](./example-1.md) - Multi-node coordination patterns
- [Enterprise Scheduling Platform](../advanced/example-1.md) - Global queue
  management
- [Performance Optimization](../advanced/example-3.md) - High-throughput queue
  optimization
