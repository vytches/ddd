import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestScheduledEvent, TestEventFactory, BaseSchedulerAdapter } from '../../src';
import { JobStatus, BackoffStrategy } from '@vytches-ddd/contracts';
import type { IScheduledEvent, IScheduledJob, IJobQueryResult, IJobFilter, IScheduleOptions } from '@vytches-ddd/contracts';

// Create a concrete implementation for testing
class TestSchedulerAdapter extends BaseSchedulerAdapter {
  protected override _isRunning = false;
  private mockJobs: Map<string, IScheduledJob> = new Map();
  private jobIdCounter = 0;

  override isRunning(): boolean {
    return this._isRunning;
  }

  override async schedule(event: IScheduledEvent, _options?: IScheduleOptions): Promise<string> {
    const jobId = `test-job-${++this.jobIdCounter}`;
    const job = this.createJob(event);
    job.id = jobId; // Set the job ID to match what we're returning
    this.mockJobs.set(jobId, job);
    return jobId;
  }

  override async cancel(jobId: string): Promise<void> {
    const job = this.mockJobs.get(jobId);
    if (job && job.status === JobStatus.SCHEDULED) {
      job.status = JobStatus.CANCELLED;
      job.updatedAt = new Date();
    }
  }

  override async reschedule(jobId: string, newTime: Date): Promise<void> {
    const job = this.mockJobs.get(jobId);
    if (job) {
      job.scheduledAt = newTime;
      job.updatedAt = new Date();
    }
  }

  override async getJob(jobId: string): Promise<IScheduledJob | undefined> {
    return this.mockJobs.get(jobId);
  }

  override async listJobs(filter?: IJobFilter): Promise<IJobQueryResult> {
    let jobs = Array.from(this.mockJobs.values());

    // Apply filters using base class methods
    jobs = this.filterJobs(jobs, filter);
    jobs = this.sortJobs(jobs, filter?.sortBy, filter?.sortDirection);

    const result = this.paginateJobs(jobs, filter?.limit, filter?.offset);
    return result;
  }

  protected override async doStart(): Promise<void> {
    this._isRunning = true;
  }

  protected override async doStop(): Promise<void> {
    this._isRunning = false;
    this.mockJobs.clear();
  }

  protected override async doProcessJob(job: IScheduledJob): Promise<void> {
    // Mock processing - mark as completed
    job.status = JobStatus.COMPLETED;
    job.completedAt = new Date();
    job.attempts = 1;
    job.updatedAt = new Date();
  }

  // Helper methods for testing
  public createJobPublic(event: IScheduledEvent, _options?: IScheduleOptions): IScheduledJob {
    return this.createJob(event);
  }

  public generateJobIdPublic(): string {
    return this.generateJobId();
  }

  public calculateRetryDelayPublic(attempt: number, strategy: 'fixed' | 'linear' | 'exponential', baseDelay?: number): number {
    return this.calculateRetryDelay(attempt, strategy, baseDelay);
  }

  public shouldRetryPublic(event: IScheduledEvent, currentAttempt: number): boolean {
    return this.shouldRetry(event, currentAttempt);
  }

  public filterJobsPublic(jobs: IScheduledJob[], filter?: IJobFilter): IScheduledJob[] {
    return this.filterJobs(jobs, filter);
  }

  public sortJobsPublic(jobs: IScheduledJob[], sortBy?: string, sortDirection?: 'asc' | 'desc'): IScheduledJob[] {
    return this.sortJobs(jobs, sortBy, sortDirection);
  }

  public paginateJobsPublic(jobs: IScheduledJob[], limit?: number, offset?: number): IJobQueryResult {
    return this.paginateJobs(jobs, limit, offset);
  }

  // Helper method to simulate job completion
  completeJob(jobId: string): void {
    const job = this.mockJobs.get(jobId);
    if (job) {
      job.status = JobStatus.COMPLETED;
      job.completedAt = new Date();
      job.attempts = 1;
      job.updatedAt = new Date();
    }
  }

  // Helper method to simulate job failure
  failJob(jobId: string, error: string): void {
    const job = this.mockJobs.get(jobId);
    if (job) {
      job.status = JobStatus.FAILED;
      job.lastError = error;
      job.attempts = 1;
      job.updatedAt = new Date();
    }
  }
}

