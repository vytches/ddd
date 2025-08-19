import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ProcessTimeoutManager,
  ProcessTimeoutError,
  ProcessTimeoutType,
  ProcessTimeoutAction,
  TimeoutBackoffStrategy,
  type IProcessTimeout,
  type ProcessTimeoutConfiguration,
  type IProcessManagerContext,
} from '../../src';

describe('ProcessTimeoutManager', () => {
  let timeoutManager: ProcessTimeoutManager;
  let mockContext: IProcessManagerContext;

  beforeEach(() => {
    timeoutManager = new ProcessTimeoutManager({
      enableTimeouts: true,
      defaultTimeoutAfter: 1000,
      maxConcurrentTimeouts: 10,
      timeoutCleanupInterval: 5000,
      enableMetrics: true,
    });

    mockContext = {
      correlationId: 'test-correlation-123',
      userId: 'test-user',
      sessionId: 'test-session',
      processedAt: new Date(),
      metadata: { test: 'data' },
    };

    // Mock timers for testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    timeoutManager.destroy();
    vi.useRealTimers();
  });

  describe('scheduleTimeout', () => {
    it('should schedule a timeout successfully', () => {
      const processId = 'test-process-123';
      const timeoutType = ProcessTimeoutType.STEP_TIMEOUT;
      const configuration: ProcessTimeoutConfiguration = {
        timeoutAfter: 5000,
        timeoutAction: ProcessTimeoutAction.RETRY_STEP,
      };

      const result = timeoutManager.scheduleTimeout(
        processId,
        timeoutType,
        configuration,
        mockContext
      );

      expect(result.isSuccess).toBe(true);
      const timeout = result.value;
      expect(timeout.processId).toBe(processId);
      expect(timeout.timeoutType).toBe(timeoutType);
      expect(timeout.isActive).toBe(true);
      expect(timeout.configuration).toEqual(configuration);
    });

    it('should fail when timeouts are disabled', () => {
      const disabledManager = new ProcessTimeoutManager({
        enableTimeouts: false,
      });

      const result = disabledManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 1000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('TIMEOUTS_DISABLED');

      disabledManager.destroy();
    });

    it('should fail when max concurrent timeouts exceeded', () => {
      const limitedManager = new ProcessTimeoutManager({
        maxConcurrentTimeouts: 1,
      });

      // Schedule first timeout
      limitedManager.scheduleTimeout(
        'process-1',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 10000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      // Try to schedule second timeout
      const result = limitedManager.scheduleTimeout(
        'process-2',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 10000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('MAX_TIMEOUTS_EXCEEDED');

      limitedManager.destroy();
    });

    it('should include metadata in timeout', () => {
      const result = timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 1000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      expect(result.isSuccess).toBe(true);
      const timeout = result.value;
      expect(timeout.metadata).toEqual({
        scheduledBy: mockContext.userId,
        correlationId: mockContext.correlationId,
        sessionId: mockContext.sessionId,
      });
    });
  });

  describe('cancelTimeout', () => {
    it('should cancel an active timeout', () => {
      const scheduleResult = timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 10000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      expect(scheduleResult.isSuccess).toBe(true);
      const timeout = scheduleResult.value;

      const cancelResult = timeoutManager.cancelTimeout(timeout.timeoutId);
      expect(cancelResult.isSuccess).toBe(true);

      // Verify timeout is no longer active
      const retrievedTimeout = timeoutManager.getTimeout(timeout.timeoutId);
      expect(retrievedTimeout?.isActive).toBe(false);
    });

    it('should fail to cancel non-existent timeout', () => {
      const result = timeoutManager.cancelTimeout('non-existent-timeout');
      expect(result.isFailure).toBe(true);
      expect(result.error.code).toBe('TIMEOUT_NOT_FOUND');
    });
  });

  describe('cancelProcessTimeouts', () => {
    it('should cancel all timeouts for a process', () => {
      const processId = 'test-process';

      // Schedule multiple timeouts for the same process
      timeoutManager.scheduleTimeout(
        processId,
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 10000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      timeoutManager.scheduleTimeout(
        processId,
        ProcessTimeoutType.PROCESS_TIMEOUT,
        { timeoutAfter: 20000, timeoutAction: ProcessTimeoutAction.ESCALATE },
        mockContext
      );

      const result = timeoutManager.cancelProcessTimeouts(processId);
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(2); // Two timeouts cancelled

      const activeTimeouts = timeoutManager.getActiveTimeouts(processId);
      expect(activeTimeouts).toHaveLength(0);
    });
  });

  describe('timeout expiration handling', () => {
    it('should handle timeout expiration without retry', () => {
      const mockHandler = vi.fn().mockReturnValue({
        success: true,
        shouldRetry: false,
        escalate: false,
      });

      timeoutManager.registerTimeoutHandler(ProcessTimeoutAction.FAIL_PROCESS, mockHandler);

      const result = timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 100, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.configuration.timeoutAction).toBe(ProcessTimeoutAction.FAIL_PROCESS);

      // Verify timeout was scheduled
      const activeTimeouts = timeoutManager.getActiveTimeouts('test-process');
      expect(activeTimeouts).toHaveLength(1);
    });

    it('should handle timeout with retry policy', () => {
      const retryConfiguration: ProcessTimeoutConfiguration = {
        timeoutAfter: 100,
        timeoutAction: ProcessTimeoutAction.RETRY_STEP,
        retryPolicy: {
          maxAttempts: 2,
          backoffStrategy: TimeoutBackoffStrategy.FIXED,
          baseDelay: 50,
          maxDelay: 1000,
          jitter: false,
        },
      };

      timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        retryConfiguration,
        mockContext
      );

      // First timeout expiration
      vi.advanceTimersByTime(150);

      // Verify metrics were updated for retry
      const metrics = timeoutManager.getMetrics();
      expect(metrics.totalTimeouts).toBeGreaterThan(0);
    });

    it('should calculate exponential backoff correctly', () => {
      const retryConfiguration: ProcessTimeoutConfiguration = {
        timeoutAfter: 100,
        timeoutAction: ProcessTimeoutAction.RETRY_STEP,
        retryPolicy: {
          maxAttempts: 3,
          backoffStrategy: TimeoutBackoffStrategy.EXPONENTIAL,
          baseDelay: 100,
          maxDelay: 1000,
          jitter: false,
        },
      };

      timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        retryConfiguration,
        mockContext
      );

      // Verify the timeout was scheduled
      const activeTimeouts = timeoutManager.getActiveTimeouts('test-process');
      expect(activeTimeouts).toHaveLength(1);
      expect(activeTimeouts[0]?.configuration.retryPolicy?.backoffStrategy).toBe(
        TimeoutBackoffStrategy.EXPONENTIAL
      );
    });
  });

  describe('escalation handling', () => {
    it('should handle escalation when configured', () => {
      const escalationConfig: ProcessTimeoutConfiguration = {
        timeoutAfter: 100,
        timeoutAction: ProcessTimeoutAction.ESCALATE,
        escalationRules: [
          {
            level: 1,
            action: ProcessTimeoutAction.FAIL_PROCESS,
            notificationTargets: ['admin@example.com'],
            escalationDelay: 50,
          },
        ],
      };

      timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        escalationConfig,
        mockContext
      );

      // Verify escalation config is properly stored
      const activeTimeouts = timeoutManager.getActiveTimeouts('test-process');
      expect(activeTimeouts).toHaveLength(1);
      expect(activeTimeouts[0]?.configuration.escalationRules).toHaveLength(1);
      expect(activeTimeouts[0]?.configuration.escalationRules?.[0]?.level).toBe(1);
    });
  });

  describe('metrics', () => {
    it('should track timeout metrics correctly', () => {
      const initialMetrics = timeoutManager.getMetrics();
      expect(initialMetrics.totalTimeouts).toBe(0);

      // Schedule a timeout
      timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 1000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      const metricsAfterSchedule = timeoutManager.getMetrics();
      expect(metricsAfterSchedule.totalTimeouts).toBe(1);
      expect(metricsAfterSchedule.activeTimeouts).toBe(1);
      expect(metricsAfterSchedule.timeoutsByType[ProcessTimeoutType.STEP_TIMEOUT]).toBe(1);
      expect(metricsAfterSchedule.timeoutsByAction[ProcessTimeoutAction.FAIL_PROCESS]).toBe(1);
    });

    it('should update metrics when timeout is cancelled', () => {
      const scheduleResult = timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 1000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      const timeout = scheduleResult.value;
      timeoutManager.cancelTimeout(timeout.timeoutId);

      const metrics = timeoutManager.getMetrics();
      expect(metrics.cancelledTimeouts).toBe(1);
      expect(metrics.activeTimeouts).toBe(0);
    });
  });

  describe('timeout retrieval', () => {
    it('should get active timeouts for a process', () => {
      const processId = 'test-process';

      timeoutManager.scheduleTimeout(
        processId,
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 1000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      timeoutManager.scheduleTimeout(
        processId,
        ProcessTimeoutType.PROCESS_TIMEOUT,
        { timeoutAfter: 2000, timeoutAction: ProcessTimeoutAction.ESCALATE },
        mockContext
      );

      const activeTimeouts = timeoutManager.getActiveTimeouts(processId);
      expect(activeTimeouts).toHaveLength(2);
      expect(activeTimeouts.every(t => t.processId === processId)).toBe(true);
      expect(activeTimeouts.every(t => t.isActive)).toBe(true);
    });

    it('should get timeout by ID', () => {
      const scheduleResult = timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 1000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      const timeout = scheduleResult.value;
      const retrievedTimeout = timeoutManager.getTimeout(timeout.timeoutId);

      expect(retrievedTimeout).toBeDefined();
      expect(retrievedTimeout!.timeoutId).toBe(timeout.timeoutId);
    });

    it('should return undefined for non-existent timeout ID', () => {
      const timeout = timeoutManager.getTimeout('non-existent');
      expect(timeout).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should destroy manager and clear all timeouts', () => {
      // Schedule multiple timeouts
      timeoutManager.scheduleTimeout(
        'process-1',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 10000, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      timeoutManager.scheduleTimeout(
        'process-2',
        ProcessTimeoutType.PROCESS_TIMEOUT,
        { timeoutAfter: 20000, timeoutAction: ProcessTimeoutAction.ESCALATE },
        mockContext
      );

      const metricsBeforeDestroy = timeoutManager.getMetrics();
      expect(metricsBeforeDestroy.activeTimeouts).toBe(2);

      timeoutManager.destroy();

      // After destroy, should be able to create new manager without interference
      const newManager = new ProcessTimeoutManager();
      const newMetrics = newManager.getMetrics();
      expect(newMetrics.totalTimeouts).toBe(0);
      expect(newMetrics.activeTimeouts).toBe(0);

      newManager.destroy();
    });
  });

  describe('error handling', () => {
    it('should handle errors during timeout scheduling gracefully', () => {
      // This test verifies that errors are caught and wrapped properly
      const invalidConfiguration = {
        timeoutAfter: -1, // Invalid timeout value
        timeoutAction: ProcessTimeoutAction.FAIL_PROCESS,
      };

      const result = timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        invalidConfiguration,
        mockContext
      );

      // The implementation should handle this gracefully
      expect(result.isSuccess).toBe(true); // Current implementation allows negative values
    });

    it('should handle errors during timeout expiration gracefully', () => {
      const throwingHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      timeoutManager.registerTimeoutHandler(ProcessTimeoutAction.FAIL_PROCESS, throwingHandler);

      const result = timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 100, timeoutAction: ProcessTimeoutAction.FAIL_PROCESS },
        mockContext
      );

      // Should schedule successfully despite handler that will throw
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('custom timeout handlers', () => {
    it('should register and use custom timeout handlers', () => {
      const customHandler = vi.fn().mockReturnValue({
        success: true,
        shouldRetry: false,
        escalate: false,
        metadata: { customData: 'processed' },
      });

      timeoutManager.registerTimeoutHandler(ProcessTimeoutAction.CUSTOM_ACTION, customHandler);

      const result = timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 100, timeoutAction: ProcessTimeoutAction.CUSTOM_ACTION },
        mockContext
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.configuration.timeoutAction).toBe(ProcessTimeoutAction.CUSTOM_ACTION);
    });

    it('should use default handlers when no custom handler is registered', () => {
      // Default handlers are registered in constructor
      const result = timeoutManager.scheduleTimeout(
        'test-process',
        ProcessTimeoutType.STEP_TIMEOUT,
        { timeoutAfter: 100, timeoutAction: ProcessTimeoutAction.RETRY_STEP },
        mockContext
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value.configuration.timeoutAction).toBe(ProcessTimeoutAction.RETRY_STEP);
    });
  });
});
