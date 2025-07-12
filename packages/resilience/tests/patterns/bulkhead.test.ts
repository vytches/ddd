/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { Bulkhead, BulkheadRejectedException } from '../../src';
import { DefaultResilienceContext } from '../../src/core/resilience-context';

describe('Bulkhead', () => {
  let bulkhead: Bulkhead;
  const defaultConfig = {
    maxConcurrency: 2,
    queueCapacity: 3,
    timeout: 5000,
    name: 'test-bulkhead',
  };

  beforeEach(() => {
    bulkhead = new Bulkhead(defaultConfig);
  });

  describe('concurrency control', () => {
    it('should execute operations immediately when under concurrency limit', async () => {
      const context = DefaultResilienceContext.create();
      const operation1 = vi.fn().mockResolvedValue('result1');
      const operation2 = vi.fn().mockResolvedValue('result2');

      const [result1, result2] = await Promise.all([
        bulkhead.execute(operation1, context),
        bulkhead.execute(operation2, context),
      ]);

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
      expect(operation1).toHaveBeenCalled();
      expect(operation2).toHaveBeenCalled();
    });

    it('should queue operations when at concurrency limit', async () => {
      const context = DefaultResilienceContext.create();
      let resolveOperation1: (value: string) => void;

      const operation1 = vi.fn(
        () =>
          new Promise<string>(resolve => {
            resolveOperation1 = resolve;
          })
      );
      const operation2 = vi.fn(() => new Promise<string>(resolve => setTimeout(resolve, 50)));
      const operation3 = vi.fn().mockResolvedValue('result3');

      const promise1 = bulkhead.execute(operation1, context);
      const promise2 = bulkhead.execute(operation2, context);
      const promise3 = bulkhead.execute(operation3, context);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(operation1).toHaveBeenCalled();
      expect(operation2).toHaveBeenCalled();
      expect(operation3).not.toHaveBeenCalled();

      const metrics = bulkhead.getMetrics();
      expect(metrics.activeTasks).toBe(2);
      expect(metrics.queuedTasks).toBe(1);

      resolveOperation1!('result1');
      await promise1;

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(operation3).toHaveBeenCalled();

      await promise2;
      const result3 = await promise3;

      expect(result3).toBe('result3');
    });

    it('should reject operations when queue is full', async () => {
      const context = DefaultResilienceContext.create();
      const longRunningOp = () => new Promise(resolve => setTimeout(resolve, 1000));

      const promises = [];
      for (let i = 0; i < defaultConfig.maxConcurrency; i++) {
        promises.push(bulkhead.execute(longRunningOp, context));
      }

      for (let i = 0; i < defaultConfig.queueCapacity; i++) {
        promises.push(bulkhead.execute(longRunningOp, context));
      }

      const [error] = await safeRun(() => bulkhead.execute(longRunningOp, context));
      expect(error).toBeInstanceOf(BulkheadRejectedException);

      const metrics = bulkhead.getMetrics();
      expect(metrics.totalRejected).toBe(1);
    });
  });

  describe('timeout handling', () => {
    it('should apply timeout to operations', async () => {
      const bulkheadWithShortTimeout = new Bulkhead({
        ...defaultConfig,
        timeout: 100,
      });

      const context = DefaultResilienceContext.create();
      const slowOperation = () => new Promise(resolve => setTimeout(resolve, 200));

      const [error] = await safeRun(() => bulkheadWithShortTimeout.execute(slowOperation, context));
      expect(error).toBeInstanceOf(Error);
    });

    it('should not apply timeout when not configured', async () => {
      const bulkheadWithoutTimeout = new Bulkhead({
        maxConcurrency: 1,
        queueCapacity: 1,
      });

      const context = DefaultResilienceContext.create();
      const operation = vi.fn().mockResolvedValue('success');

      const result = await bulkheadWithoutTimeout.execute(operation, context);
      expect(result).toBe('success');
    });
  });

  describe('cancellation handling', () => {
    it('should cancel queued operations when context is aborted', async () => {
      const context = DefaultResilienceContext.create();
      const abortController = new AbortController();
      const abortableContext = new DefaultResilienceContext(
        undefined,
        undefined,
        1,
        new Map(),
        abortController
      );

      const longRunningOp = () => new Promise(resolve => setTimeout(resolve, 1000));

      bulkhead.execute(longRunningOp, context).catch(() => {
        /* Expected to timeout */
      });
      bulkhead.execute(longRunningOp, context).catch(() => {
        /* Expected to timeout */
      });

      const queuedPromise = bulkhead.execute(longRunningOp, abortableContext);

      setTimeout(() => abortController.abort(), 10);

      const [error] = await safeRun(() => queuedPromise);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('metrics', () => {
    it('should track active and queued tasks', async () => {
      const context = DefaultResilienceContext.create();
      let resolveOp1: (value: string) => void;
      let resolveOp2: (value: string) => void;

      const operation1 = () =>
        new Promise<string>(resolve => {
          resolveOp1 = resolve;
        });
      const operation2 = () =>
        new Promise<string>(resolve => {
          resolveOp2 = resolve;
        });
      const operation3 = vi.fn().mockResolvedValue('fast');

      const promise1 = bulkhead.execute(operation1, context);
      const promise2 = bulkhead.execute(operation2, context);
      const promise3 = bulkhead.execute(operation3, context);

      await new Promise(resolve => setTimeout(resolve, 10));

      const metrics = bulkhead.getMetrics();
      expect(metrics.activeTasks).toBe(2);
      expect(metrics.queuedTasks).toBe(1);

      resolveOp1!('result1');
      resolveOp2!('result2');

      await Promise.all([promise1, promise2, promise3]);

      const finalMetrics = bulkhead.getMetrics();
      expect(finalMetrics.activeTasks).toBe(0);
      expect(finalMetrics.queuedTasks).toBe(0);
      expect(finalMetrics.totalCompleted).toBe(3);
    });

    it('should track rejected operations', async () => {
      const context = DefaultResilienceContext.create();
      const longRunningOp = () => new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < defaultConfig.maxConcurrency + defaultConfig.queueCapacity; i++) {
        bulkhead.execute(longRunningOp, context).catch(() => {
          /* Expected to timeout */
        });
      }

      try {
        await bulkhead.execute(longRunningOp, context);
      } catch (_error) {
        // Expected rejection
      }

      const metrics = bulkhead.getMetrics();
      expect(metrics.totalRejected).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should propagate operation errors', async () => {
      const context = DefaultResilienceContext.create();
      const failingOperation = vi.fn().mockRejectedValue(new Error('operation failed'));

      const [error] = await safeRun(() => bulkhead.execute(failingOperation, context));
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe('operation failed');

      expect(failingOperation).toHaveBeenCalled();
    });

    it('should continue processing queue after operation failure', async () => {
      const context = DefaultResilienceContext.create();
      let resolveOp1: (value: string) => void;

      const operation1 = () =>
        new Promise<string>(resolve => {
          resolveOp1 = resolve;
        });
      const operation2 = () => new Promise<string>(resolve => setTimeout(() => resolve('op2'), 50));
      const failingOperation = vi.fn().mockRejectedValue(new Error('fail'));
      const successOperation = vi.fn().mockResolvedValue('success');

      const promise1 = bulkhead.execute(operation1, context);
      const promise2 = bulkhead.execute(operation2, context);
      const failPromise = bulkhead.execute(failingOperation, context);
      const successPromise = bulkhead.execute(successOperation, context);

      await new Promise(resolve => setTimeout(resolve, 10));
      resolveOp1!('result1');
      await promise1;

      const [error] = await safeRun(() => failPromise);
      expect(error).toBeInstanceOf(Error);
      expect(error!.message).toBe('fail');
      const result = await successPromise;

      expect(result).toBe('success');
      expect(successOperation).toHaveBeenCalled();

      await promise2;
    });
  });

  describe('configuration', () => {
    it('should return bulkhead name', () => {
      expect(bulkhead.getName()).toBe('test-bulkhead');
    });

    it('should use default name when not provided', () => {
      const unnamedBulkhead = new Bulkhead({
        maxConcurrency: 1,
        queueCapacity: 1,
      });

      expect(unnamedBulkhead.getName()).toBe('unnamed');
    });
  });
});
