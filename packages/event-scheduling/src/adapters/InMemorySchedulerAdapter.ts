import { BaseSchedulerAdapter } from './BaseSchedulerAdapter';
import type {
  IScheduledEvent,
  IScheduleOptions,
  IScheduledJob,
  IJobFilter,
  IJobQueryResult,
  ISchedulerConfig,
} from '@vytches-ddd/contracts';

import { JobStatus } from '@vytches-ddd/contracts';

/**
 * In-memory scheduler adapter for development and testing
 * Stores all scheduled jobs in memory and processes them using timers
 */
export class InMemorySchedulerAdapter extends BaseSchedulerAdapter {
  private jobs: Map<string, IScheduledJob> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private processing: Set<string> = new Set();

  constructor(config?: ISchedulerConfig) {
    super(config);
  }

  /**
   * Schedule an event
   */
  async schedule(event: IScheduledEvent, options?: IScheduleOptions): Promise<string> {
    this.validateEvent(event);

    const job = this.createJob(event, options);
    this.jobs.set(job.id, job);

    if (this._isRunning) {
      this.scheduleTimer(job);
    }

    this.logger.info('Event scheduled', {
      jobId: job.id,
      eventType: event.type,
      scheduledAt: event.scheduleAt,
      delay: event.scheduleAt.getTime() - Date.now(),
    });

    return job.id;
  }

  /**
   * Cancel a scheduled job
   */
  async cancel(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    // Clear timer if exists
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }

    // Update job status
    job.status = JobStatus.CANCELLED;
    job.updatedAt = new Date();

