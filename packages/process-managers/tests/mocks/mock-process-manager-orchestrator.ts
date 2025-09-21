/**
 * MockProcessManagerOrchestrator - Mock implementation for testing Process Manager orchestration
 *
 * Provides a controlled environment for testing process manager workflows:
 * - Event handling simulation
 * - Process manager lifecycle management
 * - History tracking for verification
 * - Error injection for failure scenarios
 */

import { safeRun } from '@vytches/ddd-utils';
import type {
  IProcessManager,
  IProcessManagerContext,
  IProcessManagerEvent,
  ProcessManagerResult,
} from '../../src/interfaces';
import type { MockUnifiedEventBus } from './mock-unified-event-bus';

export interface MockOrchestratorOptions {
  eventBus?: MockUnifiedEventBus;
  enableLogging?: boolean;
  maxConcurrentProcesses?: number;
  defaultTimeout?: number;
}

export interface ProcessManagerRegistration {
  id: string;
  type: string;
  factory: () => IProcessManager;
  canHandle: (event: IProcessManagerEvent) => boolean;
}

export interface EventProcessingHistory {
  event: IProcessManagerEvent;
  processedAt: Date;
  processManagerId?: string;
  result?: ProcessManagerResult;
  error?: Error;
}

export class MockProcessManagerOrchestrator {
  private processManagers = new Map<string, IProcessManager>();
  private registrations = new Map<string, ProcessManagerRegistration>();
  private handledEvents: EventProcessingHistory[] = [];
  private activeProcesses = new Set<string>();

  private options: Required<MockOrchestratorOptions>;

  constructor(options: MockOrchestratorOptions = {}) {
    this.options = {
      eventBus: null as any,
      enableLogging: false,
      maxConcurrentProcesses: 100,
      defaultTimeout: 30000,
      ...options,
    };
  }

  /**
   * Registers a process manager type with the orchestrator
   */
  registerProcessManager(registration: ProcessManagerRegistration): void {
    this.registrations.set(registration.type, registration);

    if (this.options.enableLogging) {
      console.log(`MockOrchestrator: Registered process manager type '${registration.type}'`);
    }
  }

