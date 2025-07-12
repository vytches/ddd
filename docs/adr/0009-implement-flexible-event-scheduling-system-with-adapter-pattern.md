# ADR-0009. Implement Flexible Event Scheduling System with Adapter Pattern

Date: 2025-07-09

## Status

2025-07-09 proposed

## Context

The VytchesDDD framework currently lacks event scheduling capabilities, which
are essential for enterprise applications. Common use cases include:

- Delayed event processing (e.g., send reminder after 24 hours)
- Scheduled recurring events (e.g., daily aggregation tasks)
- Time-based saga orchestration (e.g., timeout handling)
- Deferred integration events (e.g., batch processing at specific times)

Currently, the UnifiedEventBus publishes events immediately with no built-in
mechanism for scheduling or delaying event processing. While the messaging
package has an outbox pattern with `processAfter` support, this is limited to
message delivery and not integrated with the event system.

### Requirements

1. **Flexibility**: Support multiple scheduling backends (pg-boss, BullMQ,
   bee-queue, etc.)
2. **Testability**: Provide in-memory scheduler for development and testing
3. **Type Safety**: Full TypeScript support with compile-time guarantees
4. **Integration**: Seamless integration with existing UnifiedEventBus
5. **Framework Agnostic**: Core interfaces should not depend on specific
   implementations
6. **Performance**: Minimal overhead for immediate events
7. **Reliability**: Support for job persistence, retries, and failure handling

### Current State Analysis

Strengths:

- UnifiedEventBus already supports metadata for extensibility
- Middleware pipeline can intercept events for scheduling
- DI system provides excellent adapter pattern example
- Outbox pattern demonstrates delayed processing concepts

Gaps:

- No scheduling interfaces or contracts
- No persistence layer for scheduled events
- No time-based event processing
- No job management capabilities

## Decision

We will implement a flexible event scheduling system using the adapter pattern,
following the same principles as our successful DI system implementation.

### Architecture

```typescript
// Core scheduling interfaces in @vytches-ddd/contracts
interface IEventScheduler {
  schedule(event: IScheduledEvent, options?: IScheduleOptions): Promise<string>;
  cancel(jobId: string): Promise<void>;
  reschedule(jobId: string, newTime: Date): Promise<void>;
  getJob(jobId: string): Promise<IScheduledJob | undefined>;
  listJobs(filter?: IJobFilter): Promise<IScheduledJob[]>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface IScheduledEvent extends IDomainEvent {
  scheduleAt: Date;
  scheduleOptions?: {
    priority?: SchedulePriority;
    maxRetries?: number;
    backoff?: BackoffStrategy;
    unique?: boolean;
    recurring?: RecurringPattern;
  };
}

// Event scheduling package structure
@vytches-ddd/event-scheduling/
├── src/
│   ├── core/
│   │   ├── EventScheduler.ts           // Main scheduler facade
│   │   ├── ScheduledEvent.ts           // Scheduled event implementation
│   │   └── SchedulingMiddleware.ts     // UnifiedEventBus integration
│   ├── adapters/
│   │   ├── BaseSchedulerAdapter.ts     // Abstract base adapter
│   │   ├── InMemorySchedulerAdapter.ts // For testing
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts                    // All type definitions
│   └── index.ts
```

### Integration with UnifiedEventBus

```typescript
// Seamless integration via middleware
class SchedulingMiddleware implements IEventMiddleware {
  constructor(private scheduler: IEventScheduler) {}

  async execute(event: IDomainEvent, next: Next): Promise<void> {
    if (isScheduledEvent(event)) {
      const jobId = await this.scheduler.schedule(event);
      event.metadata.scheduledJobId = jobId;
      return; // Don't process immediately
    }
    return next();
  }
}

// Usage example
const scheduler = new EventScheduler(new PgBossAdapter(pgBoss));
eventBus.use(new SchedulingMiddleware(scheduler));

// Schedule an event
const event = new OrderReminderEvent(orderId);
event.scheduleAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
await eventBus.publish(event);
```

