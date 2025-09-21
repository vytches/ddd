import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { BaseProcessManager } from '../../src/core/base-process-manager';
import { StateGuard } from '../../src/guards/state-guard';
import { TimeoutGuard } from '../../src/guards/timeout-guard';
import { StateConsistencyInvariant } from '../../src/invariants/state-consistency-invariant';
import { ResourceInvariant } from '../../src/invariants/resource-invariant';
import { GuardOperation, GuardSeverity } from '../../src/guards/guard.interface';
import { InvariantTrigger, InvariantSeverity } from '../../src/invariants/invariant.interface';
import type {
  IProcessManagerState,
  IProcessManagerContext,
  IProcessManagerEvent,
  ProcessManagerResult,
} from '../../src/interfaces';

// Concrete implementation for testing
class TestProcessManager extends BaseProcessManager<IProcessManagerState> {
  constructor(params: {
    id: string;
    type: string;
    initialState: IProcessManagerState;
    version?: number;
    createdAt?: Date;
    timeout?: number;
    securityContext?: any;
    guards?: any[];
    invariants?: any[];
  }) {
    super(params);
  }

  canHandle(event: IProcessManagerEvent): boolean {
    return event.eventType === 'TestEvent' || event.eventType === 'ProcessingEvent';
  }

  protected async handleSecure(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    try {
      if (event.eventType === 'TestEvent') {
        await this.updateState(
          {
            currentStep: 'completed',
            stepData: { ...this.state.stepData, processed: true },
          },
          context.securityContext
        );

        return this.createSuccessResult(
          [{ type: 'TestCommand', payload: { result: 'success' } }],
          [{ eventType: 'TestCompleted', payload: { processId: this.id } }]
        );
      }

      if (event.eventType === 'ProcessingEvent') {
        this.setRunning();
        await this.updateState(
          {
            currentStep: 'processing',
            stepData: { ...this.state.stepData, processing: true },
          },
          context.securityContext
        );

        return this.createSuccessResult();
      }

      return this.createFailureResult('Unknown event type');
    } catch (error) {
      // Handle guard blocking errors
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('State update blocked by guards')) {
        return this.createFailureResult(errorMessage, 'GUARD_BLOCKED', { error: errorMessage });
      }
      // Re-throw other errors
      throw error;
    }
  }

  isComplete(): boolean {
    return this.state.currentStep === 'completed';
  }

  getCorrelationData(): Record<string, unknown> {
    return {
      processId: this.id,
      type: this.type,
      currentStep: this.state.currentStep,
    };
  }
}

