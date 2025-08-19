import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { GuardManager, type GuardManagerConfiguration } from '../../src/guards/guard-manager';
import { GuardExecutionStrategy } from '../../src/guards/composite-guard';
import {
  GuardOperation,
  GuardSeverity,
  type IProcessGuard,
  type ProcessGuardContext,
} from '../../src/guards/guard.interface';
import type { IProcessManagerState, IProcessManagerContext } from '../../src/interfaces';

describe('GuardManager', () => {
  let mockState: IProcessManagerState;
  let mockContext: IProcessManagerContext;
  let mockGuard1: IProcessGuard<IProcessManagerState>;
  let mockGuard2: IProcessGuard<IProcessManagerState>;
  let config: GuardManagerConfiguration;

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

    mockGuard1 = {
      canExecute: vi.fn().mockResolvedValue({
        isSuccess: true,
        value: {
          allowed: true,
          severity: GuardSeverity.WARNING,
          reason: 'Guard 1 passed',
          code: 'GUARD1_SUCCESS',
          metadata: { guard1: 'passed' },
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

    mockGuard2 = {
      canExecute: vi.fn().mockResolvedValue({
        isSuccess: true,
        value: {
          allowed: false,
          severity: GuardSeverity.ERROR,
          reason: 'Guard 2 failed',
          code: 'GUARD2_FAILURE',
          metadata: { guard2: 'failed' },
        },
      }),
      getName: () => 'MockGuard2',
      getPriority: () => 2,
      getApplicableOperations: () => [GuardOperation.STATE_TRANSITION],
      shouldEvaluate: () => true,
    };

    config = {
      enableLogging: true,
      enablePerformanceMonitoring: true,
      defaultExecutionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
      failFast: true,
      timeoutMs: 5000,
      maxGuardsPerOperation: 10,
      collectAllResults: true,
      minimumBlockingSeverity: GuardSeverity.ERROR,
      autoRegisterBuiltInGuards: false,
    };
  });

  describe('Guard Registration', () => {
    it('should register guards successfully', () => {
      const manager = new GuardManager(config);

      manager.registerGuard(mockGuard1);
      manager.registerGuard(mockGuard2);

      const guards = manager.getGuards();
      expect(guards.size).toBe(2);
      expect(guards.has('MockGuard1')).toBe(true);
      expect(guards.has('MockGuard2')).toBe(true);
    });

    it('should prevent duplicate guard registration', () => {
      const manager = new GuardManager(config);

      manager.registerGuard(mockGuard1);

      const [error] = safeRun(() => manager.registerGuard(mockGuard1));
      expect(error).toBeDefined();
      expect(error?.message).toContain('already registered');
    });

    it('should unregister guards successfully', () => {
      const manager = new GuardManager(config);

      manager.registerGuard(mockGuard1);
      manager.registerGuard(mockGuard2);

      const result = manager.unregisterGuard('MockGuard1');
      expect(result).toBe(true);

      const guards = manager.getGuards();
      expect(guards.size).toBe(1);
      expect(guards.has('MockGuard1')).toBe(false);
      expect(guards.has('MockGuard2')).toBe(true);
    });

    it('should return false when unregistering non-existent guard', () => {
      const manager = new GuardManager(config);

      const result = manager.unregisterGuard('NonExistentGuard');
      expect(result).toBe(false);
    });

    it('should clear all guards', () => {
      const manager = new GuardManager(config);

      manager.registerGuard(mockGuard1);
      manager.registerGuard(mockGuard2);

      (manager as any).clearGuards(); // Clear all guards

      const guards = manager.getGuards();
      expect(guards.size).toBe(0);
    });
  });

  describe('Guard Evaluation', () => {
    it('should evaluate guards and return success when all pass', async () => {
      const passingGuard = {
        ...mockGuard2,
        canExecute: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: {
            allowed: true,
            severity: GuardSeverity.WARNING,
            reason: 'Guard 2 passed',
            code: 'GUARD2_SUCCESS',
          },
        }),
      };

      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1);
      manager.registerGuard(passingGuard);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await manager.evaluateGuards(guardContext);

      expect(result.isSuccess).toBe(true);
      const evaluation = result.value;
      expect(evaluation.allowed).toBe(true);
      expect(evaluation.guardResults).toHaveLength(2);
    });

    it('should return failure when any guard fails', async () => {
      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1);
      manager.registerGuard(mockGuard2); // This one fails

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await manager.evaluateGuards(guardContext);

      expect(result.isSuccess).toBe(true);
      const evaluation = result.value;
      expect(evaluation.allowed).toBe(false);
      expect(evaluation.blockingIssues.some(b => b.reason.includes('Guard 2 failed'))).toBe(true);
    });

    it('should filter guards by applicable operations', async () => {
      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1); // Applies to EVENT_HANDLING
      manager.registerGuard(mockGuard2); // Does not apply to EVENT_HANDLING

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.EVENT_HANDLING,
      };

      const result = await manager.evaluateGuards(guardContext);

      expect(result.isSuccess).toBe(true);
      const evaluation = result.value;
      expect(evaluation.guardResults).toHaveLength(1);
      expect(evaluation.guardResults[0]?.guardName).toBe('MockGuard1');
      expect(evaluation.blockingIssues.some(b => b.reason.includes('MockGuard2'))).toBe(true);
    });

    it('should respect shouldEvaluate conditions', async () => {
      const conditionalGuard = {
        ...mockGuard1,
        shouldEvaluate: vi.fn().mockReturnValue(false),
      };

      const manager = new GuardManager(config);
      manager.registerGuard(conditionalGuard);
      manager.registerGuard(mockGuard2);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await manager.evaluateGuards(guardContext);

      expect(result.isSuccess).toBe(true);
      const evaluation = result.value;
      expect(evaluation.guardResults).toHaveLength(1);
      expect(evaluation.guardResults[0]?.guardName).toBe('MockGuard2');
      expect(evaluation.blockingIssues.some(b => b.reason.includes('MockGuard1'))).toBe(true);
      expect(conditionalGuard.canExecute).not.toHaveBeenCalled();
    });

    it('should execute guards in priority order', async () => {
      const executionOrder: string[] = [];

      const lowPriorityGuard = {
        ...mockGuard1,
        getPriority: () => 10,
        canExecute: vi.fn().mockImplementation(async (context: any) => {
          executionOrder.push('LowPriority');
          return await mockGuard1.canExecute(context);
        }),
      };

      const highPriorityGuard = {
        ...mockGuard2,
        getName: () => 'HighPriorityGuard',
        getPriority: () => 1,
        canExecute: vi.fn().mockImplementation(async () => {
          executionOrder.push('HighPriority');
          return {
            isSuccess: true,
            value: {
              allowed: true,
              severity: GuardSeverity.WARNING,
              reason: 'High priority guard passed',
              code: 'HIGH_PRIORITY_SUCCESS',
            },
          };
        }),
      };

      const manager = new GuardManager({
        ...config,
        defaultExecutionStrategy: GuardExecutionStrategy.PRIORITY_BASED,
      });
      manager.registerGuard(lowPriorityGuard);
      manager.registerGuard(highPriorityGuard);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      await manager.evaluateGuards(guardContext);

      expect(executionOrder).toEqual(['HighPriority', 'LowPriority']);
    });

    it('should handle no applicable guards gracefully', async () => {
      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard2); // Only applies to STATE_TRANSITION

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.RECOVERY, // No guards apply to this
      };

      const result = await manager.evaluateGuards(guardContext);

      expect(result.isSuccess).toBe(true);
      const evaluation = result.value;
      expect(evaluation.allowed).toBe(true);
      expect(evaluation.guardResults).toHaveLength(0);
      expect(
        evaluation.blockingIssues.some(b => b.reason.includes('No applicable guards found'))
      ).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics when enabled', async () => {
      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      await manager.evaluateGuards(guardContext);

      const stats = manager.getStatistics();
      expect(stats.totalEvaluations).toBe(1);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
      expect(manager.getGuardPerformanceMetrics('MockGuard1')?.executionCount).toBe(1);
    });

    it('should not track metrics when monitoring is disabled', async () => {
      const configWithoutMonitoring = {
        ...config,
        enablePerformanceMonitoring: false,
      };
      const manager = new GuardManager(configWithoutMonitoring);
      manager.registerGuard(mockGuard1);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      await manager.evaluateGuards(guardContext);

      const stats = manager.getStatistics();
      expect(stats.totalEvaluations).toBe(0); // Should not track when disabled
    });

    it('should reset performance metrics', async () => {
      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      await manager.evaluateGuards(guardContext);

      let stats = manager.getStatistics();
      expect(stats.totalEvaluations).toBe(1);

      manager.resetPerformanceMetrics();

      stats = manager.getStatistics();
      expect(stats.totalEvaluations).toBe(0);
      expect(manager.getPerformanceMetrics().size).toBe(0);
    });
  });

  describe('Timeout Handling', () => {
    it('should handle guard timeouts', async () => {
      const slowGuard = {
        ...mockGuard1,
        getName: () => 'SlowGuard',
        canExecute: vi.fn().mockImplementation(async (context: any) => {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          return await mockGuard1.canExecute(context);
        }),
      };

      const fastConfig = {
        ...config,
        timeoutMs: 50, // 50ms timeout
      };
      const manager = new GuardManager(fastConfig);
      manager.registerGuard(slowGuard);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await manager.evaluateGuards(guardContext);

      expect(result.isSuccess).toBe(true);
      const evaluation = result.value;
      expect(evaluation.allowed).toBe(false);
      expect(evaluation.blockingIssues.some(b => b.reason.includes('timeout'))).toBe(true);
      expect(evaluation.errors?.map(e => e.guardName).includes('SlowGuard')).toBe(true);
    });

    it('should continue with other guards after timeout', async () => {
      const slowGuard = {
        ...mockGuard1,
        getName: () => 'SlowGuard',
        canExecute: vi.fn().mockImplementation(async (context: any) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return await mockGuard1.canExecute(context);
        }),
      };

      const fastGuard = {
        ...mockGuard2,
        getName: () => 'FastGuard',
        canExecute: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: {
            allowed: true,
            severity: GuardSeverity.WARNING,
            reason: 'Fast guard passed',
            code: 'FAST_SUCCESS',
          },
        }),
      };

      const timeoutConfig = {
        ...config,
        timeoutMs: 50,
        failFast: false,
      };
      const manager = new GuardManager(timeoutConfig);
      manager.registerGuard(slowGuard);
      manager.registerGuard(fastGuard);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await manager.evaluateGuards(guardContext);

      expect(result.isSuccess).toBe(true);
      const evaluation = result.value;
      expect(evaluation.guardResults.map(g => g.guardName)).toContain('FastGuard');
      expect(evaluation.errors?.map(e => e.guardName).includes('SlowGuard')).toBe(true);
    });
  });

  describe('Concurrency Control', () => {
    it('should respect max concurrent guards limit', async () => {
      const concurrentGuards = Array.from({ length: 15 }, (_, i) => ({
        ...mockGuard1,
        getName: () => `ConcurrentGuard${i}`,
        canExecute: vi.fn().mockImplementation(async (context: any) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return await mockGuard1.canExecute(context);
        }),
      }));

      const limitedConfig = {
        ...config,
        maxGuardsPerOperation: 5, // Limit to 5 concurrent
      };
      const manager = new GuardManager(limitedConfig);

      concurrentGuards.forEach(guard => manager.registerGuard(guard));

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const startTime = Date.now();
      await manager.evaluateGuards(guardContext);
      const duration = Date.now() - startTime;

      // Should take longer due to concurrency limits (guards executed in batches)
      expect(duration).toBeGreaterThan(20); // At least 2 batches of 10ms each
    });
  });

  describe('Error Handling', () => {
    it('should handle guard execution errors gracefully', async () => {
      const errorGuard = {
        ...mockGuard1,
        getName: () => 'ErrorGuard',
        canExecute: vi.fn().mockRejectedValue(new Error('Guard execution failed')),
      };

      const manager = new GuardManager(config);
      manager.registerGuard(errorGuard);
      manager.registerGuard(mockGuard2);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await manager.evaluateGuards(guardContext);

      expect(result.isSuccess).toBe(true);
      const evaluation = result.value;
      expect(evaluation.allowed).toBe(false); // Due to error
      expect(evaluation.errors).toHaveLength(1);
      expect(evaluation.errors?.map(e => e.guardName).includes('ErrorGuard')).toBe(true);
    });

    it('should handle malformed guard results', async () => {
      const malformedGuard = {
        ...mockGuard1,
        getName: () => 'MalformedGuard',
        canExecute: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: null as any,
        }),
      };

      const manager = new GuardManager(config);
      manager.registerGuard(malformedGuard);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await manager.evaluateGuards(guardContext);

      expect(result.isSuccess).toBe(true);
      const evaluation = result.value;
      expect(evaluation.allowed).toBe(false);
      expect(evaluation.errors).toHaveLength(1);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate guard configuration', () => {
      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1);
      manager.registerGuard(mockGuard2);

      const validation = manager.validateConfiguration();

      expect(validation.isValid).toBe(true);
      expect(manager.getStatistics().totalGuards).toBe(2);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect configuration issues', () => {
      const invalidGuard = {
        ...mockGuard1,
        getName: () => '', // Invalid empty name
      };

      const manager = new GuardManager(config);
      manager.registerGuard(invalidGuard);

      const validation = manager.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toHaveLength(1);
      expect(validation.issues[0]).toContain('name');
    });

    it('should detect duplicate priorities', () => {
      const duplicatePriorityGuard = {
        ...mockGuard2,
        getName: () => 'DuplicatePriorityGuard',
        getPriority: () => 1, // Same as mockGuard1
      };

      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1);
      manager.registerGuard(duplicatePriorityGuard);

      const validation = manager.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('priority'))).toBe(true);
    });
  });

  describe('Guard Information', () => {
    it('should get guard by name', () => {
      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1);
      manager.registerGuard(mockGuard2);

      const guard = manager.getGuards().get('MockGuard1');
      expect(guard).toBe(mockGuard1);

      const nonExistent = manager.getGuards().get('NonExistent');
      expect(nonExistent).toBeUndefined();
    });

    it('should get guards by operation', () => {
      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1); // Applies to STATE_TRANSITION, EVENT_HANDLING
      manager.registerGuard(mockGuard2); // Applies to STATE_TRANSITION only

      const stateTransitionGuards = manager.getGuardsForOperation(GuardOperation.STATE_TRANSITION);
      expect(stateTransitionGuards).toHaveLength(2);

      const eventHandlingGuards = manager.getGuardsForOperation(GuardOperation.EVENT_HANDLING);
      expect(eventHandlingGuards).toHaveLength(1);
      expect(eventHandlingGuards[0]?.getName()).toBe('MockGuard1');
    });

    it('should check if guard exists', () => {
      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1);

      expect(manager.getGuards().has('MockGuard1')).toBe(true);
      expect(manager.getGuards().has('NonExistent')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty guard manager', async () => {
      const manager = new GuardManager(config);

      const guardContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await manager.evaluateGuards(guardContext);

      expect(result.isSuccess).toBe(true);
      const evaluation = result.value;
      expect(evaluation.allowed).toBe(true);
      expect(evaluation.guardResults).toHaveLength(0);
    });

    it('should handle guard with null context gracefully', async () => {
      const manager = new GuardManager(config);
      manager.registerGuard(mockGuard1);

      const invalidContext: ProcessGuardContext<IProcessManagerState> = {
        currentState: mockState,
        context: null as any,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const [error] = await safeRun(async () => await manager.evaluateGuards(invalidContext));

      expect(error).toBeDefined();
      expect(error?.message).toContain('required');
    });
  });
});