describe('BaseSchedulerAdapter', () => {
  let adapter: TestSchedulerAdapter;

  beforeEach(() => {
    adapter = new TestSchedulerAdapter();
  });

  describe('abstract properties and methods', () => {
    it('should have required abstract properties implemented', () => {
      expect(adapter.constructor.name).toBe('TestSchedulerAdapter');
      expect(typeof adapter.isRunning()).toBe('boolean');
    });

    it('should implement all required abstract methods', () => {
      expect(typeof adapter.start).toBe('function');
      expect(typeof adapter.stop).toBe('function');
      expect(typeof adapter.schedule).toBe('function');
      expect(typeof adapter.cancel).toBe('function');
      expect(typeof adapter.reschedule).toBe('function');
      expect(typeof adapter.getJob).toBe('function');
      expect(typeof adapter.listJobs).toBe('function');
    });
  });

  describe('utility methods', () => {
    describe('generateJobId', () => {
      it('should generate unique job IDs', () => {
        const id1 = adapter.generateJobIdPublic();
        const id2 = adapter.generateJobIdPublic();

        expect(id1).toBeTruthy();
        expect(id2).toBeTruthy();
        expect(id1).not.toBe(id2);
        expect(typeof id1).toBe('string');
        expect(typeof id2).toBe('string');
      });

      it('should generate IDs with proper format', () => {
        const id = adapter.generateJobIdPublic();

        // Should contain job prefix and timestamp
        expect(id).toMatch(/^job-\d+-[a-z0-9]+$/);
      });
    });

    describe('calculateRetryDelay', () => {
      it('should calculate fixed backoff delay', () => {
        const delay = adapter.calculateRetryDelayPublic(1, 'fixed');

        expect(delay).toBe(1000); // Default base delay
      });

      it('should calculate linear backoff delay', () => {
        const delay1 = adapter.calculateRetryDelayPublic(1, 'linear');
        const delay2 = adapter.calculateRetryDelayPublic(2, 'linear');
        const delay3 = adapter.calculateRetryDelayPublic(3, 'linear');

        expect(delay1).toBe(1000);
        expect(delay2).toBe(2000);
        expect(delay3).toBe(3000);
      });

      it('should calculate exponential backoff delay', () => {
        const delay1 = adapter.calculateRetryDelayPublic(1, 'exponential');
        const delay2 = adapter.calculateRetryDelayPublic(2, 'exponential');
        const delay3 = adapter.calculateRetryDelayPublic(3, 'exponential');

        expect(delay1).toBe(1000);
        expect(delay2).toBe(2000);
        expect(delay3).toBe(4000);
      });

      it('should respect custom base delay', () => {
        const baseDelay = 500;
        const delay = adapter.calculateRetryDelayPublic(1, 'fixed', baseDelay);

        expect(delay).toBe(baseDelay);
      });

      it('should handle zero attempt gracefully', () => {
        const delay = adapter.calculateRetryDelayPublic(0, 'exponential');

        expect(delay).toBe(1000); // Should default to base delay
      });

      it('should handle negative attempt gracefully', () => {
        const delay = adapter.calculateRetryDelayPublic(-1, 'exponential');

        expect(delay).toBe(1000); // Should default to base delay
      });
    });

    describe('shouldRetry', () => {
      it('should return true when retries are available', () => {
        const event = TestEventFactory.withRetry('test-123', 3, BackoffStrategy.EXPONENTIAL);

        expect(adapter.shouldRetryPublic(event, 0)).toBe(true);
        expect(adapter.shouldRetryPublic(event, 1)).toBe(true);
        expect(adapter.shouldRetryPublic(event, 2)).toBe(true);
      });

      it('should return false when max retries reached', () => {
        const event = TestEventFactory.withRetry('test-123', 3, BackoffStrategy.EXPONENTIAL);

        expect(adapter.shouldRetryPublic(event, 3)).toBe(false);
        expect(adapter.shouldRetryPublic(event, 4)).toBe(false);
      });

      it('should return false when no retry options', () => {
        const event = TestEventFactory.immediate();

        expect(adapter.shouldRetryPublic(event, 0)).toBe(false);
        expect(adapter.shouldRetryPublic(event, 1)).toBe(false);
      });

      it('should return false when maxRetries is 0', () => {
        const event = TestEventFactory.withRetry('test-123', 0, BackoffStrategy.EXPONENTIAL);

        expect(adapter.shouldRetryPublic(event, 0)).toBe(false);
      });

      it('should return false when maxRetries is negative', () => {
        const event = new TestScheduledEvent(
          'test-123',
          new Date(),
          'Test',
          { maxRetries: -1, backoff: BackoffStrategy.EXPONENTIAL }
        );

        expect(adapter.shouldRetryPublic(event, 0)).toBe(false);
      });
    });

    describe('createJob', () => {
      it('should create a job with correct properties', () => {
        const event = TestEventFactory.immediate();

        const job = adapter.createJobPublic(event);

        expect(job.id).toBeDefined();
        expect(job.event).toBe(event);
        expect(job.status).toBe(JobStatus.PENDING);
        expect(job.scheduledAt).toBe(event.scheduleAt);
        expect(job.createdAt).toBeInstanceOf(Date);
        expect(job.updatedAt).toBeInstanceOf(Date);
        expect(job.attempts).toBe(0);
        expect(job.startedAt).toBeUndefined();
        expect(job.completedAt).toBeUndefined();
        expect(job.lastError).toBeUndefined();
        expect(job.nextRetryAt).toBeUndefined();
      });

      it('should create jobs with different scheduleAt times', () => {
        const scheduleAt = new Date(Date.now() + 5000);
        const event = new TestScheduledEvent('test-123', scheduleAt, 'Test');

        const job = adapter.createJobPublic(event);

        expect(job.scheduledAt).toBe(scheduleAt);
      });
    });

    describe('filterJobs', () => {
      let jobs: IScheduledJob[];

      beforeEach(() => {
        const event1 = TestEventFactory.immediate();
        const event2 = TestEventFactory.delayed(1000);
        const event3 = new TestScheduledEvent('test-123', new Date(), 'Test');

        jobs = [
          adapter.createJobPublic(event1),
          adapter.createJobPublic(event2),
          adapter.createJobPublic(event3)
        ];

        // Simulate different statuses
        if (jobs[0]) jobs[0].status = JobStatus.COMPLETED;
        if (jobs[1]) jobs[1].status = JobStatus.SCHEDULED;
        if (jobs[2]) jobs[2].status = JobStatus.FAILED;
      });

      it('should filter by single status', () => {
        const filter: IJobFilter = { status: JobStatus.COMPLETED };
        const filtered = adapter.filterJobsPublic(jobs, filter);

        expect(filtered).toHaveLength(1);
        expect(filtered?.[0]?.status).toBe(JobStatus.COMPLETED);
      });

      it('should filter by multiple statuses', () => {
        const filter: IJobFilter = { status: [JobStatus.COMPLETED, JobStatus.SCHEDULED] };
        const filtered = adapter.filterJobsPublic(jobs, filter);

        expect(filtered).toHaveLength(2);
        expect(filtered.map(j => j.status)).toEqual([JobStatus.COMPLETED, JobStatus.SCHEDULED]);
      });

      it('should filter by event type', () => {
        const filter: IJobFilter = { eventType: 'TestScheduledEvent' };
        const filtered = adapter.filterJobsPublic(jobs, filter);

        expect(filtered).toHaveLength(3); // All events are TestScheduledEvent
      });

      it('should filter by multiple event types', () => {
        const filter: IJobFilter = { eventType: ['TestScheduledEvent', 'NonExistentEvent'] };
        const filtered = adapter.filterJobsPublic(jobs, filter);

        expect(filtered).toHaveLength(3); // Only TestScheduledEvent exists
      });

      it('should filter by scheduled time range', () => {
        const now = new Date();
        const filter: IJobFilter = {
          scheduledAfter: new Date(now.getTime() - 1000),
          scheduledBefore: new Date(now.getTime() + 2000)
        };
        const filtered = adapter.filterJobsPublic(jobs, filter);

        expect(filtered.length).toBeGreaterThan(0);
      });

      it('should return all jobs when no filter', () => {
        const filtered = adapter.filterJobsPublic(jobs);

        expect(filtered).toHaveLength(3);
        expect(filtered).toEqual(jobs);
      });

      it('should return empty array when no jobs match filter', () => {
        const filter: IJobFilter = { status: JobStatus.RUNNING };
        const filtered = adapter.filterJobsPublic(jobs, filter);

        expect(filtered).toHaveLength(0);
      });
    });

    describe('sortJobs', () => {
      let jobs: IScheduledJob[];

      beforeEach(() => {
        const now = new Date();
        const event1 = new TestScheduledEvent('test-1', new Date(now.getTime() + 1000), 'Test 1');
        const event2 = new TestScheduledEvent('test-2', new Date(now.getTime() + 2000), 'Test 2');
        const event3 = new TestScheduledEvent('test-3', new Date(now.getTime() + 3000), 'Test 3');

        jobs = [
          adapter.createJobPublic(event1),
          adapter.createJobPublic(event2),
          adapter.createJobPublic(event3)
        ];

        // Set different timestamps
        if (jobs[0]) jobs[0].createdAt = new Date(now.getTime() + 3000);
        if (jobs[1]) jobs[1].createdAt = new Date(now.getTime() + 1000);
        if (jobs[2]) jobs[2].createdAt = new Date(now.getTime() + 2000);
      });

      it('should sort by scheduledAt ascending', () => {
        const sorted = adapter.sortJobsPublic(jobs, 'scheduledAt', 'asc');

        expect(sorted?.[0]?.event.aggregateId).toBe('test-1');
        expect(sorted?.[1]?.event.aggregateId).toBe('test-2');
        expect(sorted?.[2]?.event.aggregateId).toBe('test-3');
      });

      it('should sort by scheduledAt descending', () => {
        const sorted = adapter.sortJobsPublic(jobs, 'scheduledAt', 'desc');

        expect(sorted?.[0]?.event.aggregateId).toBe('test-3');
        expect(sorted?.[1]?.event.aggregateId).toBe('test-2');
        expect(sorted?.[2]?.event.aggregateId).toBe('test-1');
      });

      it('should sort by createdAt ascending', () => {
        const sorted = adapter.sortJobsPublic(jobs, 'createdAt', 'asc');

        expect(sorted?.[0]?.event.aggregateId).toBe('test-2');
        expect(sorted?.[1]?.event.aggregateId).toBe('test-3');
        expect(sorted?.[2]?.event.aggregateId).toBe('test-1');
      });

      it('should sort by createdAt descending', () => {
        const sorted = adapter.sortJobsPublic(jobs, 'createdAt', 'desc');

        expect(sorted?.[0]?.event.aggregateId).toBe('test-1');
        expect(sorted?.[1]?.event.aggregateId).toBe('test-3');
        expect(sorted?.[2]?.event.aggregateId).toBe('test-2');
      });

      it('should return original order when no sort specified', () => {
        const sorted = adapter.sortJobsPublic(jobs);

        expect(sorted).toEqual(jobs);
      });

      it('should handle empty array', () => {
        const sorted = adapter.sortJobsPublic([], 'scheduledAt', 'asc');

        expect(sorted).toEqual([]);
      });
    });

    describe('paginateJobs', () => {
      let jobs: IScheduledJob[];

      beforeEach(() => {
        jobs = [];
        for (let i = 0; i < 10; i++) {
          const event = TestEventFactory.immediate();
          jobs.push(adapter.createJobPublic(event));
        }
      });

      it('should paginate with limit and offset', () => {
        const result = adapter.paginateJobsPublic(jobs, 3, 2);

        expect(result.jobs).toHaveLength(3);
        expect(result.total).toBe(10);
        expect(result.count).toBe(3);
        expect(result.offset).toBe(2);
      });

      it('should handle offset beyond array length', () => {
        const result = adapter.paginateJobsPublic(jobs, 3, 15);

        expect(result.jobs).toHaveLength(0);
        expect(result.total).toBe(10);
        expect(result.count).toBe(0);
        expect(result.offset).toBe(15);
      });

      it('should handle limit larger than remaining items', () => {
        const result = adapter.paginateJobsPublic(jobs, 5, 8);

        expect(result.jobs).toHaveLength(2);
        expect(result.total).toBe(10);
        expect(result.count).toBe(2);
        expect(result.offset).toBe(8);
      });

      it('should return all jobs when no pagination', () => {
        const result = adapter.paginateJobsPublic(jobs);

        expect(result.jobs).toHaveLength(10);
        expect(result.total).toBe(10);
        expect(result.count).toBe(10);
        expect(result.offset).toBe(0);
      });

      it('should handle empty array', () => {
        const result = adapter.paginateJobsPublic([], 5, 0);

        expect(result.jobs).toHaveLength(0);
        expect(result.total).toBe(0);
        expect(result.count).toBe(0);
        expect(result.offset).toBe(0);
      });
    });
  });

  describe('concrete implementation behavior', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('should use utility methods correctly', async () => {
      const event = TestEventFactory.immediate();
      const jobId = await adapter.schedule(event);

      const job = await adapter.getJob(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.event).toBe(event);
      expect(job?.status).toBe(JobStatus.PENDING);
    });

    it('should handle job lifecycle with utility methods', async () => {
      const event = TestEventFactory.immediate();
      const jobId = await adapter.schedule(event);

      // Complete the job
      adapter.completeJob(jobId);

      const job = await adapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
      expect(job?.completedAt).toBeInstanceOf(Date);
      expect(job?.attempts).toBe(1);
    });

    it('should handle job failure with utility methods', async () => {
      const event = TestEventFactory.immediate();
      const jobId = await adapter.schedule(event);

      // Fail the job
      adapter.failJob(jobId, 'Test error');

      const job = await adapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.FAILED);
      expect(job?.lastError).toBe('Test error');
      expect(job?.attempts).toBe(1);
    });
  });
});