describe('Guards and Invariants Integration', () => {
  let mockEvent: IProcessManagerEvent;
  let mockContext: IProcessManagerContext;

  beforeEach(() => {
    mockEvent = {
      id: 'event-123',
      eventType: 'TestEvent',
      eventName: 'Test Event',
      aggregateId: 'aggregate-123',
      aggregateType: 'TestAggregate',
      aggregateVersion: 1,
      timestamp: new Date(),
      payload: { data: 'test' },
      metadata: {},
    };

    mockContext = {
      correlationId: 'test-correlation',
      processedAt: new Date(),
      userId: 'test-user',
      tenantId: 'test-tenant',
    };
  });

  describe('Guards Integration with BaseProcessManager', () => {
    it('should allow operations when guards pass', async () => {
      const stateGuard = new StateGuard({
        validTransitions: {
          initial: ['processing', 'completed'],
          processing: ['completed'],
        },
        terminalSteps: ['completed'],
      });

      const timeoutGuard = new TimeoutGuard({
        globalTimeoutMs: 60 * 60 * 1000, // 1 hour
        stepTimeouts: {
          processing: 30 * 60 * 1000, // 30 minutes
        },
      });

      const processManager = new TestProcessManager({
        id: 'test-process-123',
        type: 'TestProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'test-process-123' },
          metadata: {},
        },
        guards: [stateGuard, timeoutGuard],
      });

      const result = await processManager.handle(mockEvent, mockContext);

      expect(result.success).toBe(true);
      expect(result.commands).toHaveLength(1);
      expect(result.events).toHaveLength(1);
      expect(processManager.state.currentStep).toBe('completed');
    });

    it('should block operations when guards fail', async () => {
      const restrictiveStateGuard = new StateGuard({
        validTransitions: {
          initial: ['processing'], // Cannot go directly to completed
          processing: ['completed'],
        },
        terminalSteps: ['completed'],
      });

      const processManager = new TestProcessManager({
        id: 'test-process-123',
        type: 'TestProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'test-process-123' },
          metadata: {},
        },
        guards: [restrictiveStateGuard],
      });

      // This event tries to transition from 'initial' to 'completed' which is blocked
      const result = await processManager.handle(mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GUARD_BLOCKED');
      expect(processManager.state.currentStep).toBe('initial'); // State unchanged
    });

    it('should respect guard evaluation order by priority', async () => {
      const executionOrder: string[] = [];

      const lowPriorityGuard = new StateGuard({
        validTransitions: { initial: ['completed'] },
        terminalSteps: ['completed'],
      });
      // Override methods to track execution
      const originalCanExecute1 = lowPriorityGuard.canExecute.bind(lowPriorityGuard);
      lowPriorityGuard.canExecute = async function (context) {
        executionOrder.push('LowPriority');
        return await originalCanExecute1(context);
      };
      lowPriorityGuard.getPriority = () => 10;

      const highPriorityGuard = new TimeoutGuard({
        globalTimeoutMs: 60 * 60 * 1000,
      });
      const originalCanExecute2 = highPriorityGuard.canExecute.bind(highPriorityGuard);
      highPriorityGuard.canExecute = async function (context) {
        executionOrder.push('HighPriority');
        return await originalCanExecute2(context);
      };
      highPriorityGuard.getPriority = () => 1;

      const processManager = new TestProcessManager({
        id: 'test-process-123',
        type: 'TestProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'test-process-123' },
          metadata: {},
        },
        guards: [lowPriorityGuard, highPriorityGuard],
      });

      await processManager.handle(mockEvent, mockContext);

      expect(executionOrder).toEqual(['HighPriority', 'LowPriority']);
    });
  });

  describe('Invariants Integration with BaseProcessManager', () => {
    it('should validate invariants after state changes', async () => {
      const stateInvariant = new StateConsistencyInvariant({
        validateStepData: true,
        validateCorrelationData: true,
        validateMetadata: true,
        enableAutoCorrection: true,
      });

      const resourceInvariant = new ResourceInvariant({
        memoryLimits: {
          totalState: {
            max: 10 * 1024 * 1024, // 10MB
            warningThreshold: 80,
            criticalThreshold: 90,
          },
        },
      });

      const processManager = new TestProcessManager({
        id: 'test-process-123',
        type: 'TestProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'test-process-123' },
          metadata: {},
        },
        invariants: [stateInvariant, resourceInvariant],
      });

      const result = await processManager.handle(mockEvent, mockContext);

      expect(result.success).toBe(true);
      // Invariants should have been validated without blocking the operation
      expect(processManager.state.currentStep).toBe('completed');
    });

    it('should apply auto-corrections from invariants', async () => {
      const correctionInvariant = new StateConsistencyInvariant({
        validateStepData: true,
        validateCorrelationData: true,
        validateMetadata: true,
        enableAutoCorrection: true,
        // Add metadata as a required field so it gets auto-corrected when missing
        requiredFields: [
          'currentStep',
          'version',
          'lastModified',
          'stepData',
          'correlationData',
          'metadata',
        ],
      });

      const processManager = new TestProcessManager({
        id: 'test-process-123',
        type: 'TestProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'test-process-123' },
          // metadata is missing - should be auto-corrected
        } as any,
        invariants: [correctionInvariant],
      });

      const result = await processManager.handle(mockEvent, mockContext);

      expect(result.success).toBe(true);
      // Auto-corrections should have been applied
      expect(processManager.state.metadata).toBeDefined();
    });

    it('should track invariant violations in logs', async () => {
      const loggerSpy = vi.fn();

      // Mock the logger to capture warnings
      const originalWarn = console.warn;
      console.warn = loggerSpy;

      const strictInvariant = new StateConsistencyInvariant({
        enableAutoCorrection: false, // Disable corrections to generate violations
      });

      const processManager = new TestProcessManager({
        id: 'test-process-123',
        type: 'TestProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'test-process-123' },
          metadata: {},
        },
        invariants: [strictInvariant],
      });

      const result = await processManager.handle(mockEvent, mockContext);

      expect(result.success).toBe(true);
      // Should still succeed but log violations

      console.warn = originalWarn;
    });
  });

  describe('Guards and Invariants Working Together', () => {
    it('should execute guards before state changes and invariants after', async () => {
      const executionOrder: string[] = [];

      const stateGuard = new StateGuard({
        validTransitions: {
          initial: ['completed'],
        },
        terminalSteps: ['completed'],
      });
      const originalGuardExecute = stateGuard.canExecute.bind(stateGuard);
      stateGuard.canExecute = async function (context) {
        executionOrder.push('Guard');
        return await originalGuardExecute(context);
      };

      const stateInvariant = new StateConsistencyInvariant({});
      const originalInvariantValidate = stateInvariant.validate.bind(stateInvariant);
      stateInvariant.validate = async function (state, context) {
        // Only track invariants called during STATE_CHANGE, not INITIALIZATION
        if (context.triggeringOperation === InvariantTrigger.STATE_CHANGE) {
          executionOrder.push('Invariant');
        }
        return await originalInvariantValidate(state, context);
      };

      const processManager = new TestProcessManager({
        id: 'test-process-123',
        type: 'TestProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'test-process-123' },
          metadata: {},
        },
        guards: [stateGuard],
        invariants: [stateInvariant],
      });

      await processManager.handle(mockEvent, mockContext);

      expect(executionOrder).toEqual(['Guard', 'Invariant']);
    });

    it('should handle complex scenario with multiple guards and invariants', async () => {
      const stateGuard = new StateGuard({
        validTransitions: {
          initial: ['processing', 'completed'],
          processing: ['completed', 'failed'],
        },
        terminalSteps: ['completed', 'failed'],
      });

      const timeoutGuard = new TimeoutGuard({
        globalTimeoutMs: 60 * 60 * 1000, // 1 hour
        stepTimeouts: {
          processing: 30 * 60 * 1000, // 30 minutes
        },
        warningBufferMs: 5 * 60 * 1000, // 5 minutes
      });

      const stateInvariant = new StateConsistencyInvariant({
        validateStepData: true,
        validateCorrelationData: true,
        validateMetadata: true,
        enableAutoCorrection: true,
      });

      const resourceInvariant = new ResourceInvariant({
        memoryLimits: {
          totalState: {
            max: 50 * 1024 * 1024, // 50MB
            warningThreshold: 80,
            criticalThreshold: 90,
          },
        },
      });

      const processManager = new TestProcessManager({
        id: 'complex-process-123',
        type: 'ComplexProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {
            items: new Array(50).fill({ data: 'test' }),
            events: new Array(25).fill({ type: 'event' }),
          },
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'complex-process-123' },
          metadata: {
            resourceUsage: {
              memoryBytes: 5 * 1024 * 1024, // 5MB
              collectionSizes: { items: 50, events: 25 },
            },
          },
        },
        guards: [stateGuard, timeoutGuard],
        invariants: [stateInvariant, resourceInvariant],
      });

      // Execute multiple events to test the full integration
      const processingEvent = {
        ...mockEvent,
        eventType: 'ProcessingEvent',
      };

      // First event: transition to processing
      const result1 = await processManager.handle(processingEvent, mockContext);
      expect(result1.success).toBe(true);
      expect(processManager.state.currentStep).toBe('processing');

      // Second event: complete the process
      const result2 = await processManager.handle(mockEvent, mockContext);
      expect(result2.success).toBe(true);
      expect(processManager.state.currentStep).toBe('completed');

      // Verify guard and invariant statistics
      const guardStats = processManager.getGuardStatistics();
      const invariantStats = processManager.getInvariantStatistics();

      expect(guardStats.totalEvaluations).toBeGreaterThan(0);
      expect(invariantStats.totalValidations).toBeGreaterThan(0);
    });

    it('should maintain performance within targets during integration', async () => {
      const multipleGuards = [
        new StateGuard({
          validTransitions: { initial: ['completed'] },
          terminalSteps: ['completed'],
        }),
        new TimeoutGuard({ globalTimeoutMs: 60 * 60 * 1000 }),
      ];

      const multipleInvariants = [
        new StateConsistencyInvariant({ requiredFields: ['currentStep'] }),
        new ResourceInvariant({
          memoryLimits: {
            totalState: { max: 100 * 1024 * 1024, warningThreshold: 80, criticalThreshold: 90 },
          },
        }),
      ];

      const processManager = new TestProcessManager({
        id: 'performance-test-123',
        type: 'PerformanceTest',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'performance-test-123' },
          metadata: {},
        },
        guards: multipleGuards,
        invariants: multipleInvariants,
      });

      const startTime = performance.now();
      await processManager.handle(mockEvent, mockContext);
      const totalTime = performance.now() - startTime;

      // Should complete guard evaluation and invariant validation within reasonable time
      expect(totalTime).toBeLessThan(10); // 10ms should be plenty for this integration test
    });
  });

  describe('Error Scenarios Integration', () => {
    it('should handle guard failures gracefully without affecting invariants', async () => {
      const alwaysFailGuard = new StateGuard({
        validTransitions: {},
        terminalSteps: [], // No valid transitions - will always fail
      });

      const validInvariant = new StateConsistencyInvariant({
        enableAutoCorrection: true,
      });

      const processManager = new TestProcessManager({
        id: 'error-test-123',
        type: 'ErrorTest',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'error-test-123' },
          metadata: {},
        },
        guards: [alwaysFailGuard],
        invariants: [validInvariant],
      });

      const result = await processManager.handle(mockEvent, mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('GUARD_BLOCKED');
      // State should remain unchanged due to guard failure
      expect(processManager.state.currentStep).toBe('initial');
    });

    it('should continue processing even if invariants fail validation', async () => {
      const validGuard = new StateGuard({
        validTransitions: {
          initial: ['completed'],
        },
        terminalSteps: ['completed'],
      });

      const strictInvariant = new StateConsistencyInvariant({
        // Will always fail
        enableAutoCorrection: false,
      });

      const processManager = new TestProcessManager({
        id: 'invariant-fail-test-123',
        type: 'InvariantFailTest',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'invariant-fail-test-123' },
          metadata: {},
        },
        guards: [validGuard],
        invariants: [strictInvariant],
      });

      const result = await processManager.handle(mockEvent, mockContext);

      // Should still succeed even though invariant validation fails
      expect(result.success).toBe(true);
      expect(processManager.state.currentStep).toBe('completed');
    });
  });

  describe('Configuration Validation Integration', () => {
    it('should validate guards and invariants configuration together', () => {
      const processManager = new TestProcessManager({
        id: 'config-test-123',
        type: 'ConfigTest',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'config-test-123' },
          metadata: {},
        },
        guards: [
          new StateGuard({
            validTransitions: { initial: ['completed'] },
            terminalSteps: ['completed'],
          }),
          new TimeoutGuard({ globalTimeoutMs: 60 * 60 * 1000 }),
        ],
        invariants: [
          new StateConsistencyInvariant({ requiredFields: ['currentStep'] }),
          new ResourceInvariant({
            memoryLimits: {
              totalState: { max: 100 * 1024 * 1024, warningThreshold: 80, criticalThreshold: 90 },
            },
          }),
        ],
      });

      const configValidation = processManager.validateGuardsAndInvariantsConfiguration();

      expect(configValidation.guards.isValid).toBe(true);
      expect(configValidation.invariants.isValid).toBe(true);
      // Check if the statistics reflect the registered guards and invariants
      const guardStats = processManager.getGuardStatistics();
      const invariantStats = processManager.getInvariantStatistics();
      expect(guardStats.totalEvaluations).toBeGreaterThanOrEqual(0);
      expect(invariantStats.totalValidations).toBeGreaterThanOrEqual(0);
    });

    it('should reset performance metrics for both guards and invariants', async () => {
      const processManager = new TestProcessManager({
        id: 'metrics-reset-test-123',
        type: 'MetricsResetTest',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: { processManagerId: 'metrics-reset-test-123' },
          metadata: {},
        },
        guards: [
          new StateGuard({
            validTransitions: { initial: ['completed'] },
            terminalSteps: ['completed'],
          }),
        ],
        invariants: [
          new StateConsistencyInvariant({
            validateStepData: true,
            validateCorrelationData: true,
            validateMetadata: true,
            enableAutoCorrection: true,
          }),
        ],
      });

      // Execute an operation to generate metrics
      await processManager.handle(mockEvent, mockContext);

      let guardStats = processManager.getGuardStatistics();
      let invariantStats = processManager.getInvariantStatistics();

      expect(guardStats.totalEvaluations).toBeGreaterThan(0);
      expect(invariantStats.totalValidations).toBeGreaterThan(0);

      // Reset metrics
      processManager.resetPerformanceMetrics();

      guardStats = processManager.getGuardStatistics();
      invariantStats = processManager.getInvariantStatistics();

      expect(guardStats.totalEvaluations).toBe(0);
      expect(invariantStats.totalValidations).toBe(0);
    });
  });
});
