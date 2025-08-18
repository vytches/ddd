/**
 * ProcessManagerTestHarness - Enterprise-grade testing utilities for Process Managers
 *
 * Extends the base TestHarness with Process Manager-specific testing capabilities:
 * - Event simulation and workflow orchestration
 * - State transition validation and verification
 * - Integration with VytchesDDD event systems
 * - Mock implementations for isolated testing
 * - Scenario-based workflow testing
 */

import { TestClock, TestHarness, type TestHarnessOptions } from '@vytches/ddd-testing';
import { safeRun } from '@vytches/ddd-utils';
import type {
  IProcessManager,
  IProcessManagerContext,
  IProcessManagerEvent,
  ProcessManagerResult,
  ProcessManagerStatus,
} from '../../src/interfaces';
import { MockProcessManagerOrchestrator } from '../mocks/mock-process-manager-orchestrator';
import { MockProcessManagerRepository } from '../mocks/mock-process-manager-repository';
import { MockProcessManagerServices } from '../mocks/mock-process-manager-services';
import { MockUnifiedEventBus } from '../mocks/mock-unified-event-bus';

export interface ProcessManagerTestHarnessOptions extends TestHarnessOptions {
  /**
   * Enable event sequence tracking for workflow validation
   */
  enableEventTracking?: boolean;

  /**
   * Enable state transition logging for debugging
   */
  enableStateLogging?: boolean;

  /**
   * Maximum timeout for workflow scenarios
   */
  maxScenarioTimeout?: number;

  /**
   * Enable mock service injection
   */
  enableMockServices?: boolean;
}

export interface StateTransitionAssertion {
  processManagerId: string;
  fromState: string;
  toState: string;
  triggeredBy?: string;
  timeout?: number;
}

export interface WorkflowAssertion {
  processManagerId: string;
  expectedFinalState: string;
  expectedStatus: ProcessManagerStatus;
  timeout?: number;
}

export class ProcessManagerTestHarness extends TestHarness {
  private mockEventBus!: MockUnifiedEventBus;
  private mockOrchestrator!: MockProcessManagerOrchestrator;
  private mockRepository!: MockProcessManagerRepository;
  private mockServices!: MockProcessManagerServices;
  private testClock!: TestClock;

  private eventSequence: IProcessManagerEvent[] = [];
  private stateTransitions: Array<{
    processManagerId: string;
    fromState: string;
    toState: string;
    timestamp: Date;
    triggeredBy: string;
  }> = [];

  protected override readonly options: Required<ProcessManagerTestHarnessOptions>;

  constructor(options: ProcessManagerTestHarnessOptions = {}) {
    super(options);

    this.options = {
      autoCleanup: true,
      enableTimeFreezing: true,
      setupTimeout: 5000,
      teardownTimeout: 5000,
      verbose: false,
      enableEventTracking: true,
      enableStateLogging: false,
      maxScenarioTimeout: 30000,
      enableMockServices: true,
      ...options,
    };
  }

  /**
   * Performs the initialization required by TestHarness
   */
  protected async performInitialization(): Promise<void> {
    // Base initialization - nothing needed for ProcessManagerTestHarness
  }

  /**
   * Perform harness-specific setup logic
   */
  protected async performSetup(): Promise<void> {
    // Setup is handled in the setup() method
  }

  /**
   * Perform harness-specific teardown logic
   */
  protected async performTeardown(): Promise<void> {
    // Teardown is handled via resource disposal
  }

  /**
   * Perform harness-specific reset logic
   */
  protected async performReset(): Promise<void> {
    this.clearTrackingData();
  }

  /**
   * Perform harness-specific disposal logic
   */
  protected async performDisposal(): Promise<void> {
    // Resources are auto-disposed by base class
  }

