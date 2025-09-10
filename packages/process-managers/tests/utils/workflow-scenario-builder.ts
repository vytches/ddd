/**
 * WorkflowScenarioBuilder - Enterprise-grade workflow testing utility
 *
 * Provides fluent API for building complex Process Manager workflow test scenarios:
 * - Event sequence definition
 * - State transition expectations
 * - Command/event emission verification
 * - Timing and timeout testing
 * - Error condition simulation
 * - Multi-process workflow orchestration
 */

import { safeRun } from '@vytches/ddd-utils';
import type {
  IProcessManager,
  IProcessManagerEvent,
  ProcessManagerStatus,
} from '../../src/interfaces';
import type { ProcessManagerTestHarness } from './process-manager-test-harness';

export interface WorkflowStep {
  type: 'event' | 'delay' | 'assertion' | 'timeout-check' | 'custom';
  description?: string;
  event?: IProcessManagerEvent;
  delayMs?: number;
  assertion?: () => void | Promise<void>;
  customAction?: (scenario: ProcessManagerScenario) => void | Promise<void>;
}

export interface WorkflowExpectation {
  type: 'state-change' | 'command-emitted' | 'event-emitted' | 'completion' | 'failure' | 'timeout';
  description?: string;
  processManagerId?: string;
  fromState?: string;
  toState?: string;
  commandType?: string;
  eventType?: string;
  expectedStatus?: ProcessManagerStatus;
  errorMessage?: string;
  withinMs?: number;
}

export interface ProcessManagerScenario {
  name: string;
  description?: string;
  processManager: IProcessManager;
  steps: WorkflowStep[];
  expectations: WorkflowExpectation[];
  harness: ProcessManagerTestHarness;
  timeoutMs: number;
}

export interface ScenarioExecutionResult {
  success: boolean;
  scenarioName: string;
  executionTime: number;
  stepsExecuted: number;
  expectationResults: Array<{
    expectation: WorkflowExpectation;
    satisfied: boolean;
    error?: Error;
    actualValue?: any;
  }>;
  processManagerFinalState: {
    status: ProcessManagerStatus;
    currentStep: string;
    version: number;
  };
  error?: Error;
}

export class WorkflowScenarioBuilder {
  private scenario: Partial<ProcessManagerScenario> = {
    steps: [],
    expectations: [],
    timeoutMs: 30000,
  };

  private constructor() {
    // Private constructor to enforce factory pattern
  }

  /**
   * Creates a new workflow scenario builder
   */
  static create(name: string): WorkflowScenarioBuilder {
    const builder = new WorkflowScenarioBuilder();
    builder.scenario.name = name;
    return builder;
  }

  /**
   * Sets the scenario description
   */
  withDescription(description: string): WorkflowScenarioBuilder {
    this.scenario.description = description;
    return this;
  }

  /**
   * Sets the process manager for this scenario
   */
  withProcessManager(processManager: IProcessManager): WorkflowScenarioBuilder {
    this.scenario.processManager = processManager;
    return this;
  }

  /**
   * Sets the test harness for scenario execution
   */
  withHarness(harness: ProcessManagerTestHarness): WorkflowScenarioBuilder {
    this.scenario.harness = harness;
    return this;
  }

  /**
   * Sets the maximum execution timeout
   */
  withTimeout(timeoutMs: number): WorkflowScenarioBuilder {
    this.scenario.timeoutMs = timeoutMs;
    return this;
  }

  /**
   * Adds an event to the workflow sequence
   */
  whenEvent(event: IProcessManagerEvent, description?: string): WorkflowScenarioBuilder {
    this.scenario.steps!.push({
      type: 'event',
      ...(description && { description }),
      event,
    });
    return this;
  }

  /**
   * Adds a delay to the workflow sequence
   */
  thenWait(delayMs: number, description?: string): WorkflowScenarioBuilder {
    this.scenario.steps!.push({
      type: 'delay',
      description: description || `Wait ${delayMs}ms`,
      delayMs,
    });
    return this;
  }

