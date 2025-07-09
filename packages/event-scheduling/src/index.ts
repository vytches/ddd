// Types and interfaces
export type * from './types/index.js';

// Core implementations
export { ScheduledEvent } from './core/ScheduledEvent.js';

// Adapters
export { BaseSchedulerAdapter } from './adapters/BaseSchedulerAdapter.js';
export { InMemorySchedulerAdapter } from './adapters/InMemorySchedulerAdapter.js';

// Re-export essential types from contracts for convenience
export type {
  IScheduledEvent,
  IEventScheduler,
  IScheduledJob,
  IScheduleOptions,
  IJobFilter,
  IJobQueryResult,
} from '@vytches-ddd/contracts';

export {
  SchedulePriority,
  BackoffStrategy,
  JobStatus,
} from '@vytches-ddd/contracts';
