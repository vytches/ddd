import type {
  IScheduledJob,
  IJobFilter,
  IJobQueryResult,
  JobStatus,
} from './scheduled-event.interfaces';

/**
 * Storage interface for scheduled events
 * Implementations can use different backends (in-memory, database, etc.)
 */
export interface IScheduledEventStore {
  /**
   * Save a scheduled job
   * @param job The job to save
   */
  save(job: IScheduledJob): Promise<void>;

  /**
   * Update an existing job
   * @param job The job to update
   * @throws Error if job not found
   */
  update(job: IScheduledJob): Promise<void>;

  /**
   * Get a job by ID
   * @param jobId The job ID
   * @returns The job or undefined if not found
   */
  get(jobId: string): Promise<IScheduledJob | undefined>;

  /**
   * Delete a job
   * @param jobId The job ID to delete
   * @returns true if deleted, false if not found
   */
  delete(jobId: string): Promise<boolean>;

  /**
   * Query jobs based on filter criteria
   * @param filter Filter options
   * @returns Query result
   */
  query(filter?: IJobFilter): Promise<IJobQueryResult>;

  /**
   * Get jobs ready to be processed
   * @param limit Maximum number of jobs to return
   * @returns Array of jobs ready for processing
   */
  getReadyJobs(limit?: number): Promise<IScheduledJob[]>;

  /**
   * Update job status
   * @param jobId The job ID
   * @param status New status
   * @param error Optional error message if failed
   */
  updateStatus(jobId: string, status: JobStatus, error?: string): Promise<void>;

  /**
   * Clear all jobs (useful for testing)
   */
  clear(): Promise<void>;
}

/**
 * Transaction support for stores
 */
export interface ITransactionalScheduledEventStore extends IScheduledEventStore {
  /**
   * Begin a transaction
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit the current transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction
   */
  rollback(): Promise<void>;

  /**
   * Execute operations within a transaction
   */
  withTransaction<T>(operation: () => Promise<T>): Promise<T>;
}

/**
 * Metrics interface for monitoring
 */
export interface ISchedulerMetrics {
  /**
   * Get total number of jobs by status
   */
  getJobCountByStatus(): Promise<Record<JobStatus, number>>;

  /**
   * Get average processing time
   */
  getAverageProcessingTime(): Promise<number>;

  /**
   * Get failure rate
   */
  getFailureRate(): Promise<number>;

  /**
   * Get jobs processed in time range
   */
  getJobsProcessed(from: Date, to: Date): Promise<number>;
}
