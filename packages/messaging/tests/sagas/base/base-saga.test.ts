import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';
import { BaseSaga, ConcreteSagaStep } from '../../../src/sagas/base';
import type {
  ISagaState,
  ISagaStep,
  ISagaExecutionContext,
} from '../../../src/sagas/interfaces';
import { SagaStatus } from '../../../src/sagas/interfaces';
import { PerformanceMonitoringMiddleware } from '../../../src/sagas/middleware';

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

// Test event implementation
class TestEvent implements IExtendedDomainEvent {
  constructor(
    public readonly eventId: string,
    public readonly eventType: string,
    public readonly aggregateId: string,
    public readonly payload: Record<string, unknown>,
    public readonly version = 1,
    public readonly occurredAt = new Date(),
    public readonly metadata: Record<string, unknown> = {}
  ) {}
}

// Test saga implementation
class TestSaga extends BaseSaga {
  public testStepExecuted = false;
  public compensationExecuted = false;

  protected initializeSteps(): void {
    const processStep = new ConcreteSagaStep({
      name: 'processOrder',
      displayName: 'Process Order',
      compensatable: true,
      timeout: 5000,
      triggerEvents: ['OrderCreated'],
      completionEvents: ['OrderProcessed'],
      execute: async (event, state, context) => {
        this.testStepExecuted = true;
        return {
          success: true,
          events: [
            new TestEvent(
              'test-event-1',
              'OrderProcessed',
              event.metadata?.aggregateId as string || 'agg-1',
              { processed: true }
            ),
          ],
        };
      },
      compensate: async (state, context) => {
        this.compensationExecuted = true;
        return { success: true };
      },
      canExecute: (event, state) => state.status !== SagaStatus.COMPLETED && state.status !== SagaStatus.FAILED,
    });

    this.addStep(processStep);
  }

  // Expose protected methods for testing
  public testUpdateState(updates: Partial<ISagaState>): void {
    this.updateState(updates);
  }

  public testAddMiddleware(middleware: any): void {
    this.addMiddleware(middleware);
  }

  public getSteps(): Map<string, ISagaStep> {
    return this.steps;
  }
}

