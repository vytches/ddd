import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';
import {
  BaseSagaMiddleware,
  PerformanceMonitoringMiddleware,
  RetryMiddleware,
  CircuitBreakerMiddleware,
  SecurityMiddleware,
  SagaMiddlewarePipeline,
} from '../../../src/sagas/middleware';
import type {
  ISaga,
  ISagaMiddlewareContext,
  ISagaExecutionContext,
  ISagaActionResult,
} from '../../../src/sagas/interfaces';
import { SagaStatus } from '../../../src/sagas/interfaces';

// Mock logger
vi.mock('@vytches-ddd/logging', () => ({
  Logger: {
    forContext: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Mock implementations
const createMockEvent = (eventType = 'TestEvent'): IExtendedDomainEvent => ({
  eventType,
  payload: { test: true },
  metadata: { eventId: 'evt-123', timestamp: new Date(), correlationId: 'corr-123' },
});

const createMockSaga = (sagaId = 'saga-123', sagaType = 'TestSaga'): ISaga => ({
  sagaId,
  sagaType,
  status: SagaStatus.EXECUTING,
  state: {
    sagaId,
    sagaType,
    status: SagaStatus.EXECUTING,
    currentStep: 'testStep',
    stepData: {},
    compensationData: {},
    correlationId: 'corr-123',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    timeoutAt: undefined,
    version: 1,
  },
  handleEvent: vi.fn(),
  compensate: vi.fn(),
  canHandle: vi.fn(),
  getCorrelationData: vi.fn(() => ({ correlationId: 'corr-123' })),
});

const createMockContext = (): ISagaExecutionContext => ({
  correlationId: 'corr-123',
  userId: 'user-123',
  metadata: {},
  timestamp: new Date(),
});

const createMockMiddlewareContext = (): ISagaMiddlewareContext => ({
  sagaId: 'saga-123',
  sagaType: 'TestSaga',
  stepName: 'testStep',
  event: createMockEvent(),
  executionContext: createMockContext(),
  sagaState: createMockSaga().state,
  metadata: {},
  startTime: new Date(),
});

describe('BaseSagaMiddleware', () => {
  class TestMiddleware extends BaseSagaMiddleware {
    constructor() {
      super('TestMiddleware');
    }
  }

  it('should initialize with name', () => {
    const middleware = new TestMiddleware();
    expect(middleware.getName()).toBe('TestMiddleware');
  });

  it('should apply to all contexts by default', () => {
    const middleware = new TestMiddleware();
    const context = createMockMiddlewareContext();
    expect(middleware.shouldApply(context)).toBe(true);
  });

  it('should implement default before/after/onError methods', async () => {
    const middleware = new TestMiddleware();
    const context = createMockMiddlewareContext();
    const next = vi.fn();
    const nextWithResult = vi.fn();
    const nextWithError = vi.fn();

    await middleware.before(context, next);
    expect(next).toHaveBeenCalled();

    await middleware.after(context, { success: true }, nextWithResult);
    expect(nextWithResult).toHaveBeenCalledWith({ success: true });

    const error = new Error('Test error');
    await middleware.onError(context, error, nextWithError);
    expect(nextWithError).toHaveBeenCalledWith(error);
  });
});

describe('PerformanceMonitoringMiddleware', () => {
  let middleware: PerformanceMonitoringMiddleware;
  let mockLogger: any;

  beforeEach(() => {
    middleware = new PerformanceMonitoringMiddleware();
    mockLogger = (middleware as any).logger;
  });

  it('should track execution time', async () => {
    const context = createMockMiddlewareContext();
    const next = vi.fn();
    const nextWithResult = vi.fn();

    // Mock performance.now
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      time += 100;
      return time;
    });

    await middleware.before(context, next);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Starting saga step execution',
      expect.objectContaining({
        sagaId: 'saga-123',
        sagaType: 'TestSaga',
        stepName: 'testStep',
      })
    );

    const result = { success: true };
    await middleware.after(context, result, nextWithResult);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Saga step completed',
      expect.objectContaining({
        sagaId: 'saga-123',
        executionTime: 100,
        success: true,
      })
    );

    vi.restoreAllMocks();
  });

  it('should warn on slow execution', async () => {
    const context = createMockMiddlewareContext();
    const next = vi.fn();
    const nextWithResult = vi.fn();

    // Mock slow execution
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      time += 6000; // 6 seconds
      return time;
    });

    await middleware.before(context, next);
    await middleware.after(context, { success: true }, nextWithResult);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Slow saga step execution detected',
      expect.objectContaining({
        executionTime: 6000,
        threshold: 5000,
      })
    );

    vi.restoreAllMocks();
  });

  it('should handle errors and track execution time', async () => {
    const context = createMockMiddlewareContext();
    const next = vi.fn();
    const nextWithError = vi.fn();
    const error = new Error('Test error');

    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => {
      time += 50;
      return time;
    });

    await middleware.before(context, next);
    await middleware.onError(context, error, nextWithError);

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Saga step execution failed',
      error,
      expect.objectContaining({
        execution_time: 50,
        error_message: 'Test error',
      })
    );

    vi.restoreAllMocks();
  });
});

