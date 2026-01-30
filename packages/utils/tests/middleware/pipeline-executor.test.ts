import { describe, it, expect, vi } from 'vitest';

import type { IMiddleware } from '../../src/middleware';
import { MiddlewarePipelineExecutor } from '../../src/middleware';
import { safeRun } from '../../src/saferun';

interface TestContext {
  userId: string;
  action: string;
  logs: string[];
}

interface TestResult {
  success: boolean;
  data: string;
}

class LoggingMiddleware implements IMiddleware<TestContext, TestResult> {
  constructor(private name: string) {}

  async handle(context: TestContext, next: () => Promise<TestResult>): Promise<TestResult> {
    context.logs.push(`${this.name}:before`);
    const result = await next();
    context.logs.push(`${this.name}:after`);
    return result;
  }
}

class TransformMiddleware implements IMiddleware<TestContext, TestResult> {
  async handle(context: TestContext, next: () => Promise<TestResult>): Promise<TestResult> {
    const result = await next();
    return { ...result, data: result.data.toUpperCase() };
  }
}

class ErrorMiddleware implements IMiddleware<TestContext, TestResult> {
  async handle(_context: TestContext, _next: () => Promise<TestResult>): Promise<TestResult> {
    throw new Error('Middleware error');
  }
}

class ShortCircuitMiddleware implements IMiddleware<TestContext, TestResult> {
  async handle(_context: TestContext, _next: () => Promise<TestResult>): Promise<TestResult> {
    // Intentionally not calling next()
    return { success: false, data: 'short-circuited' };
  }
}

