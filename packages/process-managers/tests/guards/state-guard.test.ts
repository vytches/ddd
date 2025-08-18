import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { StateGuard, type StateGuardConfiguration } from '../../src/guards/state-guard';
import { GuardOperation, GuardSeverity } from '../../src/guards/guard.interface';
import type { IProcessManagerState, IProcessManagerContext } from '../../src/interfaces';

describe('StateGuard', () => {
  let mockState: IProcessManagerState;
  let mockContext: IProcessManagerContext;
  let config: StateGuardConfiguration;

  beforeEach(() => {
    mockState = {
      currentStep: 'step1',
      stepData: { data: 'test' },
      version: 1,
      lastModified: new Date(),
      correlationData: { processManagerId: 'test-id' },
      metadata: { test: true },
    };

    mockContext = {
      correlationId: 'test-correlation',
      processedAt: new Date(),
      userId: 'test-user',
      tenantId: 'test-tenant',
    };

    config = {
      validTransitions: {
        step1: ['step2', 'step3'],
        step2: ['step3', 'step4'],
        step3: ['step4'],
        step4: [],
      },
      terminalSteps: ['step4'],
      // Note: auto-correction would be implemented as part of guard logic
    };
  });

  describe('Basic Structure Validation', () => {
    it('should pass validation for valid state structure', async () => {
      const guard = new StateGuard(config);
      const guardContext = {
        currentState: mockState,
        proposedState: { currentStep: 'step2' }, // Valid transition from step1 to step2
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true);
    });

    it('should fail validation for invalid state structure', async () => {
      const guard = new StateGuard(config);
      const invalidState = null as any;
      const guardContext = {
        currentState: invalidState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate required fields', async () => {
      const guardConfig: StateGuardConfiguration = {
        ...config,
        conditionalSteps: {
          any: {
            requiredFields: ['currentStep', 'version', 'lastModified'],
          },
        },
      };
      const guard = new StateGuard(guardConfig);
      const stateWithMissingField = {
        ...mockState,
        currentStep: undefined as any,
      };
      const guardContext = {
        currentState: stateWithMissingField,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.code).toBe('INVALID_STATE_STRUCTURE');
    });
  });

  describe('State Transition Validation', () => {
    it('should allow valid state transitions', async () => {
      const guard = new StateGuard(config);
      const guardContext = {
        currentState: mockState,
        proposedState: { currentStep: 'step2' },
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true);
    });

    it('should block invalid state transitions', async () => {
      const guard = new StateGuard(config);
      const guardContext = {
        currentState: mockState,
        proposedState: { currentStep: 'step4' }, // Invalid: can't go directly from step1 to step4
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.severity).toBe(GuardSeverity.ERROR);
      expect(guardResult.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should block backward transitions when not allowed', async () => {
      const guardConfig: StateGuardConfiguration = {
        ...config,
        allowBackwardTransitions: false,
      };
      const guard = new StateGuard(guardConfig);
      const currentState = { ...mockState, currentStep: 'step2' };
      const guardContext = {
        currentState,
        proposedState: { currentStep: 'step1' }, // Backward transition
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.code).toBe('BACKWARD_TRANSITION_FORBIDDEN');
    });

    it('should validate version progression', async () => {
      const guard = new StateGuard(config);
      const guardContext = {
        currentState: mockState,
        proposedState: {
          currentStep: 'step2',
          version: 0, // Lower than current version
        },
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.code).toBe('INVALID_VERSION_PROGRESSION');
    });
  });

  describe('Completion Validation', () => {
    it('should allow completion from terminal steps', async () => {
      const guard = new StateGuard(config);
      const terminalState = { ...mockState, currentStep: 'step4' };
      const guardContext = {
        currentState: terminalState,
        context: mockContext,
        operation: GuardOperation.COMPLETION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true);
    });

    it('should block completion from non-terminal steps', async () => {
      const guard = new StateGuard(config);
      const guardContext = {
        currentState: mockState, // step1 is not terminal
        context: mockContext,
        operation: GuardOperation.COMPLETION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.code).toBe('NOT_IN_TERMINAL_STEP');
    });
  });

  describe('Event Handling Validation', () => {
    it('should allow event handling in non-terminal steps', async () => {
      const guard = new StateGuard(config);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.EVENT_HANDLING,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true);
    });

    it('should warn about event handling in terminal steps', async () => {
      const guard = new StateGuard(config);
      const terminalState = { ...mockState, currentStep: 'step4' };
      const guardContext = {
        currentState: terminalState,
        context: mockContext,
        operation: GuardOperation.EVENT_HANDLING,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.severity).toBe(GuardSeverity.WARNING);
      expect(guardResult.code).toBe('EVENT_HANDLING_IN_TERMINAL_STEP');
    });
  });

  describe('Step Requirements Validation', () => {
    it('should validate step-specific requirements', async () => {
      const guardConfig: StateGuardConfiguration = {
        ...config,
        conditionalSteps: {
          step2: {
            requiredFields: ['stepData.requiredField1', 'stepData.requiredField2'],
          },
        },
      };
      const guard = new StateGuard(guardConfig);
      const guardContext = {
        currentState: mockState,
        proposedState: {
          currentStep: 'step2',
          stepData: { requiredField1: 'value1' }, // Missing requiredField2
        },
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.code).toBe('STEP_CONDITIONS_NOT_MET');
    });

    it('should allow transitions when all requirements are met', async () => {
      const guardConfig: StateGuardConfiguration = {
        ...config,
        conditionalSteps: {
          step2: {
            requiredFields: ['stepData.requiredField1'],
          },
        },
      };
      const guard = new StateGuard(guardConfig);
      const guardContext = {
        currentState: mockState,
        proposedState: {
          currentStep: 'step2',
          stepData: { requiredField1: 'value1' },
        },
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true);
    });
  });

  describe('Custom Validators', () => {
    it('should run custom step validators', async () => {
      const guardConfig: StateGuardConfiguration = {
        ...config,
        conditionalSteps: {
          step2: {
            requiredFields: [],
            customValidator: (state: any) => {
              return state.stepData?.customField === 'valid';
            },
          },
        },
      };
      const guard = new StateGuard(guardConfig);
      const guardContext = {
        currentState: mockState,
        proposedState: {
          currentStep: 'step2',
          stepData: { customField: 'invalid' },
        },
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.code).toBe('STEP_CONDITIONS_NOT_MET');
    });
  });

  describe('Performance', () => {
    it('should evaluate guards within performance target (<0.5ms)', async () => {
      const guard = new StateGuard(config);
      const guardContext = {
        currentState: mockState,
        proposedState: { currentStep: 'step2' },
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const startTime = Date.now();
      await guard.canExecute(guardContext);
      const evaluationTime = Date.now() - startTime;

      expect(evaluationTime).toBeLessThan(0.5);
    });

    it('should handle multiple evaluations efficiently', async () => {
      const guard = new StateGuard(config);
      const guardContext = {
        currentState: mockState,
        proposedState: { currentStep: 'step2' },
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        await guard.canExecute(guardContext);
      }

      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / iterations;

      expect(averageTime).toBeLessThan(0.5);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing proposed state gracefully', async () => {
      const guard = new StateGuard(config);
      const guardContext = {
        currentState: mockState,
        // Missing proposedState
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.code).toBe('MISSING_PROPOSED_STEP');
    });

    it('should handle malformed context gracefully', async () => {
      const guard = new StateGuard(config);
      const guardContext = {
        currentState: mockState,
        proposedState: { currentStep: 'step2' },
        context: null as any,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('correlationId');
    });
  });
});