  /**
   * Adds a custom assertion to the workflow
   */
  thenAssert(assertion: () => void | Promise<void>, description?: string): WorkflowScenarioBuilder {
    this.scenario.steps!.push({
      type: 'assertion',
      ...(description && { description }),
      assertion,
    });
    return this;
  }

  /**
   * Adds a timeout check to the workflow
   */
  thenCheckTimeout(description?: string): WorkflowScenarioBuilder {
    this.scenario.steps!.push({
      type: 'timeout-check',
      ...(description && { description }),
    });
    return this;
  }

  /**
   * Adds a custom action to the workflow
   */
  thenExecute(
    customAction: (scenario: ProcessManagerScenario) => void | Promise<void>,
    description?: string
  ): WorkflowScenarioBuilder {
    this.scenario.steps!.push({
      type: 'custom',
      description: description || 'Custom action',
      customAction,
    });
    return this;
  }

  /**
   * Expects a state change to occur
   */
  expectStateChange(
    fromState: string,
    toState: string,
    withinMs?: number,
    description?: string
  ): WorkflowScenarioBuilder {
    this.scenario.expectations!.push({
      type: 'state-change',
      description: description || `State change from ${fromState} to ${toState}`,
      fromState,
      toState,
      ...(withinMs && { withinMs }),
    });
    return this;
  }

  /**
   * Expects a command to be emitted
   */
  expectCommandEmitted(
    commandType: string,
    withinMs?: number,
    description?: string
  ): WorkflowScenarioBuilder {
    this.scenario.expectations!.push({
      type: 'command-emitted',
      description: description || `Command ${commandType} emitted`,
      commandType,
      ...(withinMs && { withinMs }),
    });
    return this;
  }

  /**
   * Expects an event to be emitted
   */
  expectEventEmitted(
    eventType: string,
    withinMs?: number,
    description?: string
  ): WorkflowScenarioBuilder {
    this.scenario.expectations!.push({
      type: 'event-emitted',
      description: description || `Event ${eventType} emitted`,
      eventType,
      ...(withinMs && { withinMs }),
    });
    return this;
  }

  /**
   * Expects the process to complete
   */
  expectCompletion(withinMs?: number, description?: string): WorkflowScenarioBuilder {
    this.scenario.expectations!.push({
      type: 'completion',
      description: description || 'Process completed',
      expectedStatus: 'COMPLETED' as ProcessManagerStatus,
      ...(withinMs && { withinMs }),
    });
    return this;
  }

  /**
   * Expects the process to fail
   */
  expectFailure(
    errorMessage?: string,
    withinMs?: number,
    description?: string
  ): WorkflowScenarioBuilder {
    this.scenario.expectations!.push({
      type: 'failure',
      description: description || 'Process failed',
      expectedStatus: 'FAILED' as ProcessManagerStatus,
      ...(errorMessage && { errorMessage }),
      ...(withinMs && { withinMs }),
    });
    return this;
  }

  /**
   * Expects the process to timeout
   */
  expectTimeout(withinMs?: number, description?: string): WorkflowScenarioBuilder {
    this.scenario.expectations!.push({
      type: 'timeout',
      description: description || 'Process timed out',
      expectedStatus: 'TIMED_OUT' as ProcessManagerStatus,
      ...(withinMs && { withinMs }),
    });
    return this;
  }