  /**
   * Creates and starts a new process manager instance
   */
  async startProcessManager(
    type: string,
    initialEvent: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<IProcessManager> {
    const registration = this.registrations.get(type);
    if (!registration) {
      throw new Error(`Process manager type '${type}' not registered`);
    }

    if (this.activeProcesses.size >= this.options.maxConcurrentProcesses) {
      throw new Error('Maximum concurrent processes limit reached');
    }

    const processManager = registration.factory();
    this.processManagers.set(processManager.id, processManager);
    this.activeProcesses.add(processManager.id);

    // Process the initial event
    const [error, result] = await safeRun(() => processManager.handle(initialEvent, context));

    this.recordEventProcessing(initialEvent, processManager.id, result, error);

    if (error) {
      this.activeProcesses.delete(processManager.id);
      throw error;
    }

    if (this.options.enableLogging) {
      console.log(
        `MockOrchestrator: Started process manager '${processManager.id}' of type '${type}'`
      );
    }

    return processManager;
  }

  /**
   * Processes an event through all registered process managers
   */
  async processEvent(
    event: IProcessManagerEvent,
    context?: IProcessManagerContext
  ): Promise<ProcessManagerResult[]> {
    const results: ProcessManagerResult[] = [];
    const testContext = context || this.createDefaultContext(event);

    // Find existing process managers that can handle this event
    for (const [id, processManager] of this.processManagers) {
      if (processManager.canHandle(event)) {
        const [error, result] = await safeRun(() => processManager.handle(event, testContext));

        this.recordEventProcessing(event, id, result, error);

        if (error) {
          processManager.fail(error);
          this.activeProcesses.delete(id);
          continue;
        }

        if (result) {
          results.push(result);

          // Check if process is complete
          if (processManager.isComplete()) {
            processManager.complete();
            this.activeProcesses.delete(id);
          }
        }
      }
    }

    // Check for new process managers that should be started
    for (const [type, registration] of this.registrations) {
      if (registration.canHandle(event)) {
        // Check if we already have an active process of this type for this correlation
        const correlationData = this.extractCorrelationData(event);
        const existingProcess = this.findProcessByCorrelation(type, correlationData);

        if (!existingProcess) {
          try {
            const newProcess = await this.startProcessManager(type, event, testContext);
            // The result from starting is already recorded in startProcessManager
          } catch (startError) {
            this.recordEventProcessing(event, undefined, undefined, startError as Error);
          }
        }
      }
    }

    return results;
  }

  /**
   * Gets a process manager by ID
   */
  getProcessManager(id: string): IProcessManager | undefined {
    return this.processManagers.get(id);
  }

  /**
   * Gets all active process managers
   */
  getActiveProcessManagers(): Map<string, IProcessManager> {
    const activeMap = new Map<string, IProcessManager>();

    for (const id of this.activeProcesses) {
      const processManager = this.processManagers.get(id);
      if (processManager) {
        activeMap.set(id, processManager);
      }
    }

    return activeMap;
  }

  /**
   * Gets all handled events with processing history
   */
  getHandledEvents(): EventProcessingHistory[] {
    return [...this.handledEvents];
  }

  /**
   * Gets events handled by a specific process manager
   */
  getEventsForProcessManager(processManagerId: string): EventProcessingHistory[] {
    return this.handledEvents.filter(h => h.processManagerId === processManagerId);
  }

  /**
   * Clears all processing history
   */
  clearHistory(): void {
    this.handledEvents = [];
  }

  /**
   * Simulates orchestrator failure scenarios
   */
  simulateFailure(processManagerId: string, error: Error): void {
    const processManager = this.processManagers.get(processManagerId);
    if (processManager) {
      processManager.fail(error);
      this.activeProcesses.delete(processManagerId);

      if (this.options.enableLogging) {
        console.log(
          `MockOrchestrator: Simulated failure for process manager '${processManagerId}':`,
          error.message
        );
      }
    }
  }

  /**
   * Simulates timeout for process managers
   */
  simulateTimeouts(): string[] {
    const timedOutProcesses: string[] = [];

    for (const [id, processManager] of this.processManagers) {
      if (processManager.isTimedOut()) {
        processManager.fail(new Error('Process timed out'));
        this.activeProcesses.delete(id);
        timedOutProcesses.push(id);

        if (this.options.enableLogging) {
          console.log(`MockOrchestrator: Process manager '${id}' timed out`);
        }
      }
    }

    return timedOutProcesses;
  }

  /**
   * Gets statistics about the orchestrator state
   */
  getStatistics(): {
    totalProcessManagers: number;
    activeProcesses: number;
    completedProcesses: number;
    failedProcesses: number;
    timedOutProcesses: number;
    totalEventsProcessed: number;
  } {
    let completed = 0;
    let failed = 0;
    let timedOut = 0;

    for (const processManager of this.processManagers.values()) {
      switch (processManager.status) {
        case 'COMPLETED':
          completed++;
          break;
        case 'FAILED':
          failed++;
          break;
        case 'TIMED_OUT':
          timedOut++;
          break;
      }
    }

    return {
      totalProcessManagers: this.processManagers.size,
      activeProcesses: this.activeProcesses.size,
      completedProcesses: completed,
      failedProcesses: failed,
      timedOutProcesses: timedOut,
      totalEventsProcessed: this.handledEvents.length,
    };
  }

  /**
   * Resets the orchestrator to initial state
   */
  reset(): void {
    this.processManagers.clear();
    this.activeProcesses.clear();
    this.handledEvents = [];

    if (this.options.enableLogging) {
      console.log('MockOrchestrator: Reset to initial state');
    }
  }

  private recordEventProcessing(
    event: IProcessManagerEvent,
    processManagerId?: string,
    result?: ProcessManagerResult,
    error?: Error
  ): void {
    this.handledEvents.push({
      event,
      processedAt: new Date(),
      processManagerId: processManagerId || '',
      ...(result && { result }),
      ...(error && { error }),
    });
  }

  private createDefaultContext(event: IProcessManagerEvent): IProcessManagerContext {
    return {
      correlationId: event.correlationId || `mock-corr-${Date.now()}`,
      userId: 'mock-user',
      tenantId: 'mock-tenant',
      requestId: `mock-req-${Date.now()}`,
      processedAt: new Date(),
      metadata: {},
    };
  }

  private extractCorrelationData(event: IProcessManagerEvent): Record<string, unknown> {
    return {
      correlationId: event.correlationId,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
    };
  }

  private findProcessByCorrelation(
    type: string,
    correlationData: Record<string, unknown>
  ): IProcessManager | undefined {
    for (const processManager of this.processManagers.values()) {
      if (processManager.type === type) {
        const pmCorrelation = processManager.getCorrelationData();

        // Simple correlation matching - can be enhanced based on business needs
        if (this.correlationMatches(correlationData, pmCorrelation)) {
          return processManager;
        }
      }
    }

    return undefined;
  }

  private correlationMatches(
    eventCorrelation: Record<string, unknown>,
    processCorrelation: Record<string, unknown>
  ): boolean {
    // Basic correlation matching - override for more sophisticated matching
    return (
      eventCorrelation.correlationId === processCorrelation.correlationId ||
      eventCorrelation.aggregateId === processCorrelation.aggregateId
    );
  }
}
