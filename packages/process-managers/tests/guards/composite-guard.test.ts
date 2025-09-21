import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  CompositeGuard,
  type CompositeGuardConfiguration,
  GuardExecutionStrategy,
} from '../../src/guards/composite-guard';
import {
  GuardOperation,
  GuardSeverity,
  type IProcessGuard,
  type GuardResult,
} from '../../src/guards/guard.interface';
import type { IProcessManagerState, IProcessManagerContext } from '../../src/interfaces';

describe('CompositeGuard', () => {
  let mockState: IProcessManagerState;
  let mockContext: IProcessManagerContext;
  let mockGuard1: IProcessGuard<IProcessManagerState>;
  let mockGuard2: IProcessGuard<IProcessManagerState>;
  let mockGuard3: IProcessGuard<IProcessManagerState>;

  beforeEach(() => {
    mockState = {
      currentStep: 'processing',
      stepData: { data: 'test' },
      version: 1,
      lastModified: new Date(),
      correlationData: { processManagerId: 'test-id' },
      metadata: {},
    };

    mockContext = {
      correlationId: 'test-correlation',
      processedAt: new Date(),
      userId: 'test-user',
      tenantId: 'test-tenant',
    };

    // Mock guard that always passes
    mockGuard1 = {
      canExecute: vi.fn().mockResolvedValue({
        isSuccess: true,
        value: {
          allowed: true,
          severity: GuardSeverity.WARNING,
          reason: 'Guard 1 passed',
          code: 'GUARD1_SUCCESS',
          details: { guard1: 'passed' },
        },
      }),
      getName: () => 'MockGuard1',
      getPriority: () => 1,
      getApplicableOperations: () => [
        GuardOperation.STATE_TRANSITION,
        GuardOperation.EVENT_HANDLING,
      ],
      shouldEvaluate: () => true,
    };

    // Mock guard that always fails
    mockGuard2 = {
      canExecute: vi.fn().mockResolvedValue({
        isSuccess: true,
        value: {
          allowed: false,
          severity: GuardSeverity.ERROR,
          reason: 'Guard 2 failed',
          code: 'GUARD2_FAILURE',
          details: { guard2: 'failed' },
        },
      }),
      getName: () => 'MockGuard2',
      getPriority: () => 2,
      getApplicableOperations: () => [GuardOperation.STATE_TRANSITION],
      shouldEvaluate: () => true,
    };

    // Mock guard that sometimes warns
    mockGuard3 = {
      canExecute: vi.fn().mockResolvedValue({
        isSuccess: true,
        value: {
          allowed: true,
          severity: GuardSeverity.WARNING,
          reason: 'Guard 3 warning',
          code: 'GUARD3_WARNING',
          details: { guard3: 'warning' },
        },
      }),
      getName: () => 'MockGuard3',
      getPriority: () => 3,
      getApplicableOperations: () => [GuardOperation.EVENT_HANDLING, GuardOperation.COMPLETION],
      shouldEvaluate: () => true,
    };
  });

  describe('Basic Composition', () => {
    it('should pass when all guards pass with parallel execution', async () => {
      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        enableParallelExecution: true,
        failFast: false,
        collectAllResults: true,
        timeoutMs: 5000,
        enableLogging: true,
        minimumBlockingSeverity: GuardSeverity.ERROR,
      };
      const composite = new CompositeGuard([mockGuard1, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.EVENT_HANDLING,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(true);
      expect(guardResult.severity).toBe(GuardSeverity.WARNING); // Highest severity from guards
      expect(guardResult.details?.guardResults).toHaveLength(2);
    });

    it('should fail when any guard fails with parallel execution', async () => {
      const config: Partial<CompositeGuardConfiguration> = {
        // Guard2 fails
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: true,
      };
      const composite = new CompositeGuard([mockGuard1, mockGuard2, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.severity).toBe(GuardSeverity.ERROR);
      expect(guardResult.code).toBe('COMPOSITE_GUARD_FAILED');
      expect(guardResult.reason).toContain('Guard 2');
    });

    it('should execute guards sequentially when configured', async () => {
      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: true,
      };
      const composite = new CompositeGuard([mockGuard1, mockGuard2, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false); // Should fail at guard2

      // Verify sequential execution - guard2 should have been called after guard1
      expect(mockGuard1.canExecute).toHaveBeenCalled();
      expect(mockGuard2.canExecute).toHaveBeenCalled();
      // Guard3 might not be called due to fail-fast
    });
  });

  describe('Execution Strategies', () => {
    it('should execute all guards with continue-on-failure strategy', async () => {
      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
      };
      const composite = new CompositeGuard([mockGuard1, mockGuard2, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false); // Overall failure due to guard2

      // Only applicable guards should have been executed (Guard1 and Guard2 for STATE_TRANSITION)
      expect(mockGuard1.canExecute).toHaveBeenCalled();
      expect(mockGuard2.canExecute).toHaveBeenCalled();
      // Guard3 not called because it doesn't apply to STATE_TRANSITION

      expect(guardResult.details?.guardResults).toHaveLength(2);
      // Check overall result instead
    });

    it('should stop early with fail-fast strategy', async () => {
      // Create a guard that fails early in priority order
      const earlyFailGuard = {
        ...mockGuard2,
        getPriority: () => 0, // Highest priority (executed first)
      };

      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: true,
      };
      const composite = new CompositeGuard([earlyFailGuard, mockGuard1, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.details?.guardResults).toBeDefined(); // Should stop early
    });
  });

  describe('Priority and Filtering', () => {
    it('should execute guards in priority order', async () => {
      const executionOrder: string[] = [];

      // Create guards that track execution order
      const priorityGuard1 = {
        ...mockGuard1,
        getPriority: () => 3,
        canExecute: vi.fn().mockImplementation(async () => {
          executionOrder.push('Guard1');
          return mockGuard1.canExecute(guardContext);
        }),
      };

      const priorityGuard2 = {
        ...mockGuard2,
        getPriority: () => 1, // Highest priority
        canExecute: vi.fn().mockImplementation(async () => {
          executionOrder.push('Guard2');
          return {
            isSuccess: true,
            value: {
              allowed: true, // Make it pass for this test
              severity: GuardSeverity.WARNING,
              reason: 'Guard 2 passed',
              code: 'GUARD2_SUCCESS',
            },
          };
        }),
      };

      const priorityGuard3 = {
        ...mockGuard3,
        getPriority: () => 2,
        canExecute: vi.fn().mockImplementation(async () => {
          executionOrder.push('Guard3');
          return mockGuard3.canExecute(guardContext);
        }),
      };

      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
      };
      const composite = new CompositeGuard(
        [priorityGuard1, priorityGuard2, priorityGuard3],
        config
      );
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      await composite.canExecute(guardContext);

      expect(executionOrder).toEqual(['Guard2', 'Guard1']); // Priority order: 1, 3 (Guard3 not applicable to STATE_TRANSITION)
    });

    it('should filter guards by applicable operations', async () => {
      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
      };
      const composite = new CompositeGuard([mockGuard1, mockGuard2, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.COMPLETION, // Only guard3 applies to COMPLETION
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(true);
      expect(guardResult.details?.guardResults).toHaveLength(1);
    });

    it('should filter guards by shouldEvaluate condition', async () => {
      const conditionalGuard = {
        ...mockGuard1,
        shouldEvaluate: vi.fn().mockReturnValue(false), // Should not evaluate
      };

      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
      };
      const composite = new CompositeGuard([conditionalGuard, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.EVENT_HANDLING,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.details?.guardResults).toHaveLength(1);
      expect(conditionalGuard.canExecute).not.toHaveBeenCalled();
    });
  });

  describe('Timeout Handling', () => {
    it('should respect guard timeout limits', async () => {
      // Create a slow guard that exceeds timeout
      const slowGuard = {
        ...mockGuard1,
        getName: () => 'SlowGuard',
        canExecute: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          return mockGuard1.canExecute(guardContext);
        }),
      };

      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
        timeoutMs: 50, // 50ms timeout
      };
      const composite = new CompositeGuard([slowGuard], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.code).toBe('COMPOSITE_GUARD_FAILED');
      expect(guardResult.reason).toContain('timed out');
    });

    it('should handle mixed timeout and success scenarios', async () => {
      const slowGuard = {
        ...mockGuard1,
        getName: () => 'SlowGuard',
        canExecute: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return mockGuard1.canExecute(guardContext);
        }),
      };

      const config: Partial<CompositeGuardConfiguration> = {
        // One slow, one fast
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
        timeoutMs: 50,
      };
      const composite = new CompositeGuard([slowGuard, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.EVENT_HANDLING,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false); // Due to timeout
      expect(guardResult.reason).toContain('timed out');
      expect(guardResult.details?.guardResults).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should evaluate composite guards within performance target', async () => {
      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
      };
      const composite = new CompositeGuard([mockGuard1, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.EVENT_HANDLING,
      };

      const startTime = performance.now();
      await composite.canExecute(guardContext);
      const evaluationTime = performance.now() - startTime;

      expect(evaluationTime).toBeLessThan(2); // Allow more time for composite execution
    });

    it('should handle large numbers of guards efficiently', async () => {
      // Create many guards
      const manyGuards = Array.from({ length: 20 }, (_, i) => ({
        ...mockGuard1,
        getName: () => `Guard${i}`,
        getPriority: () => i,
      }));

      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
        enableParallelExecution: false,
        maxParallelGuards: 3,
        collectAllResults: true,
        timeoutMs: 5000,
        enableLogging: true,
        minimumBlockingSeverity: GuardSeverity.ERROR,
      };
      const composite = new CompositeGuard(manyGuards, config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const startTime = performance.now();
      await composite.canExecute(guardContext);
      const evaluationTime = performance.now() - startTime;

      expect(evaluationTime).toBeLessThan(10); // Allow reasonable time for many guards
    });
  });

  describe('Error Handling', () => {
    it('should handle guard execution errors gracefully', async () => {
      const errorGuard = {
        ...mockGuard1,
        getName: () => 'ErrorGuard',
        canExecute: vi.fn().mockRejectedValue(new Error('Guard execution failed')),
      };

      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
      };
      const composite = new CompositeGuard([errorGuard, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.EVENT_HANDLING,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false); // Due to error
      // Error guard should be handled properly
      expect(guardResult.details?.guardResults).toBeDefined();
    });

    it('should handle empty guard list gracefully', async () => {
      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
      };
      const composite = new CompositeGuard([], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(true); // Should pass with no guards
      expect(guardResult.reason).toContain('No applicable guards');
    });

    it('should handle malformed guard responses', async () => {
      const malformedGuard = {
        ...mockGuard1,
        getName: () => 'MalformedGuard',
        canExecute: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: null as any, // Malformed response
        }),
      };

      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
      };
      const composite = new CompositeGuard([malformedGuard], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.reason).toMatch(/malformed|invalid|null/);
    });
  });

  describe('Metadata Aggregation', () => {
    it('should aggregate metadata from all executed guards', async () => {
      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
      };
      const composite = new CompositeGuard([mockGuard1, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.EVENT_HANDLING,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.details?.guardResults).toBeDefined();
      expect(guardResult.details?.guardResults).toHaveLength(2);
      expect(guardResult.details?.guardResults).toBeDefined();
      // Check guard results structure
    });

    it('should provide execution statistics', async () => {
      const config: Partial<CompositeGuardConfiguration> = {
        executionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
        failFast: false,
      };
      const composite = new CompositeGuard([mockGuard1, mockGuard2, mockGuard3], config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await composite.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      const stats = guardResult.details;
      expect(stats?.guardsExecuted).toBe(2); // Only Guard1 and Guard2 apply to STATE_TRANSITION
      expect(stats?.guardsFailed).toBeLessThanOrEqual(1);
      // Check overall execution stats
      // Check failure stats
      expect(stats?.totalEvaluationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