  /**
   * Executes the workflow scenario
   */
  async execute(): Promise<ScenarioExecutionResult> {
    const scenario = this.scenario as ProcessManagerScenario;

    if (!scenario.processManager) {
      throw new Error('Process manager must be set before execution');
    }

    if (!scenario.harness) {
      throw new Error('Test harness must be set before execution');
    }

    const startTime = Date.now();
    const executionResult: ScenarioExecutionResult = {
      success: false,
      scenarioName: scenario.name,
      executionTime: 0,
      stepsExecuted: 0,
      expectationResults: [],
      processManagerFinalState: {
        status: scenario.processManager.status,
        currentStep: scenario.processManager.state.currentStep,
        version: scenario.processManager.state.version,
      },
    };

    try {
      // Execute workflow steps
      await this.executeSteps(scenario, executionResult);

      // Verify expectations
      await this.verifyExpectations(scenario, executionResult);

      // Check overall success
      executionResult.success = executionResult.expectationResults.every(r => r.satisfied);

      // Debug: Log failed expectations
      if (!executionResult.success) {
        const failedExpectations = executionResult.expectationResults.filter(r => !r.satisfied);
        console.log(
          'Failed expectations:',
          failedExpectations.map(f => ({
            type: f.expectation.type,
            description: f.expectation.description,
            error: f.error?.message,
            actualValue: f.actualValue,
          }))
        );
      }
    } catch (error) {
      executionResult.error = error as Error;
      executionResult.success = false;
      console.log('Scenario execution failed:', {
        scenarioName: scenario.name,
        error: (error as Error).message,
        stepsExecuted: executionResult.stepsExecuted,
        expectations: scenario.expectations.length,
        expectationResults: executionResult.expectationResults.length,
      });
    } finally {
      executionResult.executionTime = Date.now() - startTime;
      executionResult.processManagerFinalState = {
        status: scenario.processManager.status,
        currentStep: scenario.processManager.state.currentStep,
        version: scenario.processManager.state.version,
      };
    }

    return executionResult;
  }

  private async executeSteps(
    scenario: ProcessManagerScenario,
    result: ScenarioExecutionResult
  ): Promise<void> {
    for (const [index, step] of scenario.steps.entries()) {
      result.stepsExecuted = index + 1;

      switch (step.type) {
        case 'event':
          await this.executeEventStep(scenario, step);
          break;

        case 'delay':
          scenario.harness.advanceTime(step.delayMs!);
          break;

        case 'assertion':
          if (step.assertion) {
            await step.assertion();
          }
          break;

        case 'timeout-check':
          if (scenario.processManager.isTimedOut()) {
            break; // Timeout detected, stop execution
          }
          break;

        case 'custom':
          if (step.customAction) {
            await step.customAction(scenario);
          }
          break;
      }
    }
  }

  private async executeEventStep(
    scenario: ProcessManagerScenario,
    step: WorkflowStep
  ): Promise<void> {
    if (!step.event) {
      throw new Error('Event step missing event data');
    }

    if (scenario.processManager.canHandle(step.event)) {
      // Capture the previous state before processing
      const previousState = scenario.processManager.state.currentStep;

      const context = scenario.harness.createTestContext(
        step.event.correlationId ? { correlationId: step.event.correlationId } : {}
      );

      const [error, result] = await safeRun(() =>
        scenario.processManager.handle(step.event!, context)
      );

      if (error) {
        scenario.processManager.fail(error);
        throw error;
      }

      // Process commands and events from result
      if (result?.success) {
        // Track state transition if state actually changed
        if (scenario.processManager.state.currentStep !== previousState) {
          scenario.harness.trackStateTransition(
            scenario.processManager,
            previousState,
            step.event.eventType
          );
        }

        // Dispatch commands to mock services
        if (result.commands) {
          const services = scenario.harness.getMockServices();
          if (services) {
            for (const command of result.commands) {
              await services.commandBus.dispatch(command);
            }
          }
        }

        // Publish events to mock event bus
        if (result.events) {
          const eventBus = scenario.harness.getMockEventBus();
          for (const event of result.events) {
            const processManagerEvent = this.convertToProcessManagerEvent(event);
            await eventBus.publish(processManagerEvent);
          }
        }
      }
    }
  }

