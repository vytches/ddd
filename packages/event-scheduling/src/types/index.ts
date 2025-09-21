// Re-export all scheduling types from contracts for convenience
export type {
  IEventScheduler,
  IJobFilter,
  IJobQueryResult,
  IRecurringPattern,
  IScheduledEvent,
  IScheduledJob,
  IScheduleOptions,
  ISchedulerConfig,
  ISchedulerLifecycle,
} from '@vytches/ddd-contracts';

export { BackoffStrategy, JobStatus, SchedulePriority } from '@vytches/ddd-contracts';

export interface ISchedulerAdapter {
  readonly type: string;
  readonly isRunning: boolean;
}
