/**
 * ConcurrencyTestHelper - Utilities for testing concurrent Process Manager operations
 *
 * Provides specialized testing utilities for:
 * - Race condition simulation
 * - Concurrent state updates
 * - Optimistic locking conflicts
 * - Parallel event processing
 * - Deadlock detection
 * - Performance under load
 */

import { safeRun } from '@vytches/ddd-utils';
import type {
  IProcessManager,
  IProcessManagerEvent,
  ProcessManagerResult,
} from '../../src/interfaces';
import type { ProcessManagerTestHarness } from '../utils/process-manager-test-harness';

export interface ConcurrentOperation {
  id: string;
  type: 'event' | 'state-update' | 'timeout-check' | 'completion';
  event?: IProcessManagerEvent;
  stateUpdate?: Record<string, unknown>;
  delayMs?: number;
  priority?: number;
}

export interface ConcurrencyTestResult {
  operation: ConcurrentOperation;
  success: boolean;
  executionTime: number;
  error?: Error;
  result?: ProcessManagerResult;
  finalState?: any;
}

export interface RaceConditionScenario {
  name: string;
  operations: ConcurrentOperation[];
  expectedWinner?: string; // ID of operation expected to win
  allowedWinners?: string[]; // Multiple acceptable winners
  maxExecutionTime?: number;
}

export interface LoadTestScenario {
  name: string;
  concurrentOperations: number;
  operationsPerSecond: number;
  durationMs: number;
  operationFactory: (index: number) => ConcurrentOperation;
}

export class ConcurrencyTestHelper {
  private harness: ProcessManagerTestHarness;
  private results: ConcurrencyTestResult[] = [];

  constructor(harness: ProcessManagerTestHarness) {
    this.harness = harness;
  }

  /**
   * Simulates concurrent operations on a process manager
   */
  async simulateConcurrentOperations(
    processManager: IProcessManager,
    operations: ConcurrentOperation[]
  ): Promise<ConcurrencyTestResult[]> {
    this.results = [];

    // Sort by priority (higher priority first) and apply delays
    const sortedOperations = [...operations].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Execute operations concurrently
    const promises = sortedOperations.map(async (operation, index) => {
      // Apply delay if specified
      if (operation.delayMs) {
        await new Promise(resolve => setTimeout(resolve, operation.delayMs));
      }

      const startTime = Date.now();
      const result: ConcurrencyTestResult = {
        operation,
        success: false,
        executionTime: 0,
      };

      try {
        switch (operation.type) {
          case 'event':
            if (operation.event) {
              result.result = await this.executeEventOperation(processManager, operation.event);
              result.success = result.result?.success || false;
            }
            break;

          case 'state-update':
            if (operation.stateUpdate) {
              processManager.updateState(operation.stateUpdate);
              result.success = true;
            }
            break;

          case 'timeout-check':
            result.success = true;
            result.result = { success: processManager.isTimedOut() } as any;
            break;

          case 'completion':
            processManager.complete();
            result.success = true;
            break;
        }

        result.finalState = {
          status: processManager.status,
          currentStep: processManager.state.currentStep,
          version: processManager.state.version,
        };
      } catch (error) {
        result.error = error as Error;
        result.success = false;
      } finally {
        result.executionTime = Date.now() - startTime;
      }

      return result;
    });

    const results = await Promise.allSettled(promises);

    // Collect results
    this.results = results.map(result =>
      result.status === 'fulfilled'
        ? result.value
        : {
            operation: { id: 'failed', type: 'event' as const },
            success: false,
            executionTime: 0,
            error: result.reason,
          }
    );

    return this.results;
  }