### Adapter Examples

```typescript
// PG-Boss Adapter
class PgBossAdapter extends BaseSchedulerAdapter {
  constructor(private pgBoss: PgBoss) {
    super();
  }

  async schedule(
    event: IScheduledEvent,
    options?: IScheduleOptions
  ): Promise<string> {
    const jobOptions = {
      startAfter: event.scheduleAt,
      priority: options?.priority || 0,
      retryLimit: options?.maxRetries || 3,
      retryBackoff: options?.backoff === 'exponential',
    };

    return await this.pgBoss.send(
      `event:${event.type}`,
      { event: this.serializeEvent(event) },
      jobOptions
    );
  }
}

// BullMQ Adapter
class BullMQAdapter extends BaseSchedulerAdapter {
  constructor(private queue: Queue) {
    super();
  }

  async schedule(
    event: IScheduledEvent,
    options?: IScheduleOptions
  ): Promise<string> {
    const job = await this.queue.add(
      event.type,
      { event: this.serializeEvent(event) },
      {
        delay: event.scheduleAt.getTime() - Date.now(),
        priority: options?.priority,
        attempts: options?.maxRetries || 3,
        backoff: options?.backoff,
      }
    );
    return job.id;
  }
}
```

### Global Configuration

```typescript
// Similar to VytchesDDD.configure()
class EventScheduling {
  private static scheduler: IEventScheduler;

  static configure(scheduler: IEventScheduler): void {
    this.scheduler = scheduler;

    // Auto-register with UnifiedEventBus if available
    const eventBus = VytchesDDD.resolve<UnifiedEventBus>('UnifiedEventBus');
    if (eventBus) {
      eventBus.use(new SchedulingMiddleware(this.scheduler));
    }
  }

  static getScheduler(): IEventScheduler {
    if (!this.scheduler) {
      throw new Error('Event scheduler not configured');
    }
    return this.scheduler;
  }
}
```

## Consequences

### Positive

1. **Flexibility**: Easy to integrate any job queue library (pg-boss, BullMQ,
   etc.)
2. **Testability**: In-memory adapter enables fast, reliable tests
3. **Type Safety**: Full TypeScript support with compile-time checks
4. **Minimal Breaking Changes**: Extends existing event system without
   modifications
5. **Enterprise Ready**: Supports advanced patterns like recurring events,
   priorities, retries
6. **Framework Agnostic**: Can work with any DI container and event bus
7. **Performance**: Zero overhead for immediate events (middleware
   short-circuits)

### Negative

1. **Additional Dependency**: Requires external scheduler for production use
2. **Complexity**: Adds another layer to the event processing pipeline
3. **Configuration**: Requires explicit scheduler configuration
4. **Learning Curve**: Developers need to understand scheduling concepts

### Neutral

1. **New Package**: Creates @vytches-ddd/event-scheduling package
2. **Documentation**: Requires comprehensive docs and examples
3. **Migration Path**: Existing code continues to work unchanged

## Implementation Plan

### Phase 1: Core Implementation (Week 1)

- Create event-scheduling package structure
- Implement core interfaces in contracts
- Build BaseSchedulerAdapter
- Create InMemorySchedulerAdapter
- Add SchedulingMiddleware

### Phase 2: Adapter Implementation (Week 2)

- Implement PgBossAdapter
- Implement BullMQAdapter
- Create adapter examples
- Add comprehensive tests

### Phase 3: Integration & Polish (Week 3)

- Integrate with UnifiedEventBus
- Add recurring event support
- Create documentation
- Add example applications

## References

- DI Adapter Pattern: `packages/di/src/adapters/`
- Outbox Pattern: `packages/messaging/src/outbox/`
- UnifiedEventBus: `packages/events/src/unified/`
- Industry Examples: Axon Framework, MassTransit, NServiceBus