describe('RetryMiddleware', () => {
  let middleware: RetryMiddleware;
  let mockLogger: any;

  beforeEach(() => {
    vi.useFakeTimers();
    middleware = new RetryMiddleware(3, 100, 2); // 3 retries, 100ms initial delay, 2x backoff
    mockLogger = (middleware as any).logger;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not retry on success', async () => {
    const context = createMockMiddlewareContext();
    const nextWithResult = vi.fn();
    const result = { success: true };

    await middleware.after(context, result, nextWithResult);

    expect(nextWithResult).toHaveBeenCalledWith(result);
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('should retry on error with backoff', async () => {
    const context = createMockMiddlewareContext();
    const nextWithError = vi.fn();
    const error = new Error('Temporary error');

    // First attempt - should start the retry process without calling next
    const firstAttempt = middleware.onError(context, error, nextWithError);

    // Check that it logged the retry intent
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Saga step failed, retrying',
      expect.objectContaining({
        attempt: 1,
        maxRetries: 3,
        nextRetryIn: 100,
      })
    );
    expect(nextWithError).not.toHaveBeenCalled();

    // Advance timer and wait for first attempt to complete
    await vi.advanceTimersByTimeAsync(100);
    await firstAttempt;

    // Second attempt with increased delay
    const secondAttempt = middleware.onError(context, error, nextWithError);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Saga step failed, retrying',
      expect.objectContaining({
        attempt: 2,
        nextRetryIn: 200, // 100 * 2
      })
    );

    // Advance timer and wait for second attempt
    await vi.advanceTimersByTimeAsync(200);
    await secondAttempt;

    // Third attempt
    const thirdAttempt = middleware.onError(context, error, nextWithError);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Saga step failed, retrying',
      expect.objectContaining({
        attempt: 3,
        nextRetryIn: 400, // 200 * 2
      })
    );

    // Advance timer and wait for third attempt
    await vi.advanceTimersByTimeAsync(400);
    await thirdAttempt;

    // Fourth attempt - should fail and call next
    await middleware.onError(context, error, nextWithError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Saga step failed after all retries',
      error,
      expect.objectContaining({
        total_attempts: 4,
      })
    );
    expect(nextWithError).toHaveBeenCalledWith(error);
  });

  it('should clear retry count on success after retry', async () => {
    const context = createMockMiddlewareContext();
    const nextWithError = vi.fn();
    const nextWithResult = vi.fn();
    const error = new Error('Temporary error');

    // First failure
    const firstAttempt = middleware.onError(context, error, nextWithError);
    await vi.advanceTimersByTimeAsync(100);
    await firstAttempt;

    // Second failure
    const secondAttempt = middleware.onError(context, error, nextWithError);
    await vi.advanceTimersByTimeAsync(200);
    await secondAttempt;

    // Then succeed
    const result = { success: true };
    await middleware.after(context, result, nextWithResult);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Saga step succeeded after retry',
      expect.objectContaining({
        successful_attempt: 3,
        total_attempts: 4,
      })
    );
  });
});

