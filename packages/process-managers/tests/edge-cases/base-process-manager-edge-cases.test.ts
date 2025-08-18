import { safeRun } from '@vytches/ddd-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import { BaseProcessManager } from '../../src/core/base-process-manager';
import type {
  IProcessManagerContext,
  IProcessManagerEvent,
  IProcessManagerState,
  ProcessManagerResult,
} from '../../src/interfaces';
import { ProcessManagerStatus } from '../../src/interfaces';
import { ProcessManagerTestHarness } from '../utils/process-manager-test-harness';
import { ConcurrencyTestHelper } from './concurrency-test-helper';

// Extended test implementation for edge case testing
class EdgeCaseTestProcessManager extends BaseProcessManager {
  private handlerErrors: Map<string, Error> = new Map();
  private processingDelays: Map<string, number> = new Map();
  private stateTransitionHooks: Array<(from: string, to: string) => void> = [];

  canHandle(event: IProcessManagerEvent): boolean {
    return [
      'TestEvent',
      'ConcurrentEvent',
      'DelayedEvent',
      'ErrorEvent',
      'TimeoutEvent',
      'StateConflictEvent',
    ].includes(event.eventType);
  }

  protected async handleSecure(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    // Check for simulated errors first
    const simulatedError = this.handlerErrors.get(event.eventType);
    if (simulatedError) {
      throw simulatedError;
    }

    // Apply processing delay if configured
    const delay = this.processingDelays.get(event.eventType);
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.setRunning();

    const previousStep = this.state.currentStep;

    switch (event.eventType) {
      case 'TestEvent':
        return this.handleTestEvent(event, context);
      case 'ConcurrentEvent':
        return this.handleConcurrentEvent(event, context);
      case 'DelayedEvent':
        return this.handleDelayedEvent(event, context);
      case 'ErrorEvent':
        return this.handleErrorEvent(event, context);
      case 'TimeoutEvent':
        return this.handleTimeoutEvent(event, context);
      case 'StateConflictEvent':
        return this.handleStateConflictEvent(event, context);
      default:
        return this.createFailureResult('Unknown event type');
    }
  }

  isComplete(): boolean {
    return this.state.currentStep === 'completed' || this.state.currentStep === 'error-completed';
  }

  getCorrelationData(): Record<string, unknown> {
    return {
      processId: this.id,
      type: this.type,
      correlationId: this.state.stepData.correlationId,
    };
  }

  // Test utility methods
  simulateHandlerError(eventType: string, error: Error): void {
    this.handlerErrors.set(eventType, error);
  }

  simulateProcessingDelay(eventType: string, delayMs: number): void {
    this.processingDelays.set(eventType, delayMs);
  }

  addStateTransitionHook(hook: (from: string, to: string) => void): void {
    this.stateTransitionHooks.push(hook);
  }

  // Force state change for testing
  forceStateChange(newStep: string, additionalData: Record<string, unknown> = {}): void {
    const previousStep = this.state.currentStep;
    this.updateState({
      currentStep: newStep,
      stepData: { ...this.state.stepData, ...additionalData },
    });

    // Notify hooks
    for (const hook of this.stateTransitionHooks) {
      try {
        hook(previousStep, newStep);
      } catch (error) {
        console.warn('State transition hook error:', error);
      }
    }
  }

  private async handleTestEvent(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.updateState({
      currentStep: 'test-processed',
      stepData: {
        eventId: event.id,
        processedAt: new Date(),
        payload: event.payload,
      },
    });

    return this.createSuccessResult();
  }

  private async handleConcurrentEvent(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    // Simulate concurrent state access
    const currentVersion = this.state.version;

    // Small delay to increase race condition probability
    await new Promise(resolve => setTimeout(resolve, Math.random() * 10));

    // Check if version changed during delay (simulated optimistic locking)
    if (this.state.version !== currentVersion) {
      return this.createFailureResult('Version conflict detected', 'VERSION_CONFLICT');
    }

    const payload = event.payload as { step: string; thread: string };
    this.updateState({
      currentStep: `concurrent-${payload.step}`,
      stepData: {
        concurrentId: event.id,
        processingThread: payload.thread,
      },
    });

    return this.createSuccessResult();
  }

