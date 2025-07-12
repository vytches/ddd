import type { IExtendedDomainEvent } from '../events/domain-event-interfaces';

/**
 * Priority levels for scheduled events
 */
export enum SchedulePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Backoff strategy for retry logic
 */
export enum BackoffStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
}

/**
 * Recurring pattern for scheduled events
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
 * Options for scheduling an event
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
 * A domain event that should be processed at a specific time
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
 * Job status in the scheduler
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
 * Represents a scheduled job in the system
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
 * Filter options for listing jobs
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
 * Result of a job query
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
