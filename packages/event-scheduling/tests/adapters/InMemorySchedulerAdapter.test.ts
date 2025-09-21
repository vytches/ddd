import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { TestScheduledEvent, TestEventFactory, InMemorySchedulerAdapter } from '../../src';
import { JobStatus, BackoffStrategy } from '@vytches/ddd-contracts';
import type { ISchedulerLifecycle } from '@vytches/ddd-contracts';

// Mock timers
vi.useFakeTimers();

describe('InMemorySchedulerAdapter', () => {
  let adapter: InMemorySchedulerAdapter;
  let mockLifecycle: ISchedulerLifecycle;

  beforeEach(() => {
    mockLifecycle = {
      onStart: vi.fn(),
      onStop: vi.fn(),
      onBeforeProcess: vi.fn(),
      onAfterProcess: vi.fn(),
      onError: vi.fn(),
    };
    adapter = new InMemorySchedulerAdapter({
      lifecycle: mockLifecycle,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(adapter.constructor.name).toBe('InMemorySchedulerAdapter');
      expect(adapter.isRunning()).toBe(false);
    });
  });

  describe('start', () => {
    it('should start the scheduler', async () => {
      await adapter.start();

      expect(adapter.isRunning()).toBe(true);
      expect(mockLifecycle.onStart).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      await adapter.start();

      // Should not throw when starting again
      const [startError] = await safeRun(() => adapter.start());
      expect(startError).toBeUndefined();
      expect(adapter.isRunning()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop the scheduler', async () => {
      await adapter.start();
      await adapter.stop();

      expect(adapter.isRunning()).toBe(false);
      expect(mockLifecycle.onStop).toHaveBeenCalled();
    });

    it('should clear all timers when stopping', async () => {
      await adapter.start();

      const event = TestEventFactory.delayed(1000);
      await adapter.schedule(event);

      await adapter.stop();

      // Advance time past the scheduled event
      vi.advanceTimersByTime(2000);

      // Event should not be processed after stop
      expect(mockLifecycle.onBeforeProcess).not.toHaveBeenCalled();
    });

    it('should not fail when stopping while not running', async () => {
      const [stopError] = await safeRun(() => adapter.stop());
      expect(stopError).toBeUndefined();
    });
  });

  describe('schedule', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('should schedule immediate events', async () => {
      const event = TestEventFactory.immediate();

      const jobId = await adapter.schedule(event);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const job = await adapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.SCHEDULED);
    });

    it('should schedule delayed events', async () => {
      const delayMs = 5000;
      const event = TestEventFactory.delayed(delayMs);

      const jobId = await adapter.schedule(event);

      const job = await adapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.SCHEDULED);
      expect(job?.scheduledAt).toEqual(event.scheduleAt);
    });

    it('should handle multiple events', async () => {
      const event1 = TestEventFactory.delayed(1000);
      const event2 = TestEventFactory.delayed(2000);

      const jobId1 = await adapter.schedule(event1);
      const jobId2 = await adapter.schedule(event2);

      expect(jobId1).toBeDefined();
      expect(jobId2).toBeDefined();
      expect(jobId1).not.toBe(jobId2);
    });

    it('should allow scheduling when not running', async () => {
      await adapter.stop();

      const event = TestEventFactory.immediate();

      // Should not throw - InMemorySchedulerAdapter allows scheduling when not running
      const jobId = await adapter.schedule(event);
      expect(jobId).toBeDefined();

      // Job should be created but not processed until started
      const job = await adapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.PENDING);
    });
  });

  describe('cancel', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('should cancel scheduled events', async () => {
      const event = TestEventFactory.delayed(5000);
      const jobId = await adapter.schedule(event);

      await adapter.cancel(jobId);

      const job = await adapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.CANCELLED);
    });

    it('should throw for non-existent job', async () => {
      const [cancelError] = await safeRun(() => adapter.cancel('non-existent-job'));
      expect(cancelError?.message).toBe('Job non-existent-job not found');
    });

    it('should throw for completed job', async () => {
      const event = TestEventFactory.immediate();
      const jobId = await adapter.schedule(event);

      // Wait for job to complete
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync(); // Run all async timers to completion

      const [cancelError] = await safeRun(() => adapter.cancel(jobId));
      expect(cancelError).toBeInstanceOf(Error);
    });
  });

  describe('getJob', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('should return job details', async () => {
      const event = TestEventFactory.delayed(1000);
      const jobId = await adapter.schedule(event);

      const job = await adapter.getJob(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
      expect(job?.event).toBe(event);
      expect(job?.status).toBe(JobStatus.SCHEDULED);
      expect(job?.attempts).toBe(0);
    });

    it('should return undefined for non-existent job', async () => {
      const job = await adapter.getJob('non-existent-job');

      expect(job).toBeUndefined();
    });

    it('should update job status during processing', async () => {
      const event = TestEventFactory.immediate();
      const jobId = await adapter.schedule(event);

      // Job should be scheduled initially
      let job = await adapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.SCHEDULED);

      // After processing starts, job should be completed
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync(); // Run all async timers to completion

      job = await adapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
    });
  });

  describe('listJobs', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('should list all jobs', async () => {
      const event1 = TestEventFactory.delayed(1000);
      const event2 = TestEventFactory.delayed(2000);

      await adapter.schedule(event1);
      await adapter.schedule(event2);

      const result = await adapter.listJobs();

      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.count).toBe(2);
      expect(result.offset).toBe(0);
    });

    it('should filter by status', async () => {
      const event1 = TestEventFactory.immediate();
      const event2 = TestEventFactory.delayed(1000);

      await adapter.schedule(event1);
      await adapter.schedule(event2);

      // Process immediate event only
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync(); // This will run all timers

      // Since vi.runAllTimersAsync() processes all timers, both events will be completed
      const result = await adapter.listJobs({ status: JobStatus.COMPLETED });

      expect(result.jobs).toHaveLength(2);
      expect(result.jobs.every(job => job.status === JobStatus.COMPLETED)).toBe(true);
    });

    it('should apply limit and offset', async () => {
      const events = [
        TestEventFactory.delayed(1000),
        TestEventFactory.delayed(2000),
        TestEventFactory.delayed(3000),
      ];

      for (const event of events) {
        await adapter.schedule(event);
      }

      const result = await adapter.listJobs({ limit: 2, offset: 1 });

      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.count).toBe(2);
      expect(result.offset).toBe(1);
    });
  });

  describe('reschedule', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('should reschedule a job', async () => {
      const event = TestEventFactory.delayed(5000);
      const jobId = await adapter.schedule(event);

      const newTime = new Date(Date.now() + 1000);
      await adapter.reschedule(jobId, newTime);

      const job = await adapter.getJob(jobId);
      expect(job?.scheduledAt).toEqual(newTime);
    });

    it('should throw for non-existent job', async () => {
      const newTime = new Date(Date.now() + 1000);

      const [error] = await safeRun(() => adapter.reschedule('non-existent-job', newTime));
      expect(error?.message).toBe('Job non-existent-job not found');
    });
  });

  describe('clear', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('should clear all jobs', async () => {
      const event1 = TestEventFactory.delayed(1000);
      const event2 = TestEventFactory.delayed(2000);

      await adapter.schedule(event1);
      await adapter.schedule(event2);

      await adapter.clear();

      const result = await adapter.listJobs();
      expect(result.jobs).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('should return job statistics', async () => {
      const event1 = TestEventFactory.immediate();
      const event2 = TestEventFactory.delayed(1000);

      await adapter.schedule(event1);
      await adapter.schedule(event2);

      // Process all events
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync(); // This will run all timers

      const stats = await adapter.getStats();

      expect(stats.completed).toBe(2);
      expect(stats.scheduled).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.cancelled).toBe(0);
    });
  });

  describe('error handling and retries', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('should handle processing errors', async () => {
      const mockError = new Error('Test error');
      const failingLifecycle = {
        onBeforeProcess: vi.fn(),
        onAfterProcess: vi.fn(),
        onError: vi.fn(),
      };

      const failingAdapter = new InMemorySchedulerAdapter({
        lifecycle: {
          ...failingLifecycle,
          onBeforeProcess: vi.fn().mockRejectedValue(mockError),
        },
      });

      await failingAdapter.start();

      const event = TestEventFactory.immediate();
      const jobId = await failingAdapter.schedule(event);

      // Process the event
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync(); // Run all async timers to completion

      const job = await failingAdapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.FAILED);
      expect(job?.lastError).toBe('Test error');

      await failingAdapter.stop();
    });

    it('should retry failed events with exponential backoff', async () => {
      const mockError = new Error('Test error');
      let callCount = 0;

      const retryLifecycle = {
        onBeforeProcess: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount < 3) {
            throw mockError;
          }
          return Promise.resolve();
        }),
        onAfterProcess: vi.fn(),
        onError: vi.fn(),
      };

      const retryAdapter = new InMemorySchedulerAdapter({
        lifecycle: retryLifecycle,
        defaultMaxRetries: 3,
      });

      await retryAdapter.start();

      const event = TestEventFactory.withRetry('test-aggregate', 3, BackoffStrategy.EXPONENTIAL);
      const jobId = await retryAdapter.schedule(event);

      // Process initial attempt
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync(); // Run all async timers to completion

      // First retry (after 1000ms)
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync(); // Run all async timers to completion

      // Second retry (after 2000ms more)
      vi.advanceTimersByTime(2000);
      await vi.runAllTimersAsync(); // Run all async timers to completion

      const job = await retryAdapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.COMPLETED);
      expect(job?.attempts).toBe(3);
      expect(retryLifecycle.onBeforeProcess).toHaveBeenCalledTimes(3);

      await retryAdapter.stop();
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      await adapter.start();
    });

    afterEach(async () => {
      await adapter.stop();
    });

    it('should handle events scheduled in the past', async () => {
      const pastEvent = new TestScheduledEvent(
        'test-123',
        new Date(Date.now() - 30000), // 30 seconds ago (within grace period)
        'Past event'
      );

      const jobId = await adapter.schedule(pastEvent);

      const job = await adapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.SCHEDULED);
    });

    it('should handle very distant future events', async () => {
      const distantFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      const futureEvent = new TestScheduledEvent('test-123', distantFuture, 'Future event');

      const jobId = await adapter.schedule(futureEvent);

      const job = await adapter.getJob(jobId);
      expect(job?.status).toBe(JobStatus.SCHEDULED);
    });

    it('should handle null event gracefully', async () => {
      const [error] = await safeRun(() => adapter.schedule(null as any));
      expect(error).toBeDefined();
    });
  });
});
