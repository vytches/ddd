import { beforeEach, describe, expect, it } from 'vitest';
import { BaseProcessManager } from '../../src/core/base-process-manager';
import type {
  IProcessManagerContext,
  IProcessManagerEvent,
  IProcessManagerState,
  ProcessManagerResult,
} from '../../src/interfaces';
import { ProcessManagerStatus } from '../../src/interfaces';

// Test implementation of BaseProcessManager
class TestProcessManager extends BaseProcessManager {
  canHandle(event: IProcessManagerEvent): boolean {
    return event.eventType === 'TestEvent';
  }

  protected async handleSecure(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    this.setRunning();

    if (event.eventType === 'TestEvent') {
      this.updateState(
        {
          currentStep: 'processed',
          stepData: { eventId: event.id },
        },
        context.securityContext
      );

      return this.createSuccessResult();
    }

    return this.createFailureResult('Unknown event type');
  }

  isComplete(): boolean {
    return this.state.currentStep === 'completed';
  }

  getCorrelationData(): Record<string, unknown> {
    return {
      processId: this.id,
      type: this.type,
    };
  }
}

describe('BaseProcessManager', () => {
  let processManager: TestProcessManager;
  let initialState: IProcessManagerState;

  beforeEach(() => {
    initialState = {
      currentStep: 'initial',
      stepData: {},
      version: 0,
      lastModified: new Date(),
      correlationData: {},
    };

    processManager = new TestProcessManager({
      id: 'test-pm-1',
      type: 'TestProcessManager',
      initialState,
    });
  });

  describe('initialization', () => {
    it('should initialize with correct properties', () => {
      expect(processManager.id).toBe('test-pm-1');
      expect(processManager.type).toBe('TestProcessManager');
      expect(processManager.status).toBe(ProcessManagerStatus.CREATED);
      expect(processManager.state.currentStep).toBe('initial');
      expect(processManager.state.version).toBe(0);
    });

    it('should have created and updated timestamps', () => {
      expect(processManager.createdAt).toBeInstanceOf(Date);
      expect(processManager.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('state management', () => {
    it('should update state correctly', () => {
      const newStepData = { test: 'value' };
      const originalVersion = processManager.state.version;

      processManager.updateState({
        currentStep: 'updated',
        stepData: newStepData,
      });

      expect(processManager.state.currentStep).toBe('updated');
      expect(processManager.state.stepData).toEqual(newStepData);
      expect(processManager.state.version).toBe(originalVersion + 1);
    });

    it('should maintain state immutability', () => {
      const originalState = processManager.state;
      processManager.updateState({ currentStep: 'new-step' });

      // Original state reference should be different
      expect(processManager.state).not.toBe(originalState);
      expect(originalState.currentStep).toBe('initial');
    });
  });

  describe('status management', () => {
    it('should complete process correctly', () => {
      processManager.complete();

      expect(processManager.status).toBe(ProcessManagerStatus.COMPLETED);
    });

    it('should fail process correctly', () => {
      const error = new Error('Test error');

      processManager.fail(error);

      expect(processManager.status).toBe(ProcessManagerStatus.FAILED);
    });
  });

  describe('timeout handling', () => {
    it('should not be timed out when no timeout is set', () => {
      expect(processManager.isTimedOut()).toBe(false);
    });

    it('should detect timeout when set', () => {
      const timeoutManager = new TestProcessManager({
        id: 'timeout-pm',
        type: 'TestProcessManager',
        initialState,
        createdAt: new Date(Date.now() - 2000), // Created 2 seconds ago
        timeout: 1000, // 1 second timeout
      });

      expect(timeoutManager.isTimedOut()).toBe(true);
    });

    it('should not be timed out within timeout window', () => {
      const timeoutManager = new TestProcessManager({
        id: 'timeout-pm',
        type: 'TestProcessManager',
        initialState,
        createdAt: new Date(), // Created now
        timeout: 5000, // 5 second timeout
      });

      expect(timeoutManager.isTimedOut()).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should handle supported events', async () => {
      const event: IProcessManagerEvent = {
        id: 'event-1',
        eventType: 'TestEvent',
        eventName: 'TestEvent',
        payload: { test: 'data' },
        aggregateId: 'agg-1',
        aggregateType: 'TestAggregate',
        aggregateVersion: 1,
        timestamp: new Date(),
        correlationId: 'corr-1',
        causationId: 'cause-1',
        metadata: {},
      };

      const context: IProcessManagerContext = {
        correlationId: 'corr-1',
        processedAt: new Date(),
      };

      const result = await processManager.handle(event, context);

      expect(result.success).toBe(true);
      expect(processManager.status).toBe(ProcessManagerStatus.RUNNING);
      expect(processManager.state.currentStep).toBe('processed');
    });

    it('should identify handleable events', () => {
      const handlableEvent: IProcessManagerEvent = {
        id: 'event-1',
        eventType: 'TestEvent',
        eventName: 'TestEvent',
        payload: {},
        aggregateId: 'agg-1',
        aggregateType: 'TestAggregate',
        aggregateVersion: 1,
        timestamp: new Date(),
        correlationId: 'corr-1',
        causationId: 'cause-1',
        metadata: {},
      };

      const nonHandlableEvent: IProcessManagerEvent = {
        ...handlableEvent,
        eventType: 'OtherEvent',
        eventName: 'OtherEvent',
      };

      expect(processManager.canHandle(handlableEvent)).toBe(true);
      expect(processManager.canHandle(nonHandlableEvent)).toBe(false);
    });
  });

  describe('correlation data', () => {
    it('should provide correlation data', () => {
      const correlationData = processManager.getCorrelationData();

      expect(correlationData).toEqual({
        processId: 'test-pm-1',
        type: 'TestProcessManager',
      });
    });
  });

  describe('result helpers', () => {
    it('should create success results', () => {
      const commands = [{ type: 'TestCommand', payload: { test: 'data' } }];
      const events = [{ eventType: 'TestEvent', payload: { test: 'data' } }];

      const result = (processManager as any).createSuccessResult(commands, events, false);

      expect(result.success).toBe(true);
      expect(result.commands).toEqual(commands);
      expect(result.events).toEqual(events);
      expect(result.shouldContinue).toBe(false);
    });

    it('should create failure results', () => {
      const result = (processManager as any).createFailureResult('Test error', 'TEST_ERROR', {
        detail: 'test',
      });

      expect(result.success).toBe(false);
      expect(result.shouldContinue).toBe(false);
      expect(result.error?.message).toBe('Test error');
      expect(result.error?.code).toBe('TEST_ERROR');
      expect(result.error?.details).toEqual({ detail: 'test' });
    });
  });
});
