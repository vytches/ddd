import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';
import { CircuitBreakerCapability } from '../../src';
import { ProjectionError } from '../../src/projection-errors';
import type { ICapabilityContext, ICircuitBreakerConfig } from '../../src/projection-interfaces';
import { CircuitState } from '../../src/projection-interfaces';

// Mock context implementation
class MockContext implements ICapabilityContext<any> {
  constructor(private projectionName: string) {}

  getProjectionName(): string {
    return this.projectionName;
  }

  getStore(): any {
    return null;
  }

  async executeHooks(_hookName: string, ..._args: any[]): Promise<void> {
    // Mock hook execution
  }
}

describe('CircuitBreakerCapability', () => {
  let capability: CircuitBreakerCapability<any>;
  let context: MockContext;
  let config: ICircuitBreakerConfig;

  const createMockEvent = (): IExtendedDomainEvent => ({
    eventType: 'TestEvent',
    payload: { data: 'test' },
    metadata: {
      aggregateId: 'test-123',
      aggregateType: 'TestAggregate',
      eventVersion: 1,
      eventId: 'event-123',
      timestamp: new Date(),
    },
  });

  beforeEach(() => {
    config = {
      failureThreshold: 3,
      recoveryTimeoutMs: 1000,
      halfOpenMaxAttempts: 2,
    };

    context = new MockContext('TestProjection');
    capability = new CircuitBreakerCapability(config);
    capability.attach(context);
  });

  describe('initialization', () => {
    it('should initialize with CLOSED state', () => {
      expect(capability.getState()).toBe(CircuitState.CLOSED);
      expect(capability.type).toBe('circuitBreaker');
    });

    it('should accept configuration', () => {
      const customConfig = {
        failureThreshold: 5,
        recoveryTimeoutMs: 2000,
        halfOpenMaxAttempts: 3,
      };

      const customCapability = new CircuitBreakerCapability(customConfig);
      expect(customCapability.type).toBe('circuitBreaker');
    });
  });

  describe('state transitions', () => {
    it('should transition to OPEN after failure threshold is reached', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      // Act - trigger failures up to threshold
      for (let i = 0; i < config.failureThreshold; i++) {
        await capability.onError(error);
      }

      // Assert
      expect(capability.getState()).toBe(CircuitState.OPEN);
    });

    it('should remain CLOSED when failures are below threshold', async () => {
      // Arrange
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      // Act - trigger failures below threshold
      for (let i = 0; i < config.failureThreshold - 1; i++) {
        await capability.onError(error);
      }

      // Assert
      expect(capability.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      // Act - trigger circuit to open
      for (let i = 0; i < config.failureThreshold; i++) {
        await capability.onError(error);
      }
      expect(capability.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(config.recoveryTimeoutMs + 100);

      // Attempt to process - should transition to HALF_OPEN
      await capability.onBeforeApply(state, event);

      // Assert
      expect(capability.getState()).toBe(CircuitState.HALF_OPEN);

      vi.useRealTimers();
    });

    it('should transition from HALF_OPEN to CLOSED after successful attempts', async () => {
      // Arrange - get to HALF_OPEN state
      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      for (let i = 0; i < config.failureThreshold; i++) {
        await capability.onError(error);
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(config.recoveryTimeoutMs + 100);
      await capability.onBeforeApply(state, event);
      expect(capability.getState()).toBe(CircuitState.HALF_OPEN);

      // Act - succeed enough times to close circuit
      for (let i = 0; i < config.halfOpenMaxAttempts; i++) {
        await capability.onAfterApply(state, event);
      }

      // Assert
      expect(capability.getState()).toBe(CircuitState.CLOSED);

      vi.useRealTimers();
    });

    it('should transition from HALF_OPEN back to OPEN on error', async () => {
      // Arrange - get to HALF_OPEN state
      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      for (let i = 0; i < config.failureThreshold; i++) {
        await capability.onError(error);
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(config.recoveryTimeoutMs + 100);
      await capability.onBeforeApply(state, event);
      expect(capability.getState()).toBe(CircuitState.HALF_OPEN);

      // Act - fail during half-open
      await capability.onError(error);

      // Assert
      expect(capability.getState()).toBe(CircuitState.OPEN);

      vi.useRealTimers();
    });
  });

  describe('error handling', () => {
    it('should throw error when circuit is OPEN', async () => {
      // Arrange - open the circuit
      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      for (let i = 0; i < config.failureThreshold; i++) {
        await capability.onError(error);
      }
      expect(capability.getState()).toBe(CircuitState.OPEN);

      // Act & Assert
      await expect(capability.onBeforeApply(state, event)).rejects.toThrow(
        'Circuit breaker OPEN for projection TestProjection'
      );
    });

    it('should allow processing when circuit is CLOSED', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent();

      // Act & Assert - should not throw
      await expect(capability.onBeforeApply(state, event)).resolves.toBeUndefined();
    });

    it('should allow processing when circuit is HALF_OPEN', async () => {
      // Arrange - get to HALF_OPEN state
      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      for (let i = 0; i < config.failureThreshold; i++) {
        await capability.onError(error);
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(config.recoveryTimeoutMs + 100);
      await capability.onBeforeApply(state, event);
      expect(capability.getState()).toBe(CircuitState.HALF_OPEN);

      // Act & Assert - should not throw
      await expect(capability.onBeforeApply(state, event)).resolves.toBeUndefined();

      vi.useRealTimers();
    });

    it('should reset failure count on successful operations in CLOSED state', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      // Act - have some failures, then success
      await capability.onError(error);
      await capability.onError(error);
      await capability.onAfterApply(state, event); // Success should reset

      // Have more failures - should need full threshold again
      await capability.onError(error);
      await capability.onError(error);

      // Assert - should still be CLOSED (failures were reset)
      expect(capability.getState()).toBe(CircuitState.CLOSED);

      // One more failure should reach threshold
      await capability.onError(error);
      expect(capability.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('recovery behavior', () => {
    it('should not attempt recovery before timeout', async () => {
      // Arrange - open the circuit
      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      for (let i = 0; i < config.failureThreshold; i++) {
        await capability.onError(error);
      }
      expect(capability.getState()).toBe(CircuitState.OPEN);

      // Act - try to process before timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(config.recoveryTimeoutMs - 100); // Just before timeout

      // Assert - should still throw
      await expect(capability.onBeforeApply(state, event)).rejects.toThrow();
      expect(capability.getState()).toBe(CircuitState.OPEN);

      vi.useRealTimers();
    });

    it('should handle recovery with no previous failure time', async () => {
      // Arrange - create capability and immediately check recovery
      const newCapability = new CircuitBreakerCapability(config);
      newCapability.attach(context);

      // Manually set state to OPEN without setting failure time
      (newCapability as any).state = CircuitState.OPEN;

      const state = { id: 'test', version: 1 };
      const event = createMockEvent();

      // Act & Assert - should throw because no failure time is set
      await expect(newCapability.onBeforeApply(state, event)).rejects.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('should attach and detach properly', () => {
      // Arrange
      const newCapability = new CircuitBreakerCapability(config);
      const newContext = new MockContext('NewProjection');

      // Act
      newCapability.attach(newContext);

      // Assert - should work with attached context
      expect(newCapability.type).toBe('circuitBreaker');

      // Act
      newCapability.detach?.();

      // Assert - should handle detachment
      expect(newCapability.type).toBe('circuitBreaker');
    });

    it('should handle context without projection name', async () => {
      // Arrange
      const contextWithoutName = {
        getProjectionName: () => undefined,
        getStore: () => null,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        executeHooks: async () => {},
      } as any;

      const newCapability = new CircuitBreakerCapability(config);
      newCapability.attach(contextWithoutName);

      // Open the circuit
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });
      for (let i = 0; i < config.failureThreshold; i++) {
        await newCapability.onError(error);
      }

      const state = { id: 'test', version: 1 };
      const event = createMockEvent();

      // Act & Assert - should use 'unknown' as projection name
      await expect(newCapability.onBeforeApply(state, event)).rejects.toThrow(
        'Circuit breaker OPEN for projection unknown'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle rapid state transitions', async () => {
      // Arrange
      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      vi.useFakeTimers();

      // Act - rapidly cycle through states
      // CLOSED -> OPEN
      for (let i = 0; i < config.failureThreshold; i++) {
        await capability.onError(error);
      }
      expect(capability.getState()).toBe(CircuitState.OPEN);

      // OPEN -> HALF_OPEN
      vi.advanceTimersByTime(config.recoveryTimeoutMs + 100);
      await capability.onBeforeApply(state, event);
      expect(capability.getState()).toBe(CircuitState.HALF_OPEN);

      // HALF_OPEN -> CLOSED
      for (let i = 0; i < config.halfOpenMaxAttempts; i++) {
        await capability.onAfterApply(state, event);
      }
      expect(capability.getState()).toBe(CircuitState.CLOSED);

      // CLOSED -> OPEN again
      for (let i = 0; i < config.failureThreshold; i++) {
        await capability.onError(error);
      }
      expect(capability.getState()).toBe(CircuitState.OPEN);

      vi.useRealTimers();
    });

    it('should handle concurrent operations safely', async () => {
      // Arrange
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      // Act - concurrent errors
      const errorPromises = Array.from({ length: 10 }, () => capability.onError(error));

      await Promise.all(errorPromises);

      // Assert - should be OPEN (threshold was exceeded)
      expect(capability.getState()).toBe(CircuitState.OPEN);
    });

    it('should handle zero threshold configuration', () => {
      // Arrange
      const zeroThresholdConfig = {
        failureThreshold: 0,
        recoveryTimeoutMs: 1000,
        halfOpenMaxAttempts: 1,
      };

      // Act
      const zeroThresholdCapability = new CircuitBreakerCapability(zeroThresholdConfig);
      zeroThresholdCapability.attach(context);

      // Assert - should start CLOSED
      expect(zeroThresholdCapability.getState()).toBe(CircuitState.CLOSED);
    });

    it('should handle very short recovery timeout', async () => {
      // Arrange
      const shortTimeoutConfig = {
        failureThreshold: 1,
        recoveryTimeoutMs: 1,
        halfOpenMaxAttempts: 1,
      };

      const shortTimeoutCapability = new CircuitBreakerCapability(shortTimeoutConfig);
      shortTimeoutCapability.attach(context);

      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      // Act - open circuit
      await shortTimeoutCapability.onError(error);
      expect(shortTimeoutCapability.getState()).toBe(CircuitState.OPEN);

      // Wait minimal time and attempt recovery
      vi.useFakeTimers();
      vi.advanceTimersByTime(2);

      await shortTimeoutCapability.onBeforeApply(state, event);
      expect(shortTimeoutCapability.getState()).toBe(CircuitState.HALF_OPEN);

      vi.useRealTimers();
    });

    it('should handle multiple half-open attempts correctly', async () => {
      // Arrange
      const multiAttemptConfig = {
        failureThreshold: 1,
        recoveryTimeoutMs: 100,
        halfOpenMaxAttempts: 5,
      };

      const multiAttemptCapability = new CircuitBreakerCapability(multiAttemptConfig);
      multiAttemptCapability.attach(context);

      const state = { id: 'test', version: 1 };
      const event = createMockEvent();
      const error = new ProjectionError('Test error', {
        data: { projectionName: 'TestProjection' },
      });

      // Open circuit
      await multiAttemptCapability.onError(error);
      expect(multiAttemptCapability.getState()).toBe(CircuitState.OPEN);

      // Transition to half-open
      vi.useFakeTimers();
      vi.advanceTimersByTime(150);
      await multiAttemptCapability.onBeforeApply(state, event);
      expect(multiAttemptCapability.getState()).toBe(CircuitState.HALF_OPEN);

      // Act - perform multiple successful operations
      for (let i = 0; i < multiAttemptConfig.halfOpenMaxAttempts; i++) {
        await multiAttemptCapability.onAfterApply(state, event);

        if (i < multiAttemptConfig.halfOpenMaxAttempts - 1) {
          expect(multiAttemptCapability.getState()).toBe(CircuitState.HALF_OPEN);
        }
      }

      // Assert - should be closed after all attempts
      expect(multiAttemptCapability.getState()).toBe(CircuitState.CLOSED);

      vi.useRealTimers();
    });
  });
});
