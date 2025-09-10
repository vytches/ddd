import { Logger } from '@vytches/ddd-logging';
import type { IProcessManagerState, IProcessManagerContext } from '../interfaces';

/**
 * Represents a single state transition in the process manager's lifecycle
 */
export interface IProcessManagerTransition {
  id: string;
  processManagerId: string;
  fromState: string;
  toState: string;
  trigger: string;
  timestamp: Date;
  sequence: number; // Add sequence number for reliable ordering
  context: IProcessManagerContext;
  executionTime?: number;
  success: boolean;
  errorDetails?: string;
  snapshot?: Record<string, unknown>;
  additionalMetadata?: Record<string, unknown>;
}

/**
 * Options for creating a TransitionHistory instance
 */
export interface TransitionHistoryOptions {
  maxHistorySize?: number;
  includeSnapshots?: boolean;
  enableLogging?: boolean;
}

/**
 * Statistics about the transition history
 */
export interface TransitionStatistics {
  totalTransitions: number;
  averageExecutionTime: number;
  successRate: number;
  mostCommonFromState: string | null;
  mostCommonToState: string | null;
  mostCommonTrigger: string | null;
}

/**
 * Export format for transition history
 */
export interface TransitionHistoryExport {
  metadata: {
    exportDate: Date;
    totalTransitions: number;
    maxHistorySize: number;
    includeSnapshots: boolean;
  };
  transitions: IProcessManagerTransition[];
}

/**
 * Comprehensive audit trail for process manager state transitions
 * Provides enterprise-grade tracking of all state changes with context
 */
export class TransitionHistory {
  private readonly transitions: IProcessManagerTransition[] = [];
  private readonly maxHistorySize: number;
  private readonly includeSnapshots: boolean;
  private readonly logger?: ReturnType<typeof Logger.forContext>;
  private readonly processManagerId: string;
  private sequenceCounter = 0;

  constructor(processManagerId: string, options: TransitionHistoryOptions = {}) {
    this.processManagerId = processManagerId;
    this.maxHistorySize = options.maxHistorySize ?? 1000;
    this.includeSnapshots = options.includeSnapshots ?? true;

    if (options.enableLogging) {
      this.logger = Logger.forContext('TransitionHistory');
    }
  }

  /**
   * Records a state transition with comprehensive audit information
   */
  recordTransition(
    fromState: string,
    toState: string,
    trigger: string,
    context: IProcessManagerContext,
    metadata?: Record<string, unknown>
  ): void {
    const baseTransition = {
      id: this.generateTransitionId(),
      processManagerId: this.processManagerId,
      fromState,
      toState,
      trigger,
      timestamp: new Date(),
      sequence: ++this.sequenceCounter,
      context: {
        correlationId: context.correlationId,
        ...(context.userId !== undefined && { userId: context.userId }),
        ...(context.sessionId !== undefined && { sessionId: context.sessionId }),
        ...(context.tenantId !== undefined && { tenantId: context.tenantId }),
        ...(context.requestId !== undefined && { requestId: context.requestId }),
        processedAt: context.processedAt || new Date(),
        ...(context.metadata !== undefined && { metadata: context.metadata }),
        ...(context.services !== undefined && { services: context.services }),
        ...(context.securityContext !== undefined && { securityContext: context.securityContext }),
      },
      success: (metadata?.success as boolean) ?? true,
    };

    const transition: IProcessManagerTransition = {
      ...baseTransition,
      ...(metadata?.executionTime !== undefined && {
        executionTime: metadata.executionTime as number,
      }),
      ...(metadata?.errorDetails !== undefined && {
        errorDetails: metadata.errorDetails as string,
      }),
      ...(this.includeSnapshots &&
        (() => {
          const snapshot = this.createStateSnapshot(metadata?.state);
          return snapshot !== undefined ? { snapshot } : {};
        })()),
      ...(metadata !== undefined && { additionalMetadata: metadata }),
    };

    this.addTransition(transition);

    this.logger?.info('State transition recorded', {
      fromState,
      toState,
      trigger,
      success: transition.success,
      executionTime: transition.executionTime,
    });
  }

