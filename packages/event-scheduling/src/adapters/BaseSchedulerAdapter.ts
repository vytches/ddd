// import { Logger, type ILogger } from '@vytches/ddd-logging';

// Temporary mock logger for testing
interface ILogger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
}

class MockLogger implements ILogger {
  info(message: string, ...args: any[]): void {
    /* no-op */
  }
  error(message: string, ...args: any[]): void {
    /* no-op */
  }
  warn(message: string, ...args: any[]): void {
    /* no-op */
  }
  debug(message: string, ...args: any[]): void {
    /* no-op */
  }
}

const Logger = {
  forContext: () => new MockLogger(),
};
import type {
  IEventScheduler,
  IJobFilter,
  IJobQueryResult,
  IScheduledEvent,
  IScheduledJob,
  IScheduleOptions,
  ISchedulerConfig,
  ISchedulerLifecycle,
} from '@vytches/ddd-contracts';

import { JobStatus } from '@vytches/ddd-contracts';

export abstract class BaseSchedulerAdapter implements IEventScheduler {
  protected readonly logger: ILogger;
  protected readonly config: ISchedulerConfig;
  protected readonly lifecycle?: ISchedulerLifecycle | undefined;
  protected _isRunning = false;

  constructor(config: ISchedulerConfig = {}) {
    this.config = {
      concurrency: 10,
      defaultTimeout: 30000,
      defaultMaxRetries: 3,
      enablePersistence: true,
      ...config,
    };
    this.lifecycle = config.lifecycle;
    this.logger = Logger.forContext();
  }

  /**
   * Validate that an event can be scheduled
   */
  protected validateEvent(event: IScheduledEvent): void {
    if (!event) {
      throw new Error('Event is required');
    }

    if (!event.scheduleAt || !(event.scheduleAt instanceof Date)) {
      throw new Error('Valid scheduleAt date is required');
    }

    if (event.scheduleAt.getTime() < Date.now() - 60000) {
      // Allow 1 minute grace period for past dates
      throw new Error('Cannot schedule events in the past');
    }

    if (!event.type || typeof event.type !== 'string') {
      throw new Error('Event type is required');
    }

    if (!event.aggregateId || typeof event.aggregateId !== 'string') {
      throw new Error('Aggregate ID is required');
    }
  }

  /**
   * Generate a unique job ID
   */
  protected generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create a scheduled job from an event
   */
  protected createJob(event: IScheduledEvent, _options?: IScheduleOptions): IScheduledJob {
    const now = new Date();

    return {
      id: this.generateJobId(),
      event,
      status: JobStatus.PENDING,
      scheduledAt: event.scheduleAt,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
    };
  }

  /**
   * Serialize an event for storage
   */
  protected serializeEvent(event: IScheduledEvent): string {
    return JSON.stringify({
      type: event.type,
      aggregateId: event.aggregateId,
      occurredOn: event.occurredOn,
      metadata: event.metadata,
      scheduleAt: event.scheduleAt,
      scheduleOptions: event.scheduleOptions,
      payload: event,
    });
  }

  /**
   * Deserialize an event from storage
   */
  protected deserializeEvent(data: string): IScheduledEvent {
    const parsed = JSON.parse(data);
    parsed.scheduleAt = new Date(parsed.scheduleAt);
    parsed.occurredOn = new Date(parsed.occurredOn);
    return parsed.payload || parsed;
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      this.logger.warn('Scheduler is already running');
      return;
    }

    this.logger.info('Starting scheduler', {
      adapter: this.constructor.name,
      config: this.config,
    });

    await this.lifecycle?.onStart?.();
    await this.doStart();
    this._isRunning = true;

    this.logger.info('Scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      this.logger.warn('Scheduler is not running');
      return;
    }

    this.logger.info('Stopping scheduler');

    await this.doStop();
    await this.lifecycle?.onStop?.();
    this._isRunning = false;

    this.logger.info('Scheduler stopped successfully');
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Process lifecycle hooks for a job
   */
  protected async processJob(job: IScheduledJob): Promise<void> {
    try {
      await this.lifecycle?.onBeforeProcess?.(job);

      // Actual processing is handled by concrete implementations
      await this.doProcessJob(job);

      await this.lifecycle?.onAfterProcess?.(job);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await this.lifecycle?.onError?.(job, err);
      throw err;
    }
  }