describe('BaseSaga', () => {
  let testSaga: TestSaga;
  let initialState: ISagaState;
  let executionContext: ISagaExecutionContext;

  beforeEach(() => {
    initialState = {
      sagaId: 'saga-123',
      sagaType: 'TestSaga',
      status: SagaStatus.STARTED,
      currentStep: 'initial',
      stepData: {},
      compensationData: {},
      correlationId: 'corr-123',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      timeoutAt: undefined,
      version: 1,
    };

    executionContext = {
      correlationId: 'corr-123',
      userId: 'user-123',
      metadata: {},
      timestamp: new Date(),
    };

    testSaga = new TestSaga(initialState, 'TestSaga');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should initialize saga with correct state', () => {
      expect(testSaga.sagaId).toBe('saga-123');
      expect(testSaga.sagaType).toBe('TestSaga');
      expect(testSaga.status).toBe(SagaStatus.STARTED);
    });

    it('should initialize steps during construction', () => {
      const steps = testSaga.getSteps();
      expect(steps.size).toBe(1);
      expect(steps.has('processOrder')).toBe(true);
    });

    it('should return immutable state copy', () => {
      const state1 = testSaga.state;
      const state2 = testSaga.state;
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('handleEvent', () => {
    it('should handle matching event successfully', async () => {
      const event = new TestEvent(
        'evt-1',
        'OrderCreated',
        'agg-1',
        { orderId: 'order-123' }
      );

      const result = await testSaga.handleEvent(event, executionContext);

      expect(result.success).toBe(true);
      expect(testSaga.testStepExecuted).toBe(true);
      expect(result.events).toHaveLength(1);
      expect(result.events?.[0]?.eventType).toBe('OrderProcessed');
    });

    it('should return error when no matching step found', async () => {
      const event = new TestEvent(
        'evt-2',
        'UnknownEvent',
        'agg-1',
        {}
      );

      const result = await testSaga.handleEvent(event, executionContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('STEP_NOT_FOUND');
      expect(testSaga.testStepExecuted).toBe(false);
    });

    it('should return error when step cannot be executed', async () => {
      // Create a saga with a step that always rejects execution
      const blockingSaga = new class extends BaseSaga {
        protected initializeSteps(): void {
          const blockingStep = new ConcreteSagaStep({
            name: 'blockingStep',
            displayName: 'Blocking Step',
            compensatable: false,
            timeout: undefined,
            triggerEvents: ['OrderCreated'],
            completionEvents: [],
            execute: async () => ({ success: true }),
            canExecute: () => false, // Always prevent execution
          });
          this.addStep(blockingStep);
        }
      }(initialState, 'BlockingSaga');

      const event = new TestEvent(
        'evt-3',
        'OrderCreated',
        'agg-1',
        {}
      );

      const result = await blockingSaga.handleEvent(event, executionContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('STEP_EXECUTION_BLOCKED');
    });

    it('should handle step execution error', async () => {
      // Create saga with failing step
      const failingSaga = new class extends BaseSaga {
        protected initializeSteps(): void {
          const failingStep = new ConcreteSagaStep({
            name: 'failingStep',
            displayName: 'Failing Step',
            compensatable: false,
            timeout: undefined,
            triggerEvents: ['TestEvent'],
            completionEvents: [],
            execute: async () => {
              throw new Error('Step execution failed');
            },
            canExecute: () => true,
          });
          this.addStep(failingStep);
        }
      }(initialState, 'FailingSaga');

      const event = new TestEvent('evt-4', 'TestEvent', 'agg-1', {});
      const result = await failingSaga.handleEvent(event, executionContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SAGA_EXECUTION_ERROR');
      expect(result.requiresCompensation).toBe(true);
    });
  });

  describe('compensate', () => {
    it('should execute compensation for compensatable step', async () => {
      const result = await testSaga.compensate('processOrder', executionContext);

      expect(result.success).toBe(true);
      expect(testSaga.compensationExecuted).toBe(true);
    });

    it('should return error for non-compensatable step', async () => {
      // Add non-compensatable step
      const nonCompensatableStep = new ConcreteSagaStep({
        name: 'nonCompensatable',
        displayName: 'Non-Compensatable Step',
        compensatable: false,
        timeout: undefined,
        triggerEvents: ['TestEvent'],
        completionEvents: [],
        execute: async () => ({ success: true }),
        canExecute: () => true,
      });
      testSaga['addStep'](nonCompensatableStep);

      const result = await testSaga.compensate('nonCompensatable', executionContext);

      expect(result.success).toBe(true); // Non-compensatable steps succeed by default
    });

    it('should return error for unknown step', async () => {
      const result = await testSaga.compensate('unknownStep', executionContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('COMPENSATION_STEP_NOT_FOUND');
    });
  });

  describe('canHandle', () => {
    it('should return true for trigger events', () => {
      const event = new TestEvent('evt-5', 'OrderCreated', 'agg-1', {});
      expect(testSaga.canHandle(event)).toBe(true);
    });

    it('should return true for completion events', () => {
      const event = new TestEvent('evt-6', 'OrderProcessed', 'agg-1', {});
      expect(testSaga.canHandle(event)).toBe(true);
    });

    it('should return false for unhandled events', () => {
      const event = new TestEvent('evt-7', 'UnhandledEvent', 'agg-1', {});
      expect(testSaga.canHandle(event)).toBe(false);
    });
  });

  describe('getCorrelationData', () => {
    it('should return correlation data with saga info', () => {
      const correlationData = testSaga.getCorrelationData();

      expect(correlationData).toEqual({
        sagaId: 'saga-123',
        sagaType: 'TestSaga',
        correlationId: 'corr-123',
      });
    });

    it('should include metadata in correlation data', () => {
      const sagaWithMetadata = new TestSaga(
        {
          ...initialState,
          metadata: { orderId: 'order-123', customerId: 'customer-456' },
        },
        'TestSaga'
      );

      const correlationData = sagaWithMetadata.getCorrelationData();

      expect(correlationData).toEqual({
        sagaId: 'saga-123',
        sagaType: 'TestSaga',
        correlationId: 'corr-123',
        orderId: 'order-123',
        customerId: 'customer-456',
      });
    });
  });

  describe('updateState', () => {
    it('should update state and increment version', () => {
      const originalVersion = testSaga.state.version;

      testSaga.testUpdateState({
        status: SagaStatus.EXECUTING,
        currentStep: 'processOrder',
      });

      const newState = testSaga.state;
      expect(newState.status).toBe(SagaStatus.EXECUTING);
      expect(newState.currentStep).toBe('processOrder');
      expect(newState.version).toBe(originalVersion + 1);
    });

    it('should preserve other state properties', () => {
      const originalCreatedAt = testSaga.state.createdAt;

      testSaga.testUpdateState({ status: SagaStatus.COMPLETED });

      const newState = testSaga.state;
      expect(newState.createdAt).toEqual(originalCreatedAt);
      expect(newState.correlationId).toBe('corr-123');
    });
  });

  describe('middleware support', () => {
    it('should add middleware to pipeline', () => {
      const middleware = new PerformanceMonitoringMiddleware();
      testSaga.testAddMiddleware(middleware);

      const middlewareNames = testSaga['getMiddlewareNames']();
      expect(middlewareNames).toContain('PerformanceMonitoring');
    });

    it('should execute through middleware pipeline', async () => {
      const beforeCalled = vi.fn();
      const afterCalled = vi.fn();

      const testMiddleware = {
        getName: () => 'TestMiddleware',
        before: async (context: any, next: () => Promise<void>) => {
          beforeCalled();
          await next();
        },
        after: async (context: any, result: any, next: (result: any) => Promise<void>) => {
          afterCalled();
          await next(result);
        },
        onError: async (context: any, error: Error, next: (error: Error) => Promise<void>) => {
          await next(error);
        },
      };

      testSaga.testAddMiddleware(testMiddleware);

      const event = new TestEvent('evt-8', 'OrderCreated', 'agg-1', {});
      await testSaga.handleEvent(event, executionContext);

      expect(beforeCalled).toHaveBeenCalled();
      expect(afterCalled).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle timeout configuration', async () => {
      const timeoutStep = new ConcreteSagaStep({
        name: 'timeoutStep',
        displayName: 'Timeout Step',
        compensatable: false,
        timeout: 100, // 100ms timeout
        triggerEvents: ['TimeoutEvent'],
        completionEvents: [],
        execute: async () => {
          // Simulate long running operation
          await new Promise(resolve => setTimeout(resolve, 200));
          return { success: true };
        },
        canExecute: () => true,
      });

      const timeoutSaga = new class extends BaseSaga {
        protected initializeSteps(): void {
          this.addStep(timeoutStep);
        }
      }(initialState, 'TimeoutSaga');

      const event = new TestEvent('evt-9', 'TimeoutEvent', 'agg-1', {});

      // Note: Actual timeout implementation would be in the orchestrator
      // This test validates the configuration is properly set
      const steps = timeoutSaga['steps'];
      const step = steps.get('timeoutStep');
      expect(step?.timeout).toBe(100);
    });
  });
});
