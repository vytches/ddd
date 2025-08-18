import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  InvariantManager,
  type InvariantManagerConfiguration,
} from '../../src/invariants/invariant-manager';
import {
  InvariantTrigger,
  InvariantSeverity,
  type IProcessInvariant,
  type InvariantContext,
} from '../../src/invariants/invariant.interface';
import type { IProcessManagerState, IProcessManagerContext } from '../../src/interfaces';

describe('InvariantManager', () => {
  let mockState: IProcessManagerState;
  let mockContext: IProcessManagerContext;
  let mockInvariant1: IProcessInvariant<IProcessManagerState>;
  let mockInvariant2: IProcessInvariant<IProcessManagerState>;
  let config: InvariantManagerConfiguration;

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

    mockInvariant1 = {
      validate: vi.fn().mockResolvedValue({
        isSuccess: true,
        value: {
          isValid: true,
          violations: [],
          evaluationTimeMs: 1,
          metadata: { invariant1: 'passed' },
        },
      }),
      getId: () => 'MockInvariant1',
      getDescription: () => 'Mock invariant 1',
      getSeverity: () => InvariantSeverity.ERROR,
      getPriority: () => 1,
      getTriggers: () => [InvariantTrigger.STATE_CHANGE, InvariantTrigger.EVENT_PROCESSING],
      shouldValidate: () => true,
      supportsAutoCorrection: () => false,
    };

    mockInvariant2 = {
      validate: vi.fn().mockResolvedValue({
        isSuccess: true,
        value: {
          isValid: false,
          violations: [
            {
              violationId: 'test-violation',
              severity: InvariantSeverity.WARNING,
              description: 'Test violation from invariant 2',
              field: 'testField',
              currentValue: 'invalid',
              expectedValue: 'valid',
              timestamp: new Date(),
            },
          ],
          evaluationTimeMs: 2,
          autoCorrectionsApplied: false,
          metadata: { invariant2: 'failed' },
        },
      }),
      getId: () => 'MockInvariant2',
      getDescription: () => 'Mock invariant 2',
      getSeverity: () => InvariantSeverity.WARNING,
      getPriority: () => 2,
      getTriggers: () => [InvariantTrigger.STATE_CHANGE],
      shouldValidate: () => true,
      supportsAutoCorrection: () => false,
    };

    config = {
      enableLogging: true,
      enableMetrics: true,
      enableAutoCorrection: true,
      enableParallelValidation: true,
      maxParallelInvariants: 10,
      autoRegisterBuiltInInvariants: false,
      failFastOnCritical: false,
      collectAllViolations: true,
      maxValidationTimeMs: 30000,
      minimumSeverityLevel: InvariantSeverity.INFO,
      perInvariantTimeoutMs: 5000,
      enablePerformanceTracking: true,
    };
  });

  describe('Invariant Registration', () => {
    it('should register invariants successfully', () => {
      const manager = new InvariantManager(config);

      manager.registerInvariant(mockInvariant1);
      manager.registerInvariant(mockInvariant2);

      const invariants = manager.getInvariants();
      expect(invariants.size).toBe(2);
      expect(invariants.has('MockInvariant1')).toBe(true);
      expect(invariants.has('MockInvariant2')).toBe(true);
    });

    it('should prevent duplicate invariant registration', () => {
      const manager = new InvariantManager(config);

      manager.registerInvariant(mockInvariant1);

      const [error] = safeRun(() => manager.registerInvariant(mockInvariant1));
      expect(error).toBeDefined();
      expect(error?.message).toContain('already registered');
    });

    it('should unregister invariants successfully', () => {
      const manager = new InvariantManager(config);

      manager.registerInvariant(mockInvariant1);
      manager.registerInvariant(mockInvariant2);

      const result = manager.unregisterInvariant('MockInvariant1');
      expect(result).toBe(true);

      const invariants = manager.getInvariants();
      expect(invariants.size).toBe(1);
      expect(invariants.has('MockInvariant1')).toBe(false);
      expect(invariants.has('MockInvariant2')).toBe(true);
    });

    it('should return false when unregistering non-existent invariant', () => {
      const manager = new InvariantManager(config);

      const result = manager.unregisterInvariant('NonExistentInvariant');
      expect(result).toBe(false);
    });

    it('should clear all invariants', () => {
      const manager = new InvariantManager(config);

      manager.registerInvariant(mockInvariant1);
      manager.registerInvariant(mockInvariant2);

      // Clear all invariants
      const invariantIds = Array.from(manager.getInvariants().keys());
      invariantIds.forEach(id => manager.unregisterInvariant(id));

      const invariants = manager.getInvariants();
      expect(invariants.size).toBe(0);
    });
  });

  describe('Invariant Validation', () => {
    it('should validate invariants and return aggregated results', async () => {
      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant1);
      manager.registerInvariant(mockInvariant2);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.isValid).toBe(false); // Because mockInvariant2 fails
      expect(validation.allViolations).toHaveLength(1);
      expect(validation.invariantsValidated).toBe(2);
    });

    it('should filter invariants by trigger', async () => {
      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant1); // Applies to EVENT_PROCESSING
      manager.registerInvariant(mockInvariant2); // Does not apply to EVENT_PROCESSING

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.EVENT_PROCESSING,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.invariantsValidated).toBe(1);
      expect(validation.invariantResults[0]?.invariantId).toBe('MockInvariant1');
      // Note: skippedInvariants is not part of the interface
    });

    it('should respect shouldValidate conditions', async () => {
      const conditionalInvariant = {
        ...mockInvariant1,
        shouldValidate: vi.fn().mockReturnValue(false),
      };

      const manager = new InvariantManager(config);
      manager.registerInvariant(conditionalInvariant);
      manager.registerInvariant(mockInvariant2);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.invariantsValidated).toBe(1);
      expect(validation.invariantResults[0]?.invariantId).toBe('MockInvariant2');
      // Note: skippedInvariants is not part of the interface
      expect(conditionalInvariant.validate).not.toHaveBeenCalled();
    });

    it('should execute invariants in priority order', async () => {
      const executionOrder: string[] = [];

      const lowPriorityInvariant = {
        ...mockInvariant1,
        getPriority: () => 10,
        validate: vi.fn().mockImplementation(async (state: any, context: any) => {
          executionOrder.push('LowPriority');
          return await mockInvariant1.validate(state, context);
        }),
      };

      const highPriorityInvariant = {
        ...mockInvariant2,
        getId: () => 'HighPriorityInvariant',
        getPriority: () => 1,
        validate: vi.fn().mockImplementation(async () => {
          executionOrder.push('HighPriority');
          return {
            isSuccess: true,
            value: {
              isValid: true,
              violations: [],
              evaluationTimeMs: 1,
              autoCorrectionsApplied: false,
            },
          };
        }),
      };

      const manager = new InvariantManager({
        ...config,
        // Note: executionStrategy and priorityExecution are not part of the interface
      });
      manager.registerInvariant(lowPriorityInvariant);
      manager.registerInvariant(highPriorityInvariant);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      await manager.validateInvariants(mockState, invariantContext);

      expect(executionOrder).toEqual(['HighPriority', 'LowPriority']);
    });

    it('should handle no applicable invariants gracefully', async () => {
      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant2); // Only applies to STATE_CHANGE

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.RECOVERY, // No invariants apply to this
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.isValid).toBe(true);
      expect(validation.invariantsValidated).toBe(0);
      // Note: warnings property is not part of the interface
    });
  });

  describe('Auto-Correction Handling', () => {
    it('should apply auto-corrections when enabled', async () => {
      const correctionInvariant = {
        ...mockInvariant1,
        validate: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: {
            isValid: false,
            violations: [
              {
                violationId: 'test-violation',
                severity: InvariantSeverity.WARNING,
                description: 'Test violation',
                field: 'testField',
                currentValue: 'invalid',
                expectedValue: 'valid',
                timestamp: new Date(),
              },
            ],
            evaluationTimeMs: 1,
            autoCorrectionsApplied: true,
            finalState: { ...mockState, stepData: { correctedData: 'test' } },
            correctionDetails: [
              {
                correctionType: 'FIELD_CORRECTION',
                field: 'testField',
                originalValue: 'invalid',
                correctedValue: 'valid',
                description: 'Field corrected',
              },
            ],
          },
        }),
      };

      const manager = new InvariantManager(config);
      manager.registerInvariant(correctionInvariant);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.autoCorrectionsApplied).toBe(true);
      expect(validation.finalState?.stepData?.correctedData).toBe('test');
      // Note: allCorrectionDetails is not part of the interface - check finalState instead
      expect(validation.finalState).toBeDefined();
    });

    it('should merge corrections from multiple invariants', async () => {
      const correction1 = {
        ...mockInvariant1,
        validate: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: {
            isValid: false,
            violations: [],
            evaluationTimeMs: 1,
            autoCorrectionsApplied: true,
            finalState: { ...mockState, stepData: { field1: 'corrected1' } },
            correctionDetails: [
              {
                correctionType: 'FIELD_CORRECTION',
                field: 'field1',
                originalValue: 'original1',
                correctedValue: 'corrected1',
                description: 'Field 1 corrected',
              },
            ],
          },
        }),
      };

      const correction2 = {
        ...mockInvariant2,
        validate: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: {
            isValid: false,
            violations: [],
            evaluationTimeMs: 1,
            autoCorrectionsApplied: true,
            finalState: { ...mockState, stepData: { field2: 'corrected2' } },
            correctionDetails: [
              {
                correctionType: 'FIELD_CORRECTION',
                field: 'field2',
                originalValue: 'original2',
                correctedValue: 'corrected2',
                description: 'Field 2 corrected',
              },
            ],
          },
        }),
      };

      const manager = new InvariantManager(config);
      manager.registerInvariant(correction1);
      manager.registerInvariant(correction2);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.autoCorrectionsApplied).toBe(true);
      // Note: allCorrectionDetails is not part of the interface - check finalState instead
      expect(validation.finalState).toBeDefined();
      expect(validation.finalState?.stepData).toEqual({
        field1: 'corrected1',
        field2: 'corrected2',
      });
    });

    it('should not apply corrections when disabled', async () => {
      const noCorrectionConfig = {
        ...config,
        enableAutoCorrection: false,
      };

      const correctionInvariant = {
        ...mockInvariant1,
        validate: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: {
            isValid: false,
            violations: [
              {
                violationId: 'test-violation',
                severity: InvariantSeverity.WARNING,
                description: 'Test violation',
                field: 'testField',
                currentValue: 'invalid',
                expectedValue: 'valid',
                timestamp: new Date(),
              },
            ],
            evaluationTimeMs: 1,
            autoCorrectionsApplied: true,
            finalState: { ...mockState, stepData: { correctedData: 'test' } },
          },
        }),
      };

      const manager = new InvariantManager(noCorrectionConfig);
      manager.registerInvariant(correctionInvariant);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.isValid).toBe(false);
      expect(validation.autoCorrectionsApplied).toBe(false);
      expect(validation.finalState).toBeUndefined();
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance metrics when enabled', async () => {
      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant1);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      await manager.validateInvariants(mockState, invariantContext);

      const stats = manager.getStatistics();
      expect(stats.totalValidations).toBe(1);
      expect(stats.averageExecutionTimeMs).toBeGreaterThan(0);
      expect(stats.invariantMetrics.get('MockInvariant1')?.validationCount).toBe(1);
    });

    it('should not track metrics when monitoring is disabled', async () => {
      const configWithoutMonitoring = {
        ...config,
        enablePerformanceTracking: false,
        enableMetrics: false,
      };
      const manager = new InvariantManager(configWithoutMonitoring);
      manager.registerInvariant(mockInvariant1);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      await manager.validateInvariants(mockState, invariantContext);

      const stats = manager.getStatistics();
      expect(stats.totalValidations).toBe(0); // Should not track when disabled
    });

    it('should reset performance metrics', async () => {
      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant1);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      await manager.validateInvariants(mockState, invariantContext);

      let stats = manager.getStatistics();
      expect(stats.totalValidations).toBe(1);

      manager.resetPerformanceMetrics();

      stats = manager.getStatistics();
      expect(stats.totalValidations).toBe(0);
      expect(stats.invariantMetrics.size).toBe(0);
    });
  });

  describe('Timeout Handling', () => {
    it('should handle invariant timeouts', async () => {
      const slowInvariant = {
        ...mockInvariant1,
        getId: () => 'SlowInvariant',
        validate: vi.fn().mockImplementation(async (state: any, context: any) => {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          return await mockInvariant1.validate(state, context);
        }),
      };

      const fastConfig = {
        ...config,
        perInvariantTimeoutMs: 50, // 50ms timeout
      };
      const manager = new InvariantManager(fastConfig);
      manager.registerInvariant(slowInvariant);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.isValid).toBe(false);
      // Note: errors and timedOutInvariants are not part of the interface
      expect(validation.failedInvariants).toBeDefined();
      expect(validation.failedInvariants?.[0]?.invariantId).toBe('SlowInvariant');
    });

    it('should continue with other invariants after timeout', async () => {
      const slowInvariant = {
        ...mockInvariant1,
        getId: () => 'SlowInvariant',
        validate: vi.fn().mockImplementation(async (state: any, context: any) => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return await mockInvariant1.validate(state, context);
        }),
      };

      const fastInvariant = {
        ...mockInvariant2,
        getId: () => 'FastInvariant',
        validate: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: {
            isValid: true,
            violations: [],
            evaluationTimeMs: 1,
            autoCorrectionsApplied: false,
          },
        }),
      };

      const timeoutConfig = {
        ...config,
        perInvariantTimeoutMs: 50,
        failureStrategy: 'continue-on-failure' as const,
      };
      const manager = new InvariantManager(timeoutConfig);
      manager.registerInvariant(slowInvariant);
      manager.registerInvariant(fastInvariant);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      const executedIds = validation.invariantResults.map(r => r.invariantId);
      expect(executedIds).toContain('FastInvariant');
      expect(validation.failedInvariants?.map(f => f.invariantId)).toContain('SlowInvariant');
    });
  });

  describe('Concurrency Control', () => {
    it('should respect max concurrent invariants limit', async () => {
      const concurrentInvariants = Array.from({ length: 15 }, (_, i) => ({
        ...mockInvariant1,
        getId: () => `ConcurrentInvariant${i}`,
        validate: vi.fn().mockImplementation(async (state: any, context: any) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return await mockInvariant1.validate(state, context);
        }),
      }));

      const limitedConfig = {
        ...config,
        maxConcurrentInvariants: 5, // Limit to 5 concurrent
      };
      const manager = new InvariantManager(limitedConfig);

      concurrentInvariants.forEach(invariant => manager.registerInvariant(invariant));

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const startTime = Date.now();
      await manager.validateInvariants(mockState, invariantContext);
      const duration = Date.now() - startTime;

      // Should take longer due to concurrency limits (invariants executed in batches)
      expect(duration).toBeGreaterThan(20); // At least 2 batches of 10ms each
    });
  });

  describe('Error Handling', () => {
    it('should handle invariant execution errors gracefully', async () => {
      const errorInvariant = {
        ...mockInvariant1,
        getId: () => 'ErrorInvariant',
        validate: vi.fn().mockRejectedValue(new Error('Invariant execution failed')),
      };

      const manager = new InvariantManager(config);
      manager.registerInvariant(errorInvariant);
      manager.registerInvariant(mockInvariant2);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.isValid).toBe(false); // Due to error
      expect(validation.failedInvariants).toHaveLength(1);
      expect(validation.failedInvariants?.[0]?.invariantId).toBe('ErrorInvariant');
    });

    it('should handle malformed invariant results', async () => {
      const malformedInvariant = {
        ...mockInvariant1,
        getId: () => 'MalformedInvariant',
        validate: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: null as any,
        }),
      };

      const manager = new InvariantManager(config);
      manager.registerInvariant(malformedInvariant);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.isValid).toBe(false);
      expect(validation.failedInvariants).toHaveLength(1);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate invariant configuration', () => {
      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant1);
      manager.registerInvariant(mockInvariant2);

      const validation = manager.validateConfiguration();

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });

    it('should detect configuration issues', () => {
      const invalidInvariant = {
        ...mockInvariant1,
        getId: () => '', // Invalid empty ID
      };

      const manager = new InvariantManager(config);
      manager.registerInvariant(invalidInvariant);

      const validation = manager.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toHaveLength(1);
      expect(validation.issues[0]).toContain('ID');
    });

    it('should detect duplicate priorities', () => {
      const duplicatePriorityInvariant = {
        ...mockInvariant2,
        getId: () => 'DuplicatePriorityInvariant',
        getPriority: () => 1, // Same as mockInvariant1
      };

      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant1);
      manager.registerInvariant(duplicatePriorityInvariant);

      const validation = manager.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('priority'))).toBe(true);
    });
  });

  describe('Invariant Information', () => {
    it('should get invariant by ID', () => {
      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant1);
      manager.registerInvariant(mockInvariant2);

      const invariant = manager.getInvariant('MockInvariant1');
      expect(invariant).toBe(mockInvariant1);

      const nonExistent = manager.getInvariant('NonExistent');
      expect(nonExistent).toBeUndefined();
    });

    it('should get invariants by trigger', () => {
      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant1); // Applies to STATE_CHANGE, EVENT_PROCESSING
      manager.registerInvariant(mockInvariant2); // Applies to STATE_CHANGE only

      const stateChangeInvariants = manager.getInvariantsByTrigger(InvariantTrigger.STATE_CHANGE);
      expect(stateChangeInvariants).toHaveLength(2);

      const eventProcessingInvariants = manager.getInvariantsByTrigger(
        InvariantTrigger.EVENT_PROCESSING
      );
      expect(eventProcessingInvariants).toHaveLength(1);
      expect(eventProcessingInvariants[0]?.getId()).toBe('MockInvariant1');
    });

    it('should check if invariant exists', () => {
      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant1);

      expect(manager.hasInvariant('MockInvariant1')).toBe(true);
      expect(manager.hasInvariant('NonExistent')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty invariant manager', async () => {
      const manager = new InvariantManager(config);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.isValid).toBe(true);
      expect(validation.invariantsValidated).toBe(0);
    });

    it('should handle invariant with null context gracefully', async () => {
      const manager = new InvariantManager(config);
      manager.registerInvariant(mockInvariant1);

      const invalidContext: InvariantContext = {
        processContext: null as any,
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const [error] = await safeRun(
        async () => await manager.validateInvariants(mockState, invalidContext)
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/context|required/);
    });
  });

  describe('Violation Severity Analysis', () => {
    it('should categorize violations by severity', async () => {
      const multiSeverityInvariant = {
        ...mockInvariant1,
        validate: vi.fn().mockResolvedValue({
          isSuccess: true,
          value: {
            isValid: false,
            violations: [
              {
                violationId: 'critical-violation',
                severity: InvariantSeverity.CRITICAL,
                description: 'Critical violation',
                field: 'criticalField',
                currentValue: 'bad',
                expectedValue: 'good',
                timestamp: new Date(),
              },
              {
                violationId: 'warning-violation',
                severity: InvariantSeverity.WARNING,
                description: 'Warning violation',
                field: 'warningField',
                currentValue: 'questionable',
                expectedValue: 'better',
                timestamp: new Date(),
              },
            ],
            autoCorrectionsApplied: false,
          },
        }),
      };

      const manager = new InvariantManager(config);
      manager.registerInvariant(multiSeverityInvariant);

      const invariantContext: InvariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await manager.validateInvariants(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validation = result.value;
      expect(validation.isValid).toBe(false);
      expect(validation.criticalViolations).toHaveLength(1);
      // Note: errorViolations, warningViolations, infoViolations are not part of the interface
      // Use allViolations and filter by severity instead
      const warningViolations = validation.allViolations.filter(
        v => v.severity === InvariantSeverity.WARNING
      );
      expect(warningViolations).toHaveLength(1);
    });
  });
});
