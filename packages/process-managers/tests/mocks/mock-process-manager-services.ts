/**
 * MockProcessManagerServices - Mock implementation for testing service integrations
 *
 * Provides mock implementations of external services that process managers depend on:
 * - Command dispatcher for testing command emission
 * - Event publisher for testing event publishing
 * - Repository access simulation
 * - External service mocking
 * - Logging service simulation
 */

import type { IProcessManagerServices } from '../../src/interfaces';
import type { MockUnifiedEventBus } from './mock-unified-event-bus';

export interface MockServicesOptions {
  eventBus?: MockUnifiedEventBus;
  enableLogging?: boolean;
  enableCommandTracking?: boolean;
  enableEventTracking?: boolean;
  simulateFailures?: boolean;
}

export interface CommandDispatchHistory {
  command: { type: string; payload: unknown; targetBoundedContext?: string };
  dispatchedAt: Date;
  success: boolean;
  error?: Error;
  processingTime: number;
}

export interface EventPublishHistory {
  event: { eventType: string; payload: unknown; targetBoundedContext?: string };
  publishedAt: Date;
  success: boolean;
  error?: Error;
  processingTime: number;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown> | undefined;
  error?: Error | undefined;
  timestamp: Date;
}

export class MockProcessManagerServices implements IProcessManagerServices {
  private commandHistory: CommandDispatchHistory[] = [];
  private eventHistory: EventPublishHistory[] = [];
  private logEntries: LogEntry[] = [];
  private repositoriesMap = new Map<string, any>();
  private externalServicesMap = new Map<string, any>();
  private failureSimulation = new Map<string, Error>(); // service -> error

  private options: Required<MockServicesOptions>;

  constructor(options: MockServicesOptions = {}) {
    this.options = {
      eventBus: null as any,
      enableLogging: false,
      enableCommandTracking: true,
      enableEventTracking: true,
      simulateFailures: false,
      ...options,
    };
  }

  /**
   * Command dispatcher implementation
   */
  commandDispatcher = {
    dispatch: async (command: {
      type: string;
      payload: unknown;
      targetBoundedContext?: string;
    }): Promise<void> => {
      const startTime = Date.now();

      // Check for simulated failures
      const simulatedError = this.failureSimulation.get(`command:${command.type}`);
      if (simulatedError) {
        const processingTime = Date.now() - startTime;

        if (this.options.enableCommandTracking) {
          this.commandHistory.push({
            command,
            dispatchedAt: new Date(),
            success: false,
            error: simulatedError,
            processingTime,
          });
        }

        throw simulatedError;
      }

      // Simulate command processing
      await this.simulateProcessingDelay();

      const processingTime = Date.now() - startTime;

      if (this.options.enableCommandTracking) {
        this.commandHistory.push({
          command,
          dispatchedAt: new Date(),
          success: true,
          processingTime,
        });
      }

      if (this.options.enableLogging) {
        this.log('info', `Command dispatched: ${command.type}`, {
          commandType: command.type,
          targetBoundedContext: command.targetBoundedContext,
          processingTime,
        });
      }
    },
  };

  /**
   * Command bus alias (for compatibility)
   */
  commandBus = this.commandDispatcher;

  /**
   * Event publisher implementation
   */
  eventPublisher = {
    publish: async (event: {
      eventType: string;
      payload: unknown;
      targetBoundedContext?: string;
    }): Promise<void> => {
      const startTime = Date.now();

      // Check for simulated failures
      const simulatedError = this.failureSimulation.get(`event:${event.eventType}`);
      if (simulatedError) {
        const processingTime = Date.now() - startTime;

        if (this.options.enableEventTracking) {
          this.eventHistory.push({
            event,
            publishedAt: new Date(),
            success: false,
            error: simulatedError,
            processingTime,
          });
        }

        throw simulatedError;
      }

      // Use the mock event bus if available
      if (this.options.eventBus) {
        const processManagerEvent = this.convertToProcessManagerEvent(event);
        await this.options.eventBus.publish(processManagerEvent);
      }

      // Simulate event publishing
      await this.simulateProcessingDelay();

      const processingTime = Date.now() - startTime;

      if (this.options.enableEventTracking) {
        this.eventHistory.push({
          event,
          publishedAt: new Date(),
          success: true,
          processingTime,
        });
      }

      if (this.options.enableLogging) {
        this.log('info', `Event published: ${event.eventType}`, {
          eventType: event.eventType,
          targetBoundedContext: event.targetBoundedContext,
          processingTime,
        });
      }
    },
  };

  /**
   * Repository access
   */
  repositories = new Proxy({} as Record<string, unknown>, {
    get: (target, prop) => {
      if (typeof prop === 'string') {
        if (!this.repositoriesMap.has(prop)) {
          // Create a mock repository on demand
          this.repositoriesMap.set(prop, this.createMockRepository(prop));
        }
        return this.repositoriesMap.get(prop);
      }
      return undefined;
    },
  });

  /**
   * External service access
   */
  externalServices = new Proxy({} as Record<string, unknown>, {
    get: (target, prop) => {
      if (typeof prop === 'string') {
        if (!this.externalServicesMap.has(prop)) {
          // Create a mock external service on demand
          this.externalServicesMap.set(prop, this.createMockExternalService(prop));
        }
        return this.externalServicesMap.get(prop);
      }
      return undefined;
    },
  });