  /**
   * Retrieves transition history with filtering options
   */
  getTransitions(
    options: {
      fromState?: string;
      toState?: string;
      trigger?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): IProcessManagerTransition[] {
    let filtered = [...this.transitions];

    // Apply filters
    if (options.fromState) {
      filtered = filtered.filter(t => t.fromState === options.fromState);
    }
    if (options.toState) {
      filtered = filtered.filter(t => t.toState === options.toState);
    }
    if (options.trigger) {
      filtered = filtered.filter(t => t.trigger === options.trigger);
    }
    if (options.startDate) {
      filtered = filtered.filter(t => t.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      filtered = filtered.filter(t => t.timestamp <= options.endDate!);
    }

    // Sort by sequence (most recent first) - more reliable than timestamp
    filtered.sort((a, b) => b.sequence - a.sequence);

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Gets the most recent transition
   */
  getLastTransition(): IProcessManagerTransition | undefined {
    return this.transitions[this.transitions.length - 1];
  }

  /**
   * Gets all transitions for a specific state
   */
  getTransitionsFromState(state: string): IProcessManagerTransition[] {
    return this.transitions.filter(t => t.fromState === state);
  }

  /**
   * Gets all transitions to a specific state
   */
  getTransitionsToState(state: string): IProcessManagerTransition[] {
    return this.transitions.filter(t => t.toState === state);
  }

  /**
   * Calculates transition statistics
   */
  getStatistics(): TransitionStatistics {
    if (this.transitions.length === 0) {
      return {
        totalTransitions: 0,
        averageExecutionTime: 0,
        successRate: 0,
        mostCommonFromState: null,
        mostCommonToState: null,
        mostCommonTrigger: null,
      };
    }

    const executionTimes = this.transitions
      .filter(t => t.executionTime !== undefined)
      .map(t => t.executionTime!);

    const successfulTransitions = this.transitions.filter(t => t.success).length;

    return {
      totalTransitions: this.transitions.length,
      averageExecutionTime:
        executionTimes.length > 0
          ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
          : 0,
      successRate: successfulTransitions / this.transitions.length,
      mostCommonFromState: this.getMostCommon(this.transitions.map(t => t.fromState)),
      mostCommonToState: this.getMostCommon(this.transitions.map(t => t.toState)),
      mostCommonTrigger: this.getMostCommon(this.transitions.map(t => t.trigger)),
    };
  }

  /**
   * Validates the transition chain for consistency
   */
  validateTransitionChain(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.transitions.length < 2) {
      return { valid: true, errors: [] };
    }

    for (let i = 1; i < this.transitions.length; i++) {
      const prev = this.transitions[i - 1];
      const curr = this.transitions[i];

      if (!prev || !curr) continue;

      // Check if the toState of previous matches fromState of current
      if (prev.toState !== curr.fromState) {
        errors.push(
          `Inconsistent chain at transition ${i}: ` +
            `${prev.toState} (previous toState) != ${curr.fromState} (current fromState)`
        );
      }

      // Check timestamp ordering
      if (prev.timestamp > curr.timestamp) {
        errors.push(
          `Invalid timestamp order at transition ${i}: ` + `${prev.timestamp} > ${curr.timestamp}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Exports transition history to JSON
   */
  exportToJson(): string {
    const exportData: TransitionHistoryExport = {
      metadata: {
        exportDate: new Date(),
        totalTransitions: this.transitions.length,
        maxHistorySize: this.maxHistorySize,
        includeSnapshots: this.includeSnapshots,
      },
      transitions: this.transitions,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Imports transition history from JSON
   */
  importFromJson(jsonData: string): void {
    const data = JSON.parse(jsonData) as TransitionHistoryExport;

    if (!data.transitions || !Array.isArray(data.transitions)) {
      throw new Error('Invalid transition history format');
    }

    // Clear existing transitions
    this.transitions.length = 0;

    // Validate and import transitions, maintaining chronological order
    // The exported data is already in the correct order (oldest to newest)
    let maxSequence = 0;
    data.transitions.forEach((transition: any) => {
      if (this.isValidTransition(transition)) {
        const importedTransition = {
          ...transition,
          timestamp: new Date(transition.timestamp),
          sequence: transition.sequence || ++this.sequenceCounter,
        };
        this.transitions.push(importedTransition);
        maxSequence = Math.max(maxSequence, importedTransition.sequence);
      }
    });

    // Update sequence counter to continue from imported data
    this.sequenceCounter = maxSequence;

    // Maintain size limits
    this.enforceSizeLimit();

    this.logger?.info('Transition history imported', {
      transitionsImported: this.transitions.length,
      originalCount: data.transitions.length,
    });
  }

  /**
   * Clears all transition history
   */
  clear(): void {
    const previousCount = this.transitions.length;
    this.transitions.length = 0;

    this.logger?.info('Transition history cleared', {
      transitionsRemoved: previousCount,
    });
  }

  /**
   * Gets the current size of the history
   */
  getSize(): number {
    return this.transitions.length;
  }

  /**
   * Gets transitions within a time window
   */
  getTransitionsInTimeWindow(startTime: Date, endTime: Date): IProcessManagerTransition[] {
    return this.transitions.filter(t => t.timestamp >= startTime && t.timestamp <= endTime);
  }

  /**
   * Gets failed transitions
   */
  getFailedTransitions(): IProcessManagerTransition[] {
    return this.transitions.filter(t => !t.success);
  }

  /**
   * Gets successful transitions
   */
  getSuccessfulTransitions(): IProcessManagerTransition[] {
    return this.transitions.filter(t => t.success);
  }

  private addTransition(transition: IProcessManagerTransition): void {
    this.transitions.push(transition);
    this.enforceSizeLimit();
  }

  private enforceSizeLimit(): void {
    while (this.transitions.length > this.maxHistorySize) {
      // Remove the oldest transition (first in array)
      const removed = this.transitions.shift();

      this.logger?.debug('Transition removed due to size limit', {
        removedTransition: removed?.id,
        remaining: this.transitions.length,
      });
    }
  }

  private generateTransitionId(): string {
    return `transition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createStateSnapshot(state: unknown): Record<string, unknown> | undefined {
    if (!state || typeof state !== 'object') {
      return undefined;
    }

    try {
      // Create a deep copy of the state for the snapshot
      return JSON.parse(JSON.stringify(state));
    } catch (error) {
      this.logger?.warn('Failed to create state snapshot', { error });
      return undefined;
    }
  }

  private getMostCommon(items: string[]): string | null {
    if (items.length === 0) return null;

    const frequency: Record<string, number> = {};
    items.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });

    return Object.keys(frequency).reduce((a, b) =>
      (frequency[a] ?? 0) > (frequency[b] ?? 0) ? a : b
    );
  }

  private isValidTransition(transition: any): boolean {
    return (
      transition &&
      typeof transition.id === 'string' &&
      typeof transition.processManagerId === 'string' &&
      typeof transition.fromState === 'string' &&
      typeof transition.toState === 'string' &&
      typeof transition.trigger === 'string' &&
      transition.timestamp &&
      transition.context &&
      typeof transition.success === 'boolean'
      // sequence is optional for backward compatibility
    );
  }
}

/**
 * Error thrown when transition history operations fail
 */
export class TransitionHistoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TransitionHistoryError';
  }
}