  // Abstract methods to be implemented by concrete adapters
  abstract schedule(event: IScheduledEvent, options?: IScheduleOptions): Promise<string>;

  abstract cancel(jobId: string): Promise<void>;

  abstract reschedule(jobId: string, newTime: Date): Promise<void>;

  abstract getJob(jobId: string): Promise<IScheduledJob | undefined>;

  abstract listJobs(filter?: IJobFilter): Promise<IJobQueryResult>;

  protected abstract doStart(): Promise<void>;

  protected abstract doStop(): Promise<void>;

  protected abstract doProcessJob(job: IScheduledJob): Promise<void>;

  /**
   * Calculate retry delay based on attempt and strategy
   */
  protected calculateRetryDelay(
    attempt: number,
    strategy: 'fixed' | 'linear' | 'exponential',
    baseDelay = 1000
  ): number {
    const safeAttempt = Math.max(1, attempt);

    switch (strategy) {
      case 'fixed':
        return baseDelay;
      case 'linear':
        return baseDelay * safeAttempt;
      case 'exponential':
        return baseDelay * Math.pow(2, safeAttempt - 1);
      default:
        return baseDelay;
    }
  }

  /**
   * Check if an event should be retried
   */
  protected shouldRetry(event: IScheduledEvent, currentAttempt: number): boolean {
    const maxRetries = event.scheduleOptions?.maxRetries;
    if (!maxRetries || maxRetries <= 0) {
      return false;
    }
    return currentAttempt < maxRetries;
  }

  /**
   * Filter jobs based on filter criteria
   */
  protected filterJobs(jobs: IScheduledJob[], filter?: IJobFilter): IScheduledJob[] {
    if (!filter) {
      return jobs;
    }

    let filteredJobs = jobs;

    // Filter by status
    if (filter.status) {
      const statusFilter = Array.isArray(filter.status) ? filter.status : [filter.status];
      filteredJobs = filteredJobs.filter(job => statusFilter.includes(job.status));
    }

    // Filter by event type
    if (filter.eventType) {
      const eventTypeFilter = Array.isArray(filter.eventType)
        ? filter.eventType
        : [filter.eventType];
      filteredJobs = filteredJobs.filter(job => eventTypeFilter.includes(job.event.type));
    }

    // Filter by scheduled time range
    if (filter.scheduledAfter) {
      filteredJobs = filteredJobs.filter(job => job.scheduledAt >= filter.scheduledAfter!);
    }

    if (filter.scheduledBefore) {
      filteredJobs = filteredJobs.filter(job => job.scheduledAt <= filter.scheduledBefore!);
    }

    // Filter by creation time range
    if (filter.createdAfter) {
      filteredJobs = filteredJobs.filter(job => job.createdAt >= filter.createdAfter!);
    }

    if (filter.createdBefore) {
      filteredJobs = filteredJobs.filter(job => job.createdAt <= filter.createdBefore!);
    }

    return filteredJobs;
  }

  /**
   * Sort jobs by specified field and direction
   */
  protected sortJobs(
    jobs: IScheduledJob[],
    sortBy?: string,
    sortDirection?: 'asc' | 'desc'
  ): IScheduledJob[] {
    if (!sortBy) {
      return jobs;
    }

    const direction = sortDirection || 'asc';

    return jobs.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'scheduledAt':
          aValue = a.scheduledAt.getTime();
          bValue = b.scheduledAt.getTime();
          break;
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'updatedAt':
          aValue = a.updatedAt.getTime();
          bValue = b.updatedAt.getTime();
          break;
        default:
          return 0;
      }

      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }

  /**
   * Paginate jobs with limit and offset
   */
  protected paginateJobs(jobs: IScheduledJob[], limit?: number, offset?: number): IJobQueryResult {
    const actualOffset = offset || 0;
    const actualLimit = limit || jobs.length;

    const paginatedJobs = jobs.slice(actualOffset, actualOffset + actualLimit);

    return {
      jobs: paginatedJobs,
      total: jobs.length,
      count: paginatedJobs.length,
      offset: actualOffset,
    };
  }
}