  /**
   * Tests race conditions between operations
   */
  async testRaceCondition(
    processManager: IProcessManager,
    scenario: RaceConditionScenario
  ): Promise<{
    winnerOperation: ConcurrentOperation;
    results: ConcurrencyTestResult[];
    raceConditionDetected: boolean;
    scenario: RaceConditionScenario;
  }> {
    if (scenario.operations.length === 0) {
      throw new Error('Race condition scenario must have at least one operation');
    }

    const startTime = Date.now();
    const results = await this.simulateConcurrentOperations(processManager, scenario.operations);
    const executionTime = Date.now() - startTime;

    // Find the winning operation (first successful one, or specific criteria)
    const successfulResults = results.filter(r => r.success);
    let winnerOperation: ConcurrentOperation;

    const firstSuccessful = successfulResults[0];
    if (firstSuccessful) {
      winnerOperation = firstSuccessful.operation;
    } else {
      // We already checked that scenario.operations has at least one element
      winnerOperation = scenario.operations[0]!;
    }

    // Detect race condition
    let raceConditionDetected = false;

    if (scenario.expectedWinner) {
      raceConditionDetected = winnerOperation.id !== scenario.expectedWinner;
    } else if (scenario.allowedWinners) {
      raceConditionDetected = !scenario.allowedWinners.includes(winnerOperation.id);
    } else {
      // General race condition detection: multiple operations succeeded simultaneously
      const simultaneousSuccesses = results.filter(r => r.success && r.executionTime < 10);
      raceConditionDetected = simultaneousSuccesses.length > 1;
    }

    return {
      winnerOperation,
      results,
      raceConditionDetected,
      scenario,
    };
  }

  /**
   * Tests optimistic locking conflicts
   */
  async testOptimisticLockingConflict(
    processManager: IProcessManager,
    concurrentUpdates: Array<{ id: string; stateUpdate: Record<string, unknown> }>
  ): Promise<{
    conflicts: number;
    successfulUpdates: number;
    results: ConcurrencyTestResult[];
  }> {
    const operations: ConcurrentOperation[] = concurrentUpdates.map(update => ({
      id: update.id,
      type: 'state-update',
      stateUpdate: update.stateUpdate,
    }));

    const results = await this.simulateConcurrentOperations(processManager, operations);

    const conflicts = results.filter(
      r =>
        (!r.success && r.error?.message.includes('version')) ||
        r.error?.message.includes('conflict')
    ).length;

    const successfulUpdates = results.filter(r => r.success).length;

    return {
      conflicts,
      successfulUpdates,
      results,
    };
  }

  /**
   * Performs load testing with concurrent operations
   */
  async performLoadTest(
    processManager: IProcessManager,
    scenario: LoadTestScenario
  ): Promise<{
    scenario: LoadTestScenario;
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageExecutionTime: number;
    maxExecutionTime: number;
    operationsPerSecond: number;
    errors: Error[];
  }> {
    const startTime = Date.now();
    const operations: ConcurrentOperation[] = [];

    // Generate operations
    for (let i = 0; i < scenario.concurrentOperations; i++) {
      operations.push(scenario.operationFactory(i));
    }

    // Execute load test
    const results = await this.simulateConcurrentOperations(processManager, operations);
    const endTime = Date.now();

    // Calculate statistics
    const successfulOperations = results.filter(r => r.success).length;
    const failedOperations = results.filter(r => !r.success).length;
    const executionTimes = results.map(r => r.executionTime);
    const averageExecutionTime =
      executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    const maxExecutionTime = Math.max(...executionTimes);
    const totalExecutionTime = endTime - startTime;
    const operationsPerSecond = (results.length / totalExecutionTime) * 1000;
    const errors = results.filter(r => r.error).map(r => r.error!);

    return {
      scenario,
      totalOperations: results.length,
      successfulOperations,
      failedOperations,
      averageExecutionTime,
      maxExecutionTime,
      operationsPerSecond,
      errors,
    };
  }

