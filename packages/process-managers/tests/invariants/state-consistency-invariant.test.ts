import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  StateConsistencyInvariant,
  type StateConsistencyConfiguration,
} from '../../src/invariants/state-consistency-invariant';
import { InvariantTrigger, InvariantSeverity } from '../../src/invariants/invariant.interface';
import type { IProcessManagerState, IProcessManagerContext } from '../../src/interfaces';

describe('StateConsistencyInvariant', () => {
  let mockState: IProcessManagerState;
  let mockContext: IProcessManagerContext;
  let config: StateConsistencyConfiguration;

  beforeEach(() => {
    mockState = {
      currentStep: 'step1',
      stepData: {
        field1: 'value1',
        field2: 'value2',
        nested: { subField: 'subValue' },
      },
      version: 1,
      lastModified: new Date('2024-01-01T12:00:00Z'),
      correlationData: { processManagerId: 'test-id' },
      metadata: { consistent: true },
    };

    mockContext = {
      correlationId: 'test-correlation',
      processedAt: new Date('2024-01-01T12:05:00Z'),
      userId: 'test-user',
      tenantId: 'test-tenant',
    };

    config = {
      validateStepData: true,
      validateCorrelationData: true,
      validateMetadata: true,
      enableAutoCorrection: false, // Changed to false for basic validation tests
      requiredFields: ['currentStep', 'version', 'lastModified'],
      maxNestingDepth: 5,
    };
  });

  describe('Basic Consistency Validation', () => {
    it('should pass validation for consistent state', async () => {
      const invariant = new StateConsistencyInvariant(config);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.violations).toHaveLength(0);
    });

    it('should detect missing required fields', async () => {
      const invalidState = {
        ...mockState,
        currentStep: undefined as any,
      };
      const invariant = new StateConsistencyInvariant(config);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.violations).toHaveLength(1);
      expect(validationResult.violations[0]?.property).toContain('currentStep');
      expect(validationResult.violations[0]?.severity).toBe(InvariantSeverity.ERROR);
    });

    it('should validate field types correctly', async () => {
      const invalidState = {
        ...mockState,
        version: 'not-a-number' as any,
      };
      const invariant = new StateConsistencyInvariant(config);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.violations).toHaveLength(1);
      expect(validationResult.violations[0]?.description).toContain('version');
      expect(validationResult.violations[0]?.description).toContain('must be a number');
    });

    it('should validate version constraints', async () => {
      const invalidState = {
        ...mockState,
        version: -1, // Violates version validation
      };
      const invariant = new StateConsistencyInvariant(config);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.violations).toHaveLength(1);
      expect(validationResult.violations[0]?.description).toContain('version');
    });
  });

  describe('Auto-Correction Features', () => {
    it('should auto-correct missing required fields', async () => {
      const correctionConfig = {
        ...config,
        enableAutoCorrection: true, // Enable auto-correction for correction tests
      };
      const invalidState = {
        ...mockState,
        currentStep: undefined as any,
      };
      const invariant = new StateConsistencyInvariant(correctionConfig);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.stateModified).toBe(true);
      expect(validationResult.correctedState).toBeDefined();
      // correctionDetails not part of InvariantResult interface
    });

    it('should auto-correct invalid field types', async () => {
      const correctionConfig = {
        ...config,
        enableAutoCorrection: true, // Enable auto-correction for correction tests
      };
      const invalidState = {
        ...mockState,
        version: '42' as any,
      };
      const invariant = new StateConsistencyInvariant(correctionConfig);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.stateModified).toBe(true);
      expect(validationResult.correctedState?.version).toBeGreaterThanOrEqual(0);
      // correctionDetails not part of InvariantResult interface
    });

    it('should handle multiple corrections simultaneously', async () => {
      const correctionConfig = {
        ...config,
        enableAutoCorrection: true, // Enable auto-correction for correction tests
      };
      const invalidState = {
        ...mockState,
        currentStep: undefined as any,
        version: '123' as any,
      };
      const invariant = new StateConsistencyInvariant(correctionConfig);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.stateModified).toBe(true);
      expect(validationResult.correctedState?.currentStep).toBeDefined();
      expect(validationResult.correctedState?.version).toBeGreaterThanOrEqual(0);
      // correctionDetails not part of InvariantResult interface
    });

    it('should not auto-correct when disabled', async () => {
      const noCorrectionConfig = {
        ...config,
        enableAutoCorrection: false,
      };
      const invalidState = {
        ...mockState,
        currentStep: undefined as any,
      };
      const invariant = new StateConsistencyInvariant(noCorrectionConfig);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.stateModified).toBe(false);
      expect(validationResult.correctedState).toBeUndefined();
    });
  });

  describe('Structural Validations', () => {
    it('should validate step data when configured', async () => {
      const strictConfig = {
        ...config,
        validateStepData: true,
        enableAutoCorrection: false, // Ensure no auto-correction for pure validation test
      };
      const stateWithInvalidStepData = {
        ...mockState,
        stepData: null as any,
      };
      const invariant = new StateConsistencyInvariant(strictConfig);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(stateWithInvalidStepData, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.violations.some(v => v.description.includes('Step data'))).toBe(true);
    });

    it('should validate correlation data when configured', async () => {
      const stateWithInvalidCorrelationData = {
        ...mockState,
        correlationData: {} as any, // Missing processManagerId
      };
      const invariant = new StateConsistencyInvariant(config);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(stateWithInvalidCorrelationData, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(false);
      expect(
        validationResult.violations.some(v => v.description.includes('processManagerId'))
      ).toBe(true);
    });

    it('should skip validation when disabled', async () => {
      const noValidationConfig = {
        ...config,
        validateStepData: false,
        validateCorrelationData: false,
        validateMetadata: false,
      };
      const invalidState = {
        ...mockState,
        stepData: null as any,
      };
      const invariant = new StateConsistencyInvariant(noValidationConfig);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(true); // Should pass since validation is disabled
    });
  });

  describe('Custom Step Validations', () => {
    it('should run custom step validators', async () => {
      const customConfig = {
        ...config,
        customStepValidators: {
          step1: (state: any) => {
            return state.stepData?.field1 === 'expected-value'
              ? []
              : ['Field1 must be expected-value'];
          },
        },
      };
      const invalidState = {
        ...mockState,
        stepData: { ...mockState.stepData, field1: 'wrong-value' },
      };
      const invariant = new StateConsistencyInvariant(customConfig);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(false);
      expect(
        validationResult.violations.some(v =>
          v.description.includes('Field1 must be expected-value')
        )
      ).toBe(true);
    });

    it('should handle step data requirements', async () => {
      const requirementConfig = {
        ...config,
        stepDataRequirements: {
          step1: ['field1', 'field2'],
        },
      };
      const invalidState = {
        ...mockState,
        stepData: { field1: 'value1' }, // Missing field2
      };
      const invariant = new StateConsistencyInvariant(requirementConfig);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.violations[0]?.property).toContain('field2');
    });
  });

  describe('Performance', () => {
    it('should validate state consistency within performance target', async () => {
      const invariant = new StateConsistencyInvariant(config);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const startTime = performance.now();
      await invariant.validate(mockState, invariantContext);
      const validationTime = performance.now() - startTime;

      expect(validationTime).toBeLessThan(1); // Should be very fast for consistency checks
    });

    it('should handle large state objects efficiently', async () => {
      const largeState = {
        ...mockState,
        stepData: {
          ...mockState.stepData,
          largeArray: new Array(1000).fill({ data: 'test' }),
          largeObject: Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [`field${i}`, `value${i}`])
          ),
        },
      };
      const invariant = new StateConsistencyInvariant(config);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const startTime = performance.now();
      const result = await invariant.validate(largeState, invariantContext);
      const validationTime = performance.now() - startTime;

      expect(result.isSuccess).toBe(true);
      expect(validationTime).toBeLessThan(50); // Should handle large objects reasonably quickly
    });
  });

  describe('Error Handling', () => {
    it('should handle null state gracefully', async () => {
      const invariant = new StateConsistencyInvariant(config);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const [error] = await safeRun(
        async () => await invariant.validate(null as any, invariantContext)
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/state|null|required/);
    });

    it('should handle malformed context gracefully', async () => {
      const invariant = new StateConsistencyInvariant(config);
      const invalidContext = {
        processContext: null as any,
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const [error] = await safeRun(
        async () => await invariant.validate(mockState, invalidContext)
      );

      expect(error).toBeDefined();
      expect(error?.message).toMatch(/context|required/);
    });

    it('should handle validator function errors gracefully', async () => {
      const errorConfig = {
        ...config,
        fieldValidations: {
          currentStep: () => {
            throw new Error('Validator error');
          },
        },
      };
      const invariant = new StateConsistencyInvariant(errorConfig);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.violations.some(v => v.description.includes('threw an error'))).toBe(
        true
      );
    });

    it('should handle missing configuration gracefully', async () => {
      const minimalConfig = {};
      const invariant = new StateConsistencyInvariant(minimalConfig);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(mockState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(true); // Should pass with minimal config
    });
  });

  describe('Severity Levels', () => {
    it('should assign appropriate severity levels to violations', async () => {
      const invalidState = {
        ...mockState,
        currentStep: undefined as any, // Missing required field
        version: 'invalid' as any, // Invalid version
      };
      const invariant = new StateConsistencyInvariant(config);
      const invariantContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const result = await invariant.validate(invalidState, invariantContext);

      expect(result.isSuccess).toBe(true);
      const validationResult = result.value;
      expect(validationResult.isValid).toBe(false);

      const errorViolations = validationResult.violations.filter(
        v => v.severity === InvariantSeverity.ERROR
      );

      expect(errorViolations.length).toBeGreaterThan(0);
    });
  });

  describe('Trigger-specific Behavior', () => {
    it('should behave based on trigger type', async () => {
      const partialState = {
        currentStep: 'step1',
        version: 1,
        lastModified: new Date(),
        correlationData: { processManagerId: 'test' },
        stepData: {},
        // Valid minimal state
      };
      const invariant = new StateConsistencyInvariant(config);

      // Test with INITIALIZATION trigger
      const initContext = {
        processContext: {
          correlationId: mockContext.correlationId,
          processedAt: mockContext.processedAt,
          userId: mockContext.userId!,
          tenantId: mockContext.tenantId!,
        },
        triggeringOperation: InvariantTrigger.INITIALIZATION,
      };

      const initResult = await invariant.validate(partialState, initContext);
      expect(initResult.isSuccess).toBe(true);
      expect(initResult.value.isValid).toBe(true);

      // Test with STATE_CHANGE trigger
      const changeContext = {
        ...initContext,
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
      };

      const changeResult = await invariant.validate(partialState, changeContext);
      expect(changeResult.isSuccess).toBe(true);
      expect(changeResult.value.isValid).toBe(true); // Should pass with valid state
    });
  });
});