  private async handleDelayedEvent(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    const payload = event.payload as { delayMs?: number };
    const delayMs = payload.delayMs || 100;

    // Simulate long-running operation
    await new Promise(resolve => setTimeout(resolve, delayMs));

    this.updateState({
      currentStep: 'delayed-processed',
      stepData: {
        delayApplied: delayMs,
        completedAt: new Date(),
      },
    });

    return this.createSuccessResult();
  }

  private async handleErrorEvent(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    const payload = event.payload as { shouldFail?: boolean; errorMessage?: string };
    if (payload.shouldFail) {
      return this.createFailureResult(
        payload.errorMessage || 'Simulated error',
        'SIMULATED_ERROR',
        payload
      );
    }

    this.updateState({
      currentStep: 'error-handled',
      stepData: {
        errorSimulated: true,
        recoveredAt: new Date(),
      },
    });

    return this.createSuccessResult();
  }

  private async handleTimeoutEvent(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    // Check if we should timeout during processing
    if (this.isTimedOut()) {
      this.setTimedOut();
      return this.createFailureResult('Process timed out during event handling', 'TIMEOUT');
    }

    this.updateState({
      currentStep: 'timeout-checked',
      stepData: {
        timeoutChecked: true,
        checkedAt: new Date(),
      },
    });

    return this.createSuccessResult();
  }

  private async handleStateConflictEvent(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    // Simulate a scenario where state updates conflict
    const payload = event.payload as { targetStep: string };
    const targetStep = payload.targetStep;
    const currentStep = this.state.currentStep;

    if (currentStep === targetStep) {
      return this.createFailureResult('State conflict: already in target step', 'STATE_CONFLICT');
    }

    this.updateState({
      currentStep: targetStep,
      stepData: {
        conflictResolved: true,
        previousStep: currentStep,
      },
    });

    return this.createSuccessResult();
  }
}