    this.logger.info('Job cancelled', { jobId });
  }

  /**
   * Reschedule a job to a new time
   */
  async reschedule(jobId: string, newTime: Date): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
      throw new Error(`Cannot reschedule job in ${job.status} status`);
    }

    // Clear existing timer
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }

    // Update job
    job.scheduledAt = newTime;
    job.updatedAt = new Date();
    job.event.scheduleAt = newTime;

    // Reschedule if running
    if (this._isRunning && job.status === JobStatus.SCHEDULED) {
      this.scheduleTimer(job);
    }

    this.logger.info('Job rescheduled', {
      jobId,
      newTime,
      delay: newTime.getTime() - Date.now(),
    });
  }

  /**
   * Get a job by ID
   */
  async getJob(jobId: string): Promise<IScheduledJob | undefined> {
    return this.jobs.get(jobId);
  }

  /**
   * List jobs based on filter
   */
  async listJobs(filter?: IJobFilter): Promise<IJobQueryResult> {
    let jobs = Array.from(this.jobs.values());

    // Apply filters
    if (filter) {
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        jobs = jobs.filter(job => statuses.includes(job.status));
      }

      if (filter.eventType) {
        const types = Array.isArray(filter.eventType) ? filter.eventType : [filter.eventType];
        jobs = jobs.filter(job => types.includes(job.event.type));
      }

      if (filter.scheduledAfter) {
        jobs = jobs.filter(job => job.scheduledAt >= filter.scheduledAfter!);
      }

      if (filter.scheduledBefore) {
        jobs = jobs.filter(job => job.scheduledAt <= filter.scheduledBefore!);
      }

      if (filter.createdAfter) {
        jobs = jobs.filter(job => job.createdAt >= filter.createdAfter!);
      }

      if (filter.createdBefore) {
        jobs = jobs.filter(job => job.createdAt <= filter.createdBefore!);
      }
    }

    // Sort
    const sortBy = filter?.sortBy || 'scheduledAt';
    const sortDirection = filter?.sortDirection || 'asc';
    jobs.sort((a, b) => {
      const aValue = a[sortBy].getTime();
      const bValue = b[sortBy].getTime();
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    // Paginate
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 100;
    const paginatedJobs = jobs.slice(offset, offset + limit);

    return {
      jobs: paginatedJobs,
      total: jobs.length,
      count: paginatedJobs.length,
      offset,
    };
  }

  /**
   * Clear all jobs (useful for testing)
   */
  async clear(): Promise<void> {
    // Cancel all timers
    Array.from(this.timers.values()).forEach(timer => {
      clearTimeout(timer);
    });

    this.jobs.clear();
    this.timers.clear();
    this.processing.clear();

    this.logger.info('All jobs cleared');
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<Record<JobStatus, number>> {
    const stats: Record<JobStatus, number> = {
      pending: 0,
      scheduled: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      expired: 0,
    };

    Array.from(this.jobs.values()).forEach(job => {
      stats[job.status]++;
    });

    return stats;
  }

  protected async doStart(): Promise<void> {
    // Schedule timers for all pending jobs
    Array.from(this.jobs.values()).forEach(job => {
      if (job.status === JobStatus.PENDING || job.status === JobStatus.SCHEDULED) {
        this.scheduleTimer(job);
      }
    });
  }

  protected async doStop(): Promise<void> {
    // Clear all timers
    Array.from(this.timers.values()).forEach(timer => {
      clearTimeout(timer);
    });
    this.timers.clear();

    // Wait for processing jobs to complete
    const timeout = this.config.defaultTimeout || 30000;
    const start = Date.now();

    while (this.processing.size > 0 && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.processing.size > 0) {
      this.logger.warn('Some jobs are still processing after timeout', {
        count: this.processing.size,
      });
    }
  }

  protected async doProcessJob(job: IScheduledJob): Promise<void> {
    // This is the actual processing logic for the job
    // This method is called by processJob in the base class after lifecycle hooks
    // For InMemorySchedulerAdapter, we don't need to do anything here
    // The lifecycle hooks handle the actual processing
    // This is just a placeholder for the abstract method
  }

  private scheduleTimer(job: IScheduledJob): void {
    const delay = Math.max(0, job.scheduledAt.getTime() - Date.now());

    job.status = JobStatus.SCHEDULED;
    job.updatedAt = new Date();

    const timer = setTimeout(async () => {
      this.timers.delete(job.id);
      await this.executeJob(job);
    }, delay);

    this.timers.set(job.id, timer);
  }

  private async executeJob(job: IScheduledJob): Promise<void> {
    if (this.processing.has(job.id)) {
      return;
    }

    this.processing.add(job.id);
    job.status = JobStatus.RUNNING;
    job.startedAt = new Date();
    job.updatedAt = new Date();
    job.attempts++;

    try {
      // Call the base class processJob which handles lifecycle hooks
      await this.processJob(job);

      job.status = JobStatus.COMPLETED;
      job.completedAt = new Date();
      job.updatedAt = new Date();

      this.logger.info('Job completed successfully', {
        jobId: job.id,
        eventType: job.event.type,
        attempts: job.attempts,
      });
    } catch (error) {
      const maxRetries =
        job.event.scheduleOptions?.maxRetries || this.config.defaultMaxRetries || 3;

      job.lastError = error instanceof Error ? error.message : String(error);
      job.updatedAt = new Date();

      if (job.attempts < maxRetries) {
        // Schedule retry
        const backoff = this.calculateBackoff(job);
        job.nextRetryAt = new Date(Date.now() + backoff);
        job.scheduledAt = job.nextRetryAt;
        job.status = JobStatus.SCHEDULED;

        this.scheduleTimer(job);

        this.logger.warn('Job failed, scheduling retry', {
          jobId: job.id,
          attempt: job.attempts,
          nextRetry: job.nextRetryAt,
          error: job.lastError,
        });
      } else {
        job.status = JobStatus.FAILED;
        job.completedAt = new Date();

        this.logger.error('Job failed after max retries', {
          jobId: job.id,
          attempts: job.attempts,
          error: job.lastError,
        });
      }
    } finally {
      this.processing.delete(job.id);
    }
  }

  private calculateBackoff(job: IScheduledJob): number {
    const strategy = job.event.scheduleOptions?.backoff || 'exponential';
    const attempt = job.attempts;
    const baseDelay = 1000; // 1 second

    switch (strategy) {
      case 'fixed':
        return baseDelay;
      case 'linear':
        return baseDelay * attempt;
      case 'exponential':
        return baseDelay * Math.pow(2, attempt - 1);
      default:
        return baseDelay;
    }
  }
}