  /**
   * Tests timeout precision under concurrent operations
   */
  async testTimeoutPrecision(
    processManager: IProcessManager,
    expectedTimeoutMs: number,
    toleranceMs = 50
  ): Promise<{
    actualTimeoutMs: number;
    withinTolerance: boolean;
    concurrentOperationsActive: number;
  }> {
    const startTime = Date.now();

    // Start some concurrent operations
    const concurrentOps: ConcurrentOperation[] = Array.from({ length: 5 }, (_, i) => ({
      id: `concurrent-${i}`,
      type: 'timeout-check',
      delayMs: Math.random() * 100,
    }));

    // Start concurrent operations
    const concurrentPromise = this.simulateConcurrentOperations(processManager, concurrentOps);

    // Wait for timeout detection
    const checkInterval = 10;
    let actualTimeoutMs = 0;

    while (actualTimeoutMs < expectedTimeoutMs + toleranceMs * 2) {
      if (processManager.isTimedOut()) {
        actualTimeoutMs = Date.now() - startTime;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
      actualTimeoutMs = Date.now() - startTime;
    }

    const concurrentResults = await concurrentPromise;
    const concurrentOperationsActive = concurrentResults.filter(r => r.success).length;

    const withinTolerance = Math.abs(actualTimeoutMs - expectedTimeoutMs) <= toleranceMs;

    return {
      actualTimeoutMs,
      withinTolerance,
      concurrentOperationsActive,
    };
  }

  /**
   * Simulates deadlock scenarios
   */
  async testDeadlockDetection(
    processManager1: IProcessManager,
    processManager2: IProcessManager,
    crossDependentEvents: {
      event1ForPM2: IProcessManagerEvent;
      event2ForPM1: IProcessManagerEvent;
    }
  ): Promise<{
    deadlockDetected: boolean;
    deadlockTimeMs: number;
    resolution: 'timeout' | 'error' | 'success' | 'unknown';
  }> {
    const startTime = Date.now();
    let deadlockDetected = false;
    let resolution: 'timeout' | 'error' | 'success' | 'unknown' = 'unknown';

    try {
      // Execute cross-dependent operations simultaneously
      const promise1 = this.executeEventOperation(
        processManager2,
        crossDependentEvents.event1ForPM2
      );
      const promise2 = this.executeEventOperation(
        processManager1,
        crossDependentEvents.event2ForPM1
      );

      // Race against timeout
      const raceResult = await Promise.race([
        Promise.all([promise1, promise2]).then(() => 'success'),
        new Promise(resolve => setTimeout(() => resolve('timeout'), 5000)),
      ]);

      if (raceResult === 'timeout') {
        deadlockDetected = true;
        resolution = 'timeout';
      } else {
        resolution = 'success';
      }
    } catch (error) {
      resolution = 'error';
      // Analyze error to determine if it's deadlock-related
      if (error instanceof Error && error.message.includes('deadlock')) {
        deadlockDetected = true;
      }
    }

    const deadlockTimeMs = Date.now() - startTime;

    return {
      deadlockDetected,
      deadlockTimeMs,
      resolution,
    };
  }

  /**
   * Gets the results from the last concurrent operation test
   */
  getLastResults(): ConcurrencyTestResult[] {
    return [...this.results];
  }

  /**
   * Clears all test results
   */
  clearResults(): void {
    this.results = [];
  }

  private async executeEventOperation(
    processManager: IProcessManager,
    event: IProcessManagerEvent
  ): Promise<ProcessManagerResult> {
    if (!processManager.canHandle(event)) {
      throw new Error(`Process manager cannot handle event ${event.eventType}`);
    }

    const context = this.harness.createTestContext(
      event.correlationId ? { correlationId: event.correlationId } : {}
    );

    const [error, result] = await safeRun(() => processManager.handle(event, context));

    if (error) {
      throw error;
    }

    return result!;
  }
}

/**
 * Utility functions for creating common concurrency test scenarios
 */
export class ConcurrencyScenarios {
  /**
   * Creates a race condition scenario for state updates
   */
  static stateUpdateRace(operationCount = 3): RaceConditionScenario {
    return {
      name: 'State Update Race Condition',
      operations: Array.from({ length: operationCount }, (_, i) => ({
        id: `state-update-${i}`,
        type: 'state-update',
        stateUpdate: { [`field${i}`]: `value${i}` },
        delayMs: Math.random() * 10, // Random delay to increase race condition probability
      })),
    };
  }

  /**
   * Creates a race condition scenario for event processing
   */
  static eventProcessingRace(
    events: IProcessManagerEvent[],
    expectedWinner?: string
  ): RaceConditionScenario {
    return {
      name: 'Event Processing Race Condition',
      operations: events.map((event, i) => ({
        id: `event-${i}`,
        type: 'event',
        event,
        delayMs: Math.random() * 5,
      })),
      ...(expectedWinner && { expectedWinner }),
    };
  }

  /**
   * Creates a high-load test scenario
   */
  static highLoadTest(concurrentOperations = 100, operationsPerSecond = 50): LoadTestScenario {
    return {
      name: 'High Load Test',
      concurrentOperations,
      operationsPerSecond,
      durationMs: 10000,
      operationFactory: index => ({
        id: `load-op-${index}`,
        type: 'timeout-check',
        delayMs: (index / operationsPerSecond) * 1000, // Spread operations over time
      }),
    };
  }
}