  private async verifyExpectations(
    scenario: ProcessManagerScenario,
    result: ScenarioExecutionResult
  ): Promise<void> {
    for (const expectation of scenario.expectations) {
      const expectationResult: {
        expectation: WorkflowExpectation;
        satisfied: boolean;
        error?: Error;
        actualValue?: any;
      } = {
        expectation,
        satisfied: false,
      };

      try {
        switch (expectation.type) {
          case 'state-change':
            expectationResult.satisfied = this.verifyStateChange(scenario, expectation);
            break;

          case 'command-emitted':
            expectationResult.satisfied = this.verifyCommandEmitted(scenario, expectation);
            break;

          case 'event-emitted':
            expectationResult.satisfied = this.verifyEventEmitted(scenario, expectation);
            break;

          case 'completion':
          case 'failure':
          case 'timeout':
            expectationResult.satisfied = this.verifyStatusExpectation(scenario, expectation);
            expectationResult.actualValue = scenario.processManager.status;
            break;
        }
      } catch (error) {
        expectationResult.error = error as Error;
        expectationResult.satisfied = false;
      }

      result.expectationResults.push({
        expectation: expectationResult.expectation,
        satisfied: expectationResult.satisfied,
        ...(expectationResult.error && { error: expectationResult.error }),
        ...(expectationResult.actualValue !== undefined && {
          actualValue: expectationResult.actualValue,
        }),
      });
    }
  }

  private verifyStateChange(
    scenario: ProcessManagerScenario,
    expectation: WorkflowExpectation
  ): boolean {
    try {
      scenario.harness.verifyStateTransition({
        processManagerId: scenario.processManager.id,
        fromState: expectation.fromState!,
        toState: expectation.toState!,
      });
      return true;
    } catch {
      return false;
    }
  }

  private verifyCommandEmitted(
    scenario: ProcessManagerScenario,
    expectation: WorkflowExpectation
  ): boolean {
    const services = scenario.harness.getMockServices();
    if (services) {
      return services.verifyCommandDispatched(expectation.commandType!);
    }
    return false;
  }

  private verifyEventEmitted(
    scenario: ProcessManagerScenario,
    expectation: WorkflowExpectation
  ): boolean {
    const eventBus = scenario.harness.getMockEventBus();
    return eventBus.verifyEventPublished(expectation.eventType!);
  }

  private verifyStatusExpectation(
    scenario: ProcessManagerScenario,
    expectation: WorkflowExpectation
  ): boolean {
    return scenario.processManager.status === expectation.expectedStatus;
  }

  /**
   * Converts a simple event from ProcessManagerResult to a full IProcessManagerEvent
   */
  private convertToProcessManagerEvent(event: {
    eventType: string;
    payload: unknown;
    targetBoundedContext?: string;
  }): IProcessManagerEvent {
    return {
      id: `workflow-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType: event.eventType,
      eventName: event.eventType,
      payload: event.payload,
      aggregateId: `workflow-aggregate-${Date.now()}`,
      aggregateType: 'WorkflowAggregate',
      aggregateVersion: 1,
      timestamp: new Date(),
      correlationId: `workflow-corr-${Date.now()}`,
      causationId: `workflow-cause-${Date.now()}`,
      metadata: {
        ...(event.targetBoundedContext && { targetBoundedContext: event.targetBoundedContext }),
      },
    };
  }
}

/**
 * Utility function to create multiple scenarios for comprehensive testing
 */
export class WorkflowScenarioSuite {
  private scenarios: WorkflowScenarioBuilder[] = [];

  static create(): WorkflowScenarioSuite {
    return new WorkflowScenarioSuite();
  }

  addScenario(scenario: WorkflowScenarioBuilder): WorkflowScenarioSuite {
    this.scenarios.push(scenario);
    return this;
  }

  async executeAll(): Promise<ScenarioExecutionResult[]> {
    const results: ScenarioExecutionResult[] = [];

    for (const scenario of this.scenarios) {
      const result = await scenario.execute();
      results.push(result);
    }

    return results;
  }

  async executeParallel(): Promise<ScenarioExecutionResult[]> {
    const promises = this.scenarios.map(scenario => scenario.execute());
    return Promise.all(promises);
  }
}