describe('CircuitBreakerMiddleware', () => {
  let middleware: CircuitBreakerMiddleware;
  let mockLogger: any;

  beforeEach(() => {
    vi.useFakeTimers();
    middleware = new CircuitBreakerMiddleware(3, 1000, 2); // 3 failures to open, 1s recovery, 2 successes to close
    mockLogger = (middleware as any).logger;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests when circuit is closed', async () => {
    const context = createMockMiddlewareContext();
    const next = vi.fn();

    await middleware.before(context, next);
    expect(next).toHaveBeenCalled();
  });

  it('should open circuit after failure threshold', async () => {
    const context = createMockMiddlewareContext();
    const next = vi.fn();
    const nextWithError = vi.fn();
    const error = new Error('Service unavailable');

    // Fail 3 times to open circuit
    for (let i = 0; i < 3; i++) {
      await middleware.onError(context, error, nextWithError);
    }

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Circuit breaker opened due to failures',
      expect.objectContaining({
        failures: 3,
        failureThreshold: 3,
      })
    );

    // Next request should be rejected
    const [beforeError] = await safeRun(() => middleware.before(context, next));
    expect(beforeError?.message).toContain('Circuit breaker is open');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Circuit breaker is open, rejecting saga step',
      expect.any(Object)
    );
  });

  it('should enter half-open state after recovery timeout', async () => {
    const context = createMockMiddlewareContext();
    const next = vi.fn();
    const nextWithError = vi.fn();
    const error = new Error('Service error');

    // Open circuit
    for (let i = 0; i < 3; i++) {
      await middleware.onError(context, error, nextWithError);
    }

    // Wait for recovery timeout
    await vi.advanceTimersByTimeAsync(1001);

    // Should allow request (half-open)
    await middleware.before(context, next);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Circuit breaker entering half-open state',
      expect.any(Object)
    );
    expect(next).toHaveBeenCalled();
  });

  it('should close circuit after success threshold in half-open state', async () => {
    const context = createMockMiddlewareContext();
    const next = vi.fn();
    const nextWithResult = vi.fn();
    const nextWithError = vi.fn();
    const error = new Error('Service error');

    // Open circuit
    for (let i = 0; i < 3; i++) {
      await middleware.onError(context, error, nextWithError);
    }

    // Enter half-open
    await vi.advanceTimersByTimeAsync(1001);
    await middleware.before(context, next);

    // Two successful operations to close circuit
    for (let i = 0; i < 2; i++) {
      await middleware.after(context, { success: true }, nextWithResult);
    }

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Circuit breaker closed after successful operations',
      expect.objectContaining({
        successCount: 2,
        successThreshold: 2,
      })
    );
  });

  it('should track failures for unsuccessful results', async () => {
    const context = createMockMiddlewareContext();
    const nextWithResult = vi.fn();

    // Record failed results
    for (let i = 0; i < 3; i++) {
      await middleware.after(context, { success: false }, nextWithResult);
    }

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Circuit breaker opened due to failures',
      expect.any(Object)
    );
  });
});