describe('BaseProcessManager Edge Cases', () => {
  let harness: ProcessManagerTestHarness;
  let processManager: EdgeCaseTestProcessManager;
  let concurrencyHelper: ConcurrencyTestHelper;

  beforeEach(async () => {
    harness = new ProcessManagerTestHarness({
      enableEventTracking: true,
      enableStateLogging: false,
      verbose: false,
    });

    await harness.initialize();
    await harness.setup();

    const initialState: IProcessManagerState = {
      currentStep: 'initial',
      stepData: {},
      version: 0,
      lastModified: new Date(),
      correlationData: {},
    };

    processManager = new EdgeCaseTestProcessManager({
      id: 'edge-case-pm',
      type: 'EdgeCaseTestProcessManager',
      initialState,
    });

    concurrencyHelper = new ConcurrencyTestHelper(harness);
  });

  afterEach(async () => {
    await harness.dispose();
  });

  describe('Concurrency Edge Cases', () => {
    it('should handle multiple simultaneous state updates', async () => {
      const operations = Array.from({ length: 5 }, (_, i) => ({
        id: `state-update-${i}`,
        type: 'state-update' as const,
        stateUpdate: { [`field${i}`]: `value${i}`, timestamp: Date.now() + i },
      }));

      const results = await concurrencyHelper.simulateConcurrentOperations(
        processManager,
        operations
      );

      // At least one should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // Version should have increased
      expect(processManager.state.version).toBeGreaterThan(0);
    });

    it('should detect race conditions in event processing', async () => {
      const events = Array.from({ length: 3 }, (_, i) =>
        harness.createTestEvent({
          eventType: 'ConcurrentEvent',
          payload: { step: i, thread: `thread-${i}` },
        })
      );

      const operations = events.map((event, i) => ({
        id: `concurrent-event-${i}`,
        type: 'event' as const,
        event,
        delayMs: Math.random() * 5, // Random small delay
      }));

      const results = await concurrencyHelper.simulateConcurrentOperations(
        processManager,
        operations
      );

      // Should have some conflicts or successful operations
      const hasConflicts = results.some(r => r.error?.message.includes('Version conflict'));
      const hasSuccesses = results.some(r => r.success);

      expect(hasSuccesses || hasConflicts).toBe(true);
    });

    it('should handle version conflicts gracefully', async () => {
      let transitionCount = 0;
      processManager.addStateTransitionHook(() => {
        transitionCount++;
      });

      // Force multiple rapid state changes
      const stateChanges = Array.from(
        { length: 10 },
        (_, i) => () => processManager.forceStateChange(`step-${i}`, { changeIndex: i })
      );

      // Execute state changes concurrently
      await Promise.all(
        stateChanges.map(
          change =>
            new Promise(resolve => {
              setTimeout(() => {
                change();
                resolve(undefined);
              }, Math.random() * 10);
            })
        )
      );

      expect(transitionCount).toBe(10);
      expect(processManager.state.version).toBe(10);
    });
  });

  describe('Timeout Edge Cases', () => {
    it('should detect timeout during event processing', async () => {
      const timeoutPM = new EdgeCaseTestProcessManager({
        id: 'timeout-pm',
        type: 'EdgeCaseTestProcessManager',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: {},
        },
        createdAt: new Date(Date.now() - 1500), // Created 1.5 seconds ago
        timeout: 1000, // 1 second timeout
      });

      const event = harness.createTestEvent({
        eventType: 'TimeoutEvent',
        payload: { checkTimeout: true },
      });

      const context = harness.createTestContext();
      const [error, result] = await safeRun(() => timeoutPM.handle(event, context));

      // Process manager should return an error result when it's timed out
      expect(error).toBeUndefined();
      expect(result?.success).toBe(false);
      expect(result?.error?.message).toContain(
        'Cannot handle events when process manager is in TIMED_OUT status'
      );
    });

    it('should handle timeout exactly at boundary', async () => {
      // Create a process manager with an already expired timeout
      const pastTime = new Date(Date.now() - 2000); // 2 seconds ago

      const timeoutPM = new EdgeCaseTestProcessManager({
        id: 'boundary-timeout-pm',
        type: 'EdgeCaseTestProcessManager',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: {},
        },
        createdAt: pastTime,
        timeout: 1000, // 1 second timeout
      });

      // Should be timed out since createdAt is 2 seconds ago and timeout is 1 second
      expect(timeoutPM.isTimedOut()).toBe(true);

      // Create one that's not timed out yet
      const recentPM = new EdgeCaseTestProcessManager({
        id: 'recent-timeout-pm',
        type: 'EdgeCaseTestProcessManager',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: {},
        },
        createdAt: new Date(), // Just created
        timeout: 10000, // 10 second timeout
      });

      expect(recentPM.isTimedOut()).toBe(false);
    });

    it.skip('should handle timeout precision under concurrent operations', async () => {
      // Create a process manager with timeout
      const timeoutPM = new EdgeCaseTestProcessManager({
        id: 'timeout-precision-pm',
        type: 'EdgeCaseTestProcessManager',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: {},
        },
        createdAt: new Date(),
        timeout: 100, // 100ms timeout for quick test
      });

      const result = await concurrencyHelper.testTimeoutPrecision(timeoutPM, 100, 50);

      expect(result.withinTolerance).toBe(true);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle errors during event processing', async () => {
      const testError = new Error('Critical processing error');
      processManager.simulateHandlerError('ErrorEvent', testError);

      const event = harness.createTestEvent({
        eventType: 'ErrorEvent',
        payload: { shouldFail: false }, // Error will come from simulation
      });

      const context = harness.createTestContext();
      const [error, result] = await safeRun(() => processManager.handle(event, context));

      // Errors are now returned as a failure result due to security
      expect(error).toBeUndefined();
      expect(result?.success).toBe(false);
      expect(result?.error?.message).toBe('Critical processing error');
      expect(processManager.status).toBe(ProcessManagerStatus.CREATED); // Status doesn't change when error thrown early
    });

    it('should handle business logic errors gracefully', async () => {
      const event = harness.createTestEvent({
        eventType: 'ErrorEvent',
        payload: {
          shouldFail: true,
          errorMessage: 'Business rule violation',
        },
      });

      const context = harness.createTestContext();
      const [error, result] = await safeRun(() => processManager.handle(event, context));

      expect(error).toBeUndefined();
      expect(result?.success).toBe(false);
      expect(result?.error?.message).toBe('Business rule violation');
      expect(result?.error?.code).toBe('SIMULATED_ERROR');
    });

    it('should handle multiple error scenarios', async () => {
      const errorEvents = [
        { shouldFail: true, errorMessage: 'Error 1' },
        { shouldFail: false },
        { shouldFail: true, errorMessage: 'Error 2' },
      ];

      const results: ProcessManagerResult[] = [];

      for (const payload of errorEvents) {
        const event = harness.createTestEvent({
          eventType: 'ErrorEvent',
          payload,
        });

        const context = harness.createTestContext();
        const [error, result] = await safeRun(() => processManager.handle(event, context));

        expect(error).toBeUndefined();
        if (result) {
          results.push(result);
        }
      }

      expect(results.length).toBe(3);
      expect(results[0]?.success).toBe(false);
      expect(results[1]?.success).toBe(true);
      expect(results[2]?.success).toBe(false);
    });

    it('should fail process manager correctly', async () => {
      const testError = new Error('Critical failure');
      processManager.fail(testError);

      expect(processManager.status).toBe(ProcessManagerStatus.FAILED);

      // Should not handle events when failed
      const event = harness.createTestEvent({ eventType: 'TestEvent' });
      const context = harness.createTestContext();

      const [error, result] = await safeRun(() => processManager.handle(event, context));
      expect(error).toBeUndefined();
      expect(result?.success).toBe(false);
      expect(result?.error?.message).toContain(
        'Cannot handle events when process manager is in FAILED status'
      );
    });
  });

  describe('State Management Edge Cases', () => {
    it('should handle rapid state transitions', async () => {
      const transitions = 100;
      const startTime = Date.now();

      for (let i = 0; i < transitions; i++) {
        processManager.updateState({
          currentStep: `step-${i}`,
          stepData: { iteration: i, timestamp: Date.now() },
        });
      }

      const endTime = Date.now();

      expect(processManager.state.version).toBe(transitions);
      expect(processManager.state.currentStep).toBe(`step-${transitions - 1}`);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });

    it('should maintain state immutability', async () => {
      const originalState = processManager.state;
      const originalStepData = processManager.state.stepData;

      processManager.updateState({
        currentStep: 'new-step',
        stepData: { newField: 'newValue' },
      });

      // Original references should not change
      expect(processManager.state).not.toBe(originalState);
      expect(processManager.state.stepData).not.toBe(originalStepData);

      // Original data should remain unchanged
      expect(originalState.currentStep).toBe('initial');
      expect(originalStepData.newField).toBeUndefined();
    });

    it('should handle version overflow edge case', async () => {
      // Set version to near max safe integer
      const nearMaxVersion = Number.MAX_SAFE_INTEGER - 5;
      (processManager as any)._state.version = nearMaxVersion;

      // Perform several updates
      for (let i = 0; i < 10; i++) {
        processManager.updateState({
          stepData: { update: i },
        });
      }

      // Should handle gracefully (implementation dependent)
      expect(processManager.state.version).toBeGreaterThan(nearMaxVersion);
    });

    it('should handle state conflicts in business logic', async () => {
      // Set initial state
      processManager.forceStateChange('conflict-test');

      const event1 = harness.createTestEvent({
        eventType: 'StateConflictEvent',
        payload: { targetStep: 'conflict-test' }, // Same as current
      });

      const event2 = harness.createTestEvent({
        eventType: 'StateConflictEvent',
        payload: { targetStep: 'new-step' }, // Different
      });

      const context = harness.createTestContext();

      // First event should conflict
      const [error1, result1] = await safeRun(() => processManager.handle(event1, context));
      expect(error1).toBeUndefined();
      expect(result1?.success).toBe(false);
      expect(result1?.error?.code).toBe('STATE_CONFLICT');

      // Second event should succeed
      const [error2, result2] = await safeRun(() => processManager.handle(event2, context));
      expect(error2).toBeUndefined();
      expect(result2?.success).toBe(true);
      expect(processManager.state.currentStep).toBe('new-step');
    });
  });

  describe('Async Behavior Edge Cases', () => {
    it('should handle long-running async operations', async () => {
      const delayMs = 200;

      const event = harness.createTestEvent({
        eventType: 'DelayedEvent',
        payload: { delayMs },
      });

      const context = harness.createTestContext();
      const startTime = performance.now(); // Use performance.now() for better precision

      const [error, result] = await safeRun(() => processManager.handle(event, context));

      const executionTime = performance.now() - startTime;

      expect(error).toBeUndefined();
      expect(result?.success).toBe(true);
      expect(processManager.state.currentStep).toBe('delayed-processed');
      expect(processManager.state.stepData.delayApplied).toBe(delayMs);
      // Check that some delay occurred (but be lenient about exact timing)
      expect(executionTime).toBeGreaterThan(50); // At least some delay happened
    });

    it('should handle async operations with timeouts', async () => {
      const timeoutPM = new EdgeCaseTestProcessManager({
        id: 'async-timeout-pm',
        type: 'EdgeCaseTestProcessManager',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: {},
        },
        createdAt: new Date(Date.now() - 1100), // Created 1100ms ago (already timed out)
        timeout: 1000, // 1 second timeout
      });

      // Should be timed out before we even start
      expect(timeoutPM.isTimedOut()).toBe(true);

      const event = harness.createTestEvent({
        eventType: 'DelayedEvent',
        payload: { delayMs: 50 },
      });

      const context = harness.createTestContext();
      const [error, result] = await safeRun(() => timeoutPM.handle(event, context));

      // Should fail because process manager is timed out
      expect(error).toBeUndefined();
      expect(result?.success).toBe(false);
      expect(result?.error?.message).toContain(
        'Cannot handle events when process manager is in TIMED_OUT status'
      );
    });

    it('should handle Promise rejection in handlers', async () => {
      const rejectionError = new Error('Async operation failed');
      processManager.simulateHandlerError('TestEvent', rejectionError);

      const event = harness.createTestEvent({
        eventType: 'TestEvent',
        payload: { test: true },
      });

      const context = harness.createTestContext();
      const [error, result] = await safeRun(() => processManager.handle(event, context));

      // Errors are now returned as failure results
      expect(error).toBeUndefined();
      expect(result?.success).toBe(false);
      expect(result?.error?.message).toBe('Async operation failed');
    });
  });

  describe('Resource Management Edge Cases', () => {
    it('should handle memory pressure scenarios', async () => {
      const largeDataSize = 1000;
      const events = Array.from({ length: largeDataSize }, (_, i) =>
        harness.createTestEvent({
          eventType: 'TestEvent',
          payload: {
            index: i,
            data: Array.from({ length: 100 }, (_, j) => `item-${i}-${j}`),
          },
        })
      );

      const startMemory = process.memoryUsage().heapUsed;

      // Process many events
      for (const event of events.slice(0, 100)) {
        // Process subset to avoid test timeout
        const context = harness.createTestContext();
        await processManager.handle(event, context);
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
      expect(processManager.state.version).toBe(100);
    });

    it('should handle cleanup after process completion', async () => {
      processManager.complete();

      expect(processManager.status).toBe(ProcessManagerStatus.COMPLETED);

      // Should not process events after completion
      const event = harness.createTestEvent({ eventType: 'TestEvent' });
      const context = harness.createTestContext();

      const [error, result] = await safeRun(() => processManager.handle(event, context));
      expect(error).toBeUndefined();
      expect(result?.success).toBe(false);
      expect(result?.error?.message).toContain(
        'Cannot handle events when process manager is in COMPLETED status'
      );
    });
  });
});
