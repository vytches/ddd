import type { IScheduledEvent, IScheduleOptions, IScheduledJob, IJobFilter, IJobQueryResult } from './scheduled-event.interfaces';

/**
 * Core interface for event scheduling
 * This interface should be implemented by concrete scheduler adapters
 */
export interface IEventScheduler {
  /**
   * Schedule an event for future processing
   * @param event The event to schedule
   * @param options Additional scheduling options
   * @returns The job ID
   */
  schedule(event: IScheduledEvent, options?: IScheduleOptions): Promise<string>;

  /**
   * Cancel a scheduled job
   * @param jobId The job ID to cancel
   * @throws Error if job not found or already processed
   */
  cancel(jobId: string): Promise<void>;

  /**
   * Reschedule an existing job to a new time
   * @param jobId The job ID to reschedule
   * @param newTime The new scheduled time
   * @throws Error if job not found or already processed
   */
  reschedule(jobId: string, newTime: Date): Promise<void>;

  /**
   * Get details of a scheduled job
   * @param jobId The job ID
   * @returns The job details or undefined if not found
   */
  getJob(jobId: string): Promise<IScheduledJob | undefined>;

  /**
   * List scheduled jobs based on filter criteria
   * @param filter Filter options
   * @returns Query result with jobs and metadata
   */
  listJobs(filter?: IJobFilter): Promise<IJobQueryResult>;

  /**
   * Start the scheduler (if required by implementation)
   */
  start(): Promise<void>;

  /**
   * Stop the scheduler gracefully
   */
  stop(): Promise<void>;

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean;
}

/**
 * Extended scheduler interface with bulk operations
 */
export interface IBulkEventScheduler extends IEventScheduler {
  /**
   * Schedule multiple events at once
   * @param events Array of events to schedule
   * @returns Array of job IDs
   */
  scheduleBulk(events: IScheduledEvent[]): Promise<string[]>;

  /**
   * Cancel multiple jobs at once
   * @param jobIds Array of job IDs to cancel
   * @returns Number of jobs cancelled
   */
  cancelBulk(jobIds: string[]): Promise<number>;
}

/**
 * Scheduler lifecycle hooks
 */
export interface ISchedulerLifecycle {
  /**
   * Called when scheduler is starting
   */
  onStart?(): Promise<void>;

  /**
   * Called when scheduler is stopping
   */
  onStop?(): Promise<void>;

  /**
   * Called before a job is processed
   */
  onBeforeProcess?(job: IScheduledJob): Promise<void>;

  /**
   * Called after a job is processed successfully
   */
  onAfterProcess?(job: IScheduledJob): Promise<void>;

  /**
   * Called when a job fails
   */
  onError?(job: IScheduledJob, error: Error): Promise<void>;
}

/**
 * Configuration for scheduler adapters
 */
export interface ISchedulerConfig {
  /**
   * Maximum number of concurrent jobs to process
   */
  concurrency?: number;

  /**
   * Polling interval in milliseconds (for poll-based schedulers)
   */
  pollInterval?: number;

  /**
   * Default timeout for job processing in milliseconds
   */
  defaultTimeout?: number;

  /**
   * Default maximum retries
   */
  defaultMaxRetries?: number;

  /**
   * Enable job persistence
   */
  enablePersistence?: boolean;

  /**
   * Lifecycle hooks
   */
  lifecycle?: ISchedulerLifecycle;
}

/**
 * Factory for creating scheduler instances
 */
export interface ISchedulerFactory {
  /**
   * Create a scheduler instance with the given configuration
   */
  createScheduler(config?: ISchedulerConfig): IEventScheduler;
}