describe('SecurityMiddleware', () => {
  let mockLogger: any;

  it('should allow authorized requests', async () => {
    const authorizer = vi.fn().mockResolvedValue(true);
    const middleware = new SecurityMiddleware(authorizer);
    mockLogger = (middleware as any).logger;

    const context = createMockMiddlewareContext();
    const next = vi.fn();

    await middleware.before(context, next);

    expect(authorizer).toHaveBeenCalledWith(context);
    expect(next).toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('should reject unauthorized requests', async () => {
    const authorizer = vi.fn().mockResolvedValue(false);
    const middleware = new SecurityMiddleware(authorizer);
    mockLogger = (middleware as any).logger;

    const context = createMockMiddlewareContext();
    const next = vi.fn();

    const [beforeError] = await safeRun(() => middleware.before(context, next));
    expect(beforeError?.message).toBe('Unauthorized operation');

    expect(authorizer).toHaveBeenCalledWith(context);
    expect(next).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Unauthorized saga operation attempted',
      expect.objectContaining({
        sagaId: 'saga-123',
        userId: 'user-123',
      })
    );
  });

  it('should use default authorization when no authorizer provided', async () => {
    const middleware = new SecurityMiddleware();
    const next = vi.fn();

    // With userId - should allow
    const contextWithUser = createMockMiddlewareContext();
    await middleware.before(contextWithUser, next);
    expect(next).toHaveBeenCalled();

    // Without userId or sessionId - should reject
    next.mockClear();
    const contextWithoutAuth = createMockMiddlewareContext();
    // @ts-expect-error expected
    contextWithoutAuth.executionContext.userId = undefined;

    const [beforeError] = await safeRun(() => middleware.before(contextWithoutAuth, next));
    expect(beforeError?.message).toBe('Unauthorized operation');
    expect(next).not.toHaveBeenCalled();

    // With sessionId only - should allow
    next.mockClear();
    const contextWithSession = createMockMiddlewareContext();
    // @ts-expect-error expected
    contextWithSession.executionContext.userId = undefined;
    contextWithSession.executionContext.sessionId = 'session-123';

    await middleware.before(contextWithSession, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('SagaMiddlewarePipeline', () => {
  let pipeline: SagaMiddlewarePipeline;
  let mockLogger: any;

  beforeEach(() => {
    pipeline = new SagaMiddlewarePipeline();
    mockLogger = (pipeline as any).logger;
  });

  it('should add middleware to pipeline', () => {
    const middleware1 = new PerformanceMonitoringMiddleware();
    const middleware2 = new RetryMiddleware();

    pipeline.use(middleware1);
    pipeline.use(middleware2);

    const names = pipeline.getMiddlewareNames();
    expect(names).toEqual(['PerformanceMonitoring', 'Retry']);
  });

  it('should execute middleware in correct order', async () => {
    const executionOrder: string[] = [];

    const middleware1 = {
      getName: () => 'First',
      before: async (ctx: any, next: () => Promise<void>) => {
        executionOrder.push('First:before');
        await next();
      },
      after: async (ctx: any, result: any, next: (result: any) => Promise<void>) => {
        executionOrder.push('First:after');
        await next(result);
      },
      onError: async (ctx: any, error: Error, next: (error: Error) => Promise<void>) => {
        await next(error);
      },
    };

    const middleware2 = {
      getName: () => 'Second',
      before: async (ctx: any, next: () => Promise<void>) => {
        executionOrder.push('Second:before');
        await next();
      },
      after: async (ctx: any, result: any, next: (result: any) => Promise<void>) => {
        executionOrder.push('Second:after');
        await next(result);
      },
      onError: async (ctx: any, error: Error, next: (error: Error) => Promise<void>) => {
        await next(error);
      },
    };

    pipeline.use(middleware1);
    pipeline.use(middleware2);

    const saga = createMockSaga();
    const event = createMockEvent();
    const context = createMockContext();
    const operation = vi.fn().mockResolvedValue({ success: true });

    await pipeline.execute(saga, event, context, 'testStep', operation);

    expect(executionOrder).toEqual([
      'First:before',
      'Second:before',
      'Second:after',
      'First:after',
    ]);
    expect(operation).toHaveBeenCalled();
  });

  it('should handle errors through middleware', async () => {
    const errorOrder: string[] = [];
    const testError = new Error('Operation failed');

    const middleware1 = {
      getName: () => 'First',
      before: async (ctx: any, next: () => Promise<void>) => {
        await next();
      },
      after: async (ctx: any, result: any, next: (result: any) => Promise<void>) => {
        await next(result);
      },
      onError: async (ctx: any, error: Error, next: (error: Error) => Promise<void>) => {
        errorOrder.push('First:error');
        await next(error);
      },
    };

    const middleware2 = {
      getName: () => 'Second',
      before: async (ctx: any, next: () => Promise<void>) => {
        await next();
      },
      after: async (ctx: any, result: any, next: (result: any) => Promise<void>) => {
        await next(result);
      },
      onError: async (ctx: any, error: Error, next: (error: Error) => Promise<void>) => {
        errorOrder.push('Second:error');
        await next(error);
      },
    };

    pipeline.use(middleware1);
    pipeline.use(middleware2);

    const saga = createMockSaga();
    const event = createMockEvent();
    const context = createMockContext();
    const operation = vi.fn().mockRejectedValue(testError);

    const [executeError] = await safeRun(() =>
      pipeline.execute(saga, event, context, 'testStep', operation)
    );
    expect(executeError?.message).toBe('Operation failed');

    expect(errorOrder).toEqual(['Second:error', 'First:error']);
  });

  it('should filter middleware based on shouldApply', async () => {
    const appliedMiddleware: string[] = [];

    const middleware1 = {
      getName: () => 'AlwaysApply',
      shouldApply: () => true,
      before: async (ctx: any, next: () => Promise<void>) => {
        appliedMiddleware.push('AlwaysApply');
        await next();
      },
      after: async (ctx: any, result: any, next: (result: any) => Promise<void>) => {
        await next(result);
      },
      onError: async (ctx: any, error: Error, next: (error: Error) => Promise<void>) => {
        await next(error);
      },
    };

    const middleware2 = {
      getName: () => 'NeverApply',
      shouldApply: () => false,
      before: async (ctx: any, next: () => Promise<void>) => {
        appliedMiddleware.push('NeverApply');
        await next();
      },
      after: async (ctx: any, result: any, next: (result: any) => Promise<void>) => {
        await next(result);
      },
      onError: async (ctx: any, error: Error, next: (error: Error) => Promise<void>) => {
        await next(error);
      },
    };

    pipeline.use(middleware1);
    pipeline.use(middleware2);

    const saga = createMockSaga();
    const event = createMockEvent();
    const context = createMockContext();
    const operation = vi.fn().mockResolvedValue({ success: true });

    await pipeline.execute(saga, event, context, 'testStep', operation);

    expect(appliedMiddleware).toEqual(['AlwaysApply']);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Executing middleware pipeline',
      expect.objectContaining({
        totalMiddlewares: 2,
        applicableMiddlewares: 1,
        middlewareNames: ['AlwaysApply'],
      })
    );
  });

  it('should clear all middleware', () => {
    pipeline.use(new PerformanceMonitoringMiddleware());
    pipeline.use(new RetryMiddleware());

    expect(pipeline.getMiddlewareNames()).toHaveLength(2);

    pipeline.clear();

    expect(pipeline.getMiddlewareNames()).toHaveLength(0);
    expect(mockLogger.debug).toHaveBeenCalledWith('Middleware pipeline cleared');
  });
});