  override async setup(): Promise<this> {
    await super.setup();

    // Initialize test clock for time control
    this.testClock = TestClock.create();
    if (this.options.enableTimeFreezing) {
      this.testClock.freeze();
    }
    this.registerResource({
      id: 'testClock',
      type: 'TestClock',
      created: new Date(),
      dispose: () => {
        this.testClock.restore();
      },
    });

    // Initialize mock implementations
    this.mockEventBus = new MockUnifiedEventBus({
      enableLogging: this.options.verbose,
      trackEventHistory: this.options.enableEventTracking,
    });
    this.registerResource({
      id: 'mockEventBus',
      type: 'MockUnifiedEventBus',
      created: new Date(),
      dispose: () => {
        // Resource cleanup handled in cleanup()
      },
    });

    this.mockOrchestrator = new MockProcessManagerOrchestrator({
      eventBus: this.mockEventBus,
      enableLogging: this.options.verbose,
    });
    this.registerResource({
      id: 'mockOrchestrator',
      type: 'MockProcessManagerOrchestrator',
      created: new Date(),
      dispose: () => {
        // Resource cleanup handled in cleanup()
      },
    });

    this.mockRepository = new MockProcessManagerRepository({
      enableOptimisticLocking: true,
      enableAuditLog: this.options.verbose,
    });
    this.registerResource({
      id: 'mockRepository',
      type: 'MockProcessManagerRepository',
      created: new Date(),
      dispose: () => {
        // Resource cleanup handled in cleanup()
      },
    });

    if (this.options.enableMockServices) {
      this.mockServices = new MockProcessManagerServices({
        eventBus: this.mockEventBus,
        enableLogging: this.options.verbose,
      });
      this.registerResource({
        id: 'mockServices',
        type: 'MockProcessManagerServices',
        created: new Date(),
        dispose: () => {
          // Resource cleanup handled in cleanup()
        },
      });
    }

    // Setup event tracking if enabled
    if (this.options.enableEventTracking) {
      this.mockEventBus.onEventPublished(event => {
        this.eventSequence.push(event);
      });
    }

    return this;
  }

  /**
   * Creates a test event for process manager testing
   */
  createTestEvent(overrides: Partial<IProcessManagerEvent> = {}): IProcessManagerEvent {
    return {
      id: `test-event-${Date.now()}`,
      eventType: 'TestProcessEvent',
      eventName: 'Test Process Event',
      payload: { test: true },
      aggregateId: `agg-${Date.now()}`,
      aggregateType: 'TestAggregate',
      aggregateVersion: 1,
      timestamp: this.testClock.now(),
      correlationId: `corr-${Date.now()}`,
      causationId: `cause-${Date.now()}`,
      metadata: {},
      ...overrides,
    };
  }

  /**
   * Creates a test context for process manager execution
   */
  createTestContext(overrides: Partial<IProcessManagerContext> = {}): IProcessManagerContext {
    const base: IProcessManagerContext = {
      correlationId: `test-corr-${Date.now()}`,
      userId: 'test-user',
      tenantId: 'test-tenant',
      requestId: `test-req-${Date.now()}`,
      sessionId: `test-session-${Date.now()}`,
      processedAt: this.testClock.now(),
      metadata: {},
      ...overrides,
    };

    if (this.options.enableMockServices && this.mockServices) {
      base.services = this.mockServices;
    }

    return base;
  }

