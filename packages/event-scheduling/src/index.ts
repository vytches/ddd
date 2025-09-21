// Types and interfaces
export type * from './types/index';

// Core implementations
export { ScheduledEvent } from './core/ScheduledEvent';

// Adapters
export { BaseSchedulerAdapter } from './adapters/BaseSchedulerAdapter';
export { InMemorySchedulerAdapter } from './adapters/InMemorySchedulerAdapter';

// Re-export essential types from contracts for convenience
export type {
  IScheduledEvent,
  IEventScheduler,
  IScheduledJob,
  IScheduleOptions,
  IJobFilter,
  IJobQueryResult,
} from '@vytches/ddd-contracts';

export { SchedulePriority, BackoffStrategy, JobStatus } from '@vytches/ddd-contracts';

export {
  FailingScheduledEvent,
  SlowScheduledEvent,
  TestScheduledEvent,
  TestEventFactory,
} from './test-utils/TestScheduledEvent';
