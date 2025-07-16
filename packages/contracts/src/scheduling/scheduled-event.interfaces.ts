import type { IExtendedDomainEvent } from '../events/domain-event-interfaces';

/**
 * @llm-summary Enumeration of schedule priority values
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * SchedulePriority enum implementing core domain functionality for schedule priority operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: SchedulePriority = SchedulePriority.VALUE;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export enum SchedulePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * @llm-summary Enumeration of backoff strategy values
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * BackoffStrategy enum implementing core domain functionality for backoff strategy operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: BackoffStrategy = BackoffStrategy.VALUE;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export enum BackoffStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
}

/**
 * @llm-summary Contract for recurring pattern functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * RecurringPattern interface implementing core domain functionality for recurring pattern operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteRecurringPattern implements IRecurringPattern {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IRecurringPattern {
  /**
   * Cron expression for recurring schedule
   */
  cron?: string;

  /**
   * Interval in milliseconds
   */
  interval?: number;

  /**
   * Maximum number of occurrences
   */
  maxOccurrences?: number;

  /**
   * End date for recurring schedule
   */
  endDate?: Date;
}

/**
 * @llm-summary Contract for schedule options functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ScheduleOptions interface implementing core domain functionality for schedule options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteScheduleOptions implements IScheduleOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IScheduleOptions {
  /**
   * Priority level for the scheduled event
   */
  priority?: SchedulePriority;

  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;

  /**
   * Backoff strategy for retries
   */
  backoff?: BackoffStrategy;

  /**
   * Ensure only one instance of this event is scheduled
   */
  unique?: boolean;

  /**
   * Unique key for deduplication
   */
  uniqueKey?: string;

  /**
   * Recurring pattern configuration
   */
  recurring?: IRecurringPattern;

  /**
   * Timeout in milliseconds for event processing
   */
  timeout?: number;

  /**
   * Additional metadata for the scheduler
   */
  metadata?: Record<string, unknown>;
}

/**
 * @llm-summary Contract for scheduled event functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ScheduledEvent interface implementing core domain functionality for scheduled event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteScheduledEvent implements IScheduledEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IScheduledEvent extends IExtendedDomainEvent {
  /**
   * When the event should be processed
   */
  scheduleAt: Date;

  /**
   * Scheduling options
   */
  scheduleOptions?: IScheduleOptions | undefined;

  /**
   * Aggregate ID for the event
   */
  aggregateId: string;

  /**
   * Type of the event
   */
  type: string;

  /**
   * When the event originally occurred
   */
  occurredOn: Date;
}

/**
 * @llm-summary Enumeration of job status values
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * JobStatus enum implementing core domain functionality for job status operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: JobStatus = JobStatus.VALUE;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export enum JobStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/**
 * @llm-summary Contract for scheduled job functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * ScheduledJob interface implementing core domain functionality for scheduled job operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteScheduledJob implements IScheduledJob {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IScheduledJob {
  /**
   * Unique identifier for the job
   */
  id: string;

  /**
   * The scheduled event
   */
  event: IScheduledEvent;

  /**
   * Current status of the job
   */
  status: JobStatus;

  /**
   * When the job is scheduled to run
   */
  scheduledAt: Date;

  /**
   * When the job was created
   */
  createdAt: Date;

  /**
   * When the job was last updated
   */
  updatedAt: Date;

  /**
   * When the job started processing
   */
  startedAt?: Date | undefined;

  /**
   * When the job completed
   */
  completedAt?: Date | undefined;

  /**
   * Number of attempts made
   */
  attempts: number;

  /**
   * Last error if job failed
   */
  lastError?: string | undefined;

  /**
   * Next retry time if applicable
   */
  nextRetryAt?: Date | undefined;
}

/**
 * @llm-summary Contract for job filter functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * JobFilter interface implementing core domain functionality for job filter operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteJobFilter implements IJobFilter {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IJobFilter {
  /**
   * Filter by job status
   */
  status?: JobStatus | JobStatus[] | undefined;

  /**
   * Filter by event type
   */
  eventType?: string | string[];

  /**
   * Filter by scheduled time range
   */
  scheduledAfter?: Date | undefined;
  scheduledBefore?: Date | undefined;

  /**
   * Filter by creation time range
   */
  createdAfter?: Date | undefined;
  createdBefore?: Date | undefined;

  /**
   * Maximum number of jobs to return
   */
  limit?: number | undefined;

  /**
   * Offset for pagination
   */
  offset?: number | undefined;

  /**
   * Sort field
   */
  sortBy?: 'scheduledAt' | 'createdAt' | 'updatedAt' | undefined;

  /**
   * Sort direction
   */
  sortDirection?: 'asc' | 'desc' | undefined;
}

/**
 * @llm-summary Contract for job query result functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * JobQueryResult interface implementing core domain functionality for job query result operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteJobQueryResult implements IJobQueryResult {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IJobQueryResult {
  /**
   * List of jobs matching the filter
   */
  jobs: IScheduledJob[];

  /**
   * Total number of jobs matching the filter
   */
  total: number;

  /**
   * Number of jobs returned
   */
  count: number;

  /**
   * Offset used
   */
  offset: number;
}