  /**
   * Simulates a sequence of events for workflow testing
   */
  async simulateEventSequence(
    processManager: IProcessManager,
    events: IProcessManagerEvent[],
    delayBetween = 0
  ): Promise<ProcessManagerResult[]> {
    const results: ProcessManagerResult[] = [];

    for (const event of events) {
      if (delayBetween > 0) {
        this.testClock.advance(delayBetween);
      }

      if (processManager.canHandle(event)) {
        const context = this.createTestContext(
          event.correlationId ? { correlationId: event.correlationId } : {}
        );

        const [error, result] = await safeRun(() => processManager.handle(event, context));

        if (error) {
          throw error;
        }

        if (result) {
          results.push(result);

          // Process commands and events from result
          if (result.success) {
            // Dispatch commands to mock services
            if (result.commands && this.mockServices) {
              for (const command of result.commands) {
                await this.mockServices.commandBus.dispatch(command);
              }
            }

            // Publish events to mock event bus
            if (result.events) {
              for (const resultEvent of result.events) {
                const processManagerEvent = this.convertToProcessManagerEvent(resultEvent);
                await this.mockEventBus.publish(processManagerEvent);
              }
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Tracks state transitions for verification
   */
  trackStateTransition(
    processManager: IProcessManager,
    fromState: string,
    triggeredBy: string
  ): void {
    this.stateTransitions.push({
      processManagerId: processManager.id,
      fromState,
      toState: processManager.state.currentStep,
      timestamp: this.testClock.now(),
      triggeredBy,
    });
  }

  /**
   * Verifies that a specific state transition occurred
   */
  verifyStateTransition(assertion: StateTransitionAssertion): void {
    const transition = this.stateTransitions.find(
      t =>
        t.processManagerId === assertion.processManagerId &&
        t.fromState === assertion.fromState &&
        t.toState === assertion.toState &&
        (!assertion.triggeredBy || t.triggeredBy === assertion.triggeredBy)
    );

    if (!transition) {
      throw new Error(
        `Expected state transition from '${assertion.fromState}' to '${assertion.toState}' ` +
          `for process manager '${assertion.processManagerId}' not found`
      );
    }
  }

  /**
   * Asserts that a workflow completed as expected
   */
  async assertWorkflowCompleted(assertion: WorkflowAssertion): Promise<void> {
    const processManager = await this.mockRepository.findById(assertion.processManagerId);

    if (!processManager) {
      throw new Error(`Process manager '${assertion.processManagerId}' not found`);
    }

    if (processManager.state.currentStep !== assertion.expectedFinalState) {
      throw new Error(
        `Expected final state '${assertion.expectedFinalState}', ` +
          `but got '${processManager.state.currentStep}'`
      );
    }

    if (processManager.status !== assertion.expectedStatus) {
      throw new Error(
        `Expected status '${assertion.expectedStatus}', ` + `but got '${processManager.status}'`
      );
    }
  }

  /**
   * Verifies that specific events were emitted during workflow
   */
  verifyEventsEmitted(expectedEventTypes: string[]): void {
    const emittedEventTypes = this.eventSequence.map(e => e.eventType);

    for (const expectedType of expectedEventTypes) {
      if (!emittedEventTypes.includes(expectedType)) {
        throw new Error(
          `Expected event type '${expectedType}' was not emitted. ` +
            `Emitted events: ${emittedEventTypes.join(', ')}`
        );
      }
    }
  }

  /**
   * Verifies the order of events in the sequence
   */
  verifyEventSequence(expectedSequence: string[]): void {
    const actualSequence = this.eventSequence.map(e => e.eventType);

    if (actualSequence.length !== expectedSequence.length) {
      throw new Error(
        `Expected ${expectedSequence.length} events, but got ${actualSequence.length}`
      );
    }

    for (let i = 0; i < expectedSequence.length; i++) {
      if (actualSequence[i] !== expectedSequence[i]) {
        throw new Error(
          `Event sequence mismatch at position ${i}: ` +
            `expected '${expectedSequence[i]}', got '${actualSequence[i]}'`
        );
      }
    }
  }

  /**
   * Gets the mock event bus for direct interaction
   */
  getMockEventBus(): MockUnifiedEventBus {
    return this.mockEventBus;
  }

  /**
   * Gets the mock orchestrator for direct interaction
   */
  getMockOrchestrator(): MockProcessManagerOrchestrator {
    return this.mockOrchestrator;
  }

  /**
   * Gets the mock repository for direct interaction
   */
  getMockRepository(): MockProcessManagerRepository {
    return this.mockRepository;
  }

  /**
   * Gets the test clock for time manipulation
   */
  override getTestClock(): TestClock {
    return this.testClock;
  }

  /**
   * Gets the mock services for direct interaction
   */
  getMockServices(): MockProcessManagerServices | undefined {
    return this.mockServices;
  }

  /**
   * Gets all tracked state transitions
   */
  getStateTransitions(): Array<{
    processManagerId: string;
    fromState: string;
    toState: string;
    timestamp: Date;
    triggeredBy: string;
  }> {
    return [...this.stateTransitions];
  }

  /**
   * Gets the complete event sequence
   */
  getEventSequence(): IProcessManagerEvent[] {
    return [...this.eventSequence];
  }

  /**
   * Clears all tracking data for clean test state
   */
  clearTrackingData(): void {
    this.eventSequence = [];
    this.stateTransitions = [];
    this.mockEventBus.clearHistory();
    this.mockOrchestrator.clearHistory();
    this.mockRepository.clearHistory();
  }

  /**
   * Advances time by specified milliseconds
   */
  advanceTime(milliseconds: number): void {
    this.testClock.advance(milliseconds);
  }

  /**
   * Simulates timeout scenarios for testing
   */
  async simulateTimeout(processManager: IProcessManager, timeoutMs: number): Promise<boolean> {
    const startTime = this.testClock.now().getTime();
    this.testClock.advance(timeoutMs + 1);

    return processManager.isTimedOut();
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
      id: `pm-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType: event.eventType,
      eventName: event.eventType,
      payload: event.payload,
      aggregateId: `pm-aggregate-${Date.now()}`,
      aggregateType: 'ProcessManagerAggregate',
      aggregateVersion: 1,
      timestamp: this.testClock.now(),
      correlationId: `pm-corr-${Date.now()}`,
      causationId: `pm-cause-${Date.now()}`,
      metadata: {
        ...(event.targetBoundedContext && { targetBoundedContext: event.targetBoundedContext }),
      },
    };
  }
}
