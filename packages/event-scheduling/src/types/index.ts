// Re-export all scheduling types from contracts for convenience
export type {
  IScheduledEvent,
  IScheduleOptions,
  IRecurringPattern,
  IScheduledJob,
  IJobFilter,
  IJobQueryResult,
  IEventScheduler,
  ISchedulerLifecycle,
  ISchedulerConfig,
} from '@vytches-ddd/contracts';

export {
  SchedulePriority,
  BackoffStrategy,
  JobStatus,
} from '@vytches-ddd/contracts';

// Internal types
export interface ISchedulerAdapter {
  readonly type: string;
  readonly isRunning: boolean;
}