describe('MiddlewarePipelineExecutor', () => {
  describe('execute', () => {
    it('should execute handler directly when no middleware', async () => {
      const executor = new MiddlewarePipelineExecutor<TestContext, TestResult>([]);
      const context: TestContext = { userId: '123', action: 'test', logs: [] };

      const result = await executor.execute(context, async ctx => ({
        success: true,
        data: `processed:${ctx.userId}`,
      }));

      expect(result.success).toBe(true);
      expect(result.data).toBe('processed:123');
    });

    it('should execute single middleware', async () => {
      const executor = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new LoggingMiddleware('m1'),
      ]);
      const context: TestContext = { userId: '123', action: 'test', logs: [] };

      const result = await executor.execute(context, async () => ({
        success: true,
        data: 'done',
      }));

      expect(result.success).toBe(true);
      expect(context.logs).toEqual(['m1:before', 'm1:after']);
    });

    it('should execute middleware in correct order', async () => {
      const executor = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new LoggingMiddleware('m1'),
        new LoggingMiddleware('m2'),
        new LoggingMiddleware('m3'),
      ]);
      const context: TestContext = { userId: '123', action: 'test', logs: [] };

      await executor.execute(context, async () => ({ success: true, data: 'done' }));

      expect(context.logs).toEqual([
        'm1:before',
        'm2:before',
        'm3:before',
        'm3:after',
        'm2:after',
        'm1:after',
      ]);
    });

    it('should allow middleware to transform result', async () => {
      const executor = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new TransformMiddleware(),
      ]);
      const context: TestContext = { userId: '123', action: 'test', logs: [] };

      const result = await executor.execute(context, async () => ({
        success: true,
        data: 'hello',
      }));

      expect(result.data).toBe('HELLO');
    });

    it('should propagate errors from middleware', async () => {
      const executor = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new ErrorMiddleware(),
      ]);
      const context: TestContext = { userId: '123', action: 'test', logs: [] };

      const [error] = await safeRun(async () =>
        executor.execute(context, async () => ({ success: true, data: 'done' }))
      );

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Middleware error');
    });

    it('should propagate errors from handler', async () => {
      const executor = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new LoggingMiddleware('m1'),
      ]);
      const context: TestContext = { userId: '123', action: 'test', logs: [] };

      const [error] = await safeRun(async () =>
        executor.execute(context, async () => {
          throw new Error('Handler error');
        })
      );

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Handler error');
      // Before log should still be recorded
      expect(context.logs).toContain('m1:before');
    });

    it('should allow middleware to short-circuit pipeline', async () => {
      const handlerSpy = vi.fn().mockResolvedValue({ success: true, data: 'done' });
      const executor = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new LoggingMiddleware('m1'),
        new ShortCircuitMiddleware(),
        new LoggingMiddleware('m2'),
      ]);
      const context: TestContext = { userId: '123', action: 'test', logs: [] };

      const result = await executor.execute(context, handlerSpy);

      expect(result.data).toBe('short-circuited');
      expect(handlerSpy).not.toHaveBeenCalled();
      // Only m1 should be called, m2 should be skipped
      expect(context.logs).toEqual(['m1:before', 'm1:after']);
    });
  });

  describe('executeSimple', () => {
    it('should execute with simple handler', async () => {
      const executor = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new LoggingMiddleware('m1'),
      ]);
      const context: TestContext = { userId: '123', action: 'test', logs: [] };

      const result = await executor.executeSimple(context, async () => ({
        success: true,
        data: 'simple',
      }));

      expect(result.data).toBe('simple');
      expect(context.logs).toEqual(['m1:before', 'm1:after']);
    });
  });

  describe('properties', () => {
    it('should return correct length', () => {
      const executor = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new LoggingMiddleware('m1'),
        new LoggingMiddleware('m2'),
      ]);

      expect(executor.length).toBe(2);
    });

    it('should return isEmpty correctly', () => {
      const emptyExecutor = new MiddlewarePipelineExecutor<TestContext, TestResult>([]);
      const nonEmptyExecutor = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new LoggingMiddleware('m1'),
      ]);

      expect(emptyExecutor.isEmpty).toBe(true);
      expect(nonEmptyExecutor.isEmpty).toBe(false);
    });
  });

  describe('append', () => {
    it('should create new executor with appended middleware', async () => {
      const original = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new LoggingMiddleware('m1'),
      ]);

      const extended = original.append(new LoggingMiddleware('m2'));
      const context: TestContext = { userId: '123', action: 'test', logs: [] };

      await extended.execute(context, async () => ({ success: true, data: 'done' }));

      expect(extended.length).toBe(2);
      expect(original.length).toBe(1); // Original unchanged
      expect(context.logs).toEqual(['m1:before', 'm2:before', 'm2:after', 'm1:after']);
    });
  });

  describe('prepend', () => {
    it('should create new executor with prepended middleware', async () => {
      const original = new MiddlewarePipelineExecutor<TestContext, TestResult>([
        new LoggingMiddleware('m2'),
      ]);

      const extended = original.prepend(new LoggingMiddleware('m1'));
      const context: TestContext = { userId: '123', action: 'test', logs: [] };

      await extended.execute(context, async () => ({ success: true, data: 'done' }));

      expect(extended.length).toBe(2);
      expect(context.logs).toEqual(['m1:before', 'm2:before', 'm2:after', 'm1:after']);
    });
  });

  describe('static methods', () => {
    it('should create empty executor', () => {
      const executor = MiddlewarePipelineExecutor.empty<TestContext, TestResult>();

      expect(executor.isEmpty).toBe(true);
      expect(executor.length).toBe(0);
    });

    it('should create executor from array', () => {
      const middlewares = [new LoggingMiddleware('m1'), new LoggingMiddleware('m2')];
      const executor = MiddlewarePipelineExecutor.from(middlewares);

      expect(executor.length).toBe(2);
    });
  });

  describe('immutability', () => {
    it('should not be affected by modifications to original array', async () => {
      const middlewares: IMiddleware<TestContext, TestResult>[] = [new LoggingMiddleware('m1')];
      const executor = new MiddlewarePipelineExecutor(middlewares);

      // Modify original array
      middlewares.push(new LoggingMiddleware('m2'));

      expect(executor.length).toBe(1); // Should still be 1
    });
  });
});