  /**
   * Logger implementation
   */
  logger = {
    info: (message: string, data?: Record<string, unknown>): void => {
      this.log('info', message, data);
    },

    warn: (message: string, data?: Record<string, unknown>): void => {
      this.log('warn', message, data);
    },

    error: (message: string, error?: Error, data?: Record<string, unknown>): void => {
      this.log('error', message, data, error);
    },

    debug: (message: string, data?: Record<string, unknown>): void => {
      this.log('debug', message, data);
    },
  };

  /**
   * Gets command dispatch history
   */
  getCommandHistory(): CommandDispatchHistory[] {
    return [...this.commandHistory];
  }

  /**
   * Gets event publish history
   */
  getEventHistory(): EventPublishHistory[] {
    return [...this.eventHistory];
  }

  /**
   * Gets log entries
   */
  getLogEntries(): LogEntry[] {
    return [...this.logEntries];
  }

  /**
   * Gets commands of a specific type
   */
  getCommandsByType(commandType: string): CommandDispatchHistory[] {
    return this.commandHistory.filter(h => h.command.type === commandType);
  }

  /**
   * Gets events of a specific type
   */
  getEventsByType(eventType: string): EventPublishHistory[] {
    return this.eventHistory.filter(h => h.event.eventType === eventType);
  }

  /**
   * Verifies that a command was dispatched
   */
  verifyCommandDispatched(commandType: string, payload?: any): boolean {
    return this.commandHistory.some(h => {
      if (h.command.type !== commandType) {
        return false;
      }

      if (payload !== undefined) {
        return JSON.stringify(h.command.payload) === JSON.stringify(payload);
      }

      return true;
    });
  }

  /**
   * Verifies that an event was published
   */
  verifyEventPublished(eventType: string, payload?: any): boolean {
    return this.eventHistory.some(h => {
      if (h.event.eventType !== eventType) {
        return false;
      }

      if (payload !== undefined) {
        return JSON.stringify(h.event.payload) === JSON.stringify(payload);
      }

      return true;
    });
  }

  /**
   * Verifies command/event sequence
   */
  verifySequence(operations: Array<{ type: 'command' | 'event'; name: string }>): boolean {
    const allOperations = [
      ...this.commandHistory.map(h => ({
        type: 'command' as const,
        name: h.command.type,
        timestamp: h.dispatchedAt,
      })),
      ...this.eventHistory.map(h => ({
        type: 'event' as const,
        name: h.event.eventType,
        timestamp: h.publishedAt,
      })),
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let sequenceIndex = 0;
    for (const operation of allOperations) {
      const expected = operations[sequenceIndex];
      if (expected && operation.type === expected.type && operation.name === expected.name) {
        sequenceIndex++;
        if (sequenceIndex === operations.length) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Simulates service failure
   */
  simulateFailure(serviceKey: string, error: Error): void {
    this.failureSimulation.set(serviceKey, error);
  }

  /**
   * Clears failure simulation
   */
  clearFailureSimulation(): void {
    this.failureSimulation.clear();
  }

  /**
   * Clears all history
   */
  clearHistory(): void {
    this.commandHistory = [];
    this.eventHistory = [];
    this.logEntries = [];
  }

  /**
   * Resets all state
   */
  reset(): void {
    this.clearHistory();
    this.clearFailureSimulation();
    this.repositoriesMap.clear();
    this.externalServicesMap.clear();
  }

  /**
   * Registers a custom repository
   */
  registerRepository(name: string, repository: any): void {
    this.repositoriesMap.set(name, repository);
  }

  /**
   * Registers a custom external service
   */
  registerExternalService(name: string, service: any): void {
    this.externalServicesMap.set(name, service);
  }

  private log(
    level: LogEntry['level'],
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    const entry: LogEntry = {
      level,
      message,
      data,
      error,
      timestamp: new Date(),
    };

    this.logEntries.push(entry);

    if (this.options.enableLogging) {
      const logMethod = console[level] || console.log;
      logMethod(`MockServices [${level.toUpperCase()}]:`, message, data || '', error || '');
    }
  }

  private createMockRepository(name: string): any {
    return {
      name,
      findById: async (id: string) => ({ id, found: true }),
      save: async (entity: any) => ({ ...entity, saved: true }),
      delete: async (id: string) => ({ id, deleted: true }),
      query: async (criteria: any) => [{ criteria, found: true }],
    };
  }

  private createMockExternalService(name: string): any {
    return {
      name,
      call: async (method: string, params?: any) => ({ method, params, result: 'success' }),
      isHealthy: () => true,
      getStatus: () => ({ status: 'healthy', timestamp: new Date() }),
    };
  }

  private convertToProcessManagerEvent(event: { eventType: string; payload: unknown }): any {
    return {
      id: `mock-${Date.now()}`,
      eventType: event.eventType,
      eventName: event.eventType,
      payload: event.payload,
      aggregateId: 'mock-aggregate',
      aggregateType: 'MockAggregate',
      aggregateVersion: 1,
      timestamp: new Date(),
      correlationId: `mock-corr-${Date.now()}`,
      causationId: `mock-cause-${Date.now()}`,
      metadata: {},
    };
  }

  private async simulateProcessingDelay(): Promise<void> {
    if (this.options.simulateFailures) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    }
  }
}
