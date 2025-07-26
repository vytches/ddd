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
} from '@vytches/ddd-contracts';

export { SchedulePriority, BackoffStrategy, JobStatus } from '@vytches/ddd-contracts';

// Internal types

/**
 * @llm-summary Contract for scheduler adapter functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * SchedulerAdapter interface implementing core domain functionality for scheduler adapter operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSchedulerAdapter implements ISchedulerAdapter {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ISchedulerAdapter {
  readonly type: string;
  readonly isRunning: boolean;
}
