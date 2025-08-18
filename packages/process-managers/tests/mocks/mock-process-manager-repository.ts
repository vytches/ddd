/**
 * MockProcessManagerRepository - Mock implementation for testing Process Manager persistence
 *
 * Provides controlled persistence simulation with:
 * - In-memory storage with query capabilities
 * - Optimistic concurrency control simulation
 * - Audit logging for testing verification
 * - Error injection for failure scenarios
 * - Performance simulation
 */

import type { IProcessManager, ProcessManagerStatus } from '../../src/interfaces';

export interface MockRepositoryOptions {
  enableOptimisticLocking?: boolean;
  enableAuditLog?: boolean;
  enableDelaySimulation?: boolean;
  defaultDelay?: number;
  maxStorageSize?: number;
}

export interface AuditLogEntry {
  operation: 'save' | 'load' | 'delete' | 'query';
  processManagerId: string;
  timestamp: Date;
  version?: number | undefined;
  details?: Record<string, unknown> | undefined;
}

export interface QueryCriteria {
  status?: ProcessManagerStatus | ProcessManagerStatus[];
  type?: string | string[];
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  correlationData?: Record<string, unknown>;
  timeout?: boolean; // true = timed out, false = not timed out
}

export interface RepositoryStatistics {
  totalProcessManagers: number;
  byStatus: Record<ProcessManagerStatus, number>;
  byType: Record<string, number>;
  averageVersion: number;
  oldestProcess?: Date | undefined;
  newestProcess?: Date | undefined;
}

export class MockProcessManagerRepository {
  private storage = new Map<string, IProcessManager>();
  private auditLog: AuditLogEntry[] = [];
  private versionConflicts = new Set<string>(); // IDs that should fail on next save
  private failureSimulation = new Map<string, Error>(); // ID -> Error to throw

  private options: Required<MockRepositoryOptions>;

  constructor(options: MockRepositoryOptions = {}) {
    this.options = {
      enableOptimisticLocking: true,
      enableAuditLog: false,
      enableDelaySimulation: false,
      defaultDelay: 10,
      maxStorageSize: 1000,
      ...options,
    };
  }

  /**
   * Saves a process manager to the repository
   */
  async save(processManager: IProcessManager): Promise<void> {
    await this.simulateDelay();

    // Check for simulated failures
    const simulatedError = this.failureSimulation.get(processManager.id);
    if (simulatedError) {
      this.failureSimulation.delete(processManager.id);
      throw simulatedError;
    }

    // Check storage limits
    if (this.storage.size >= this.options.maxStorageSize && !this.storage.has(processManager.id)) {
      throw new Error('Repository storage limit exceeded');
    }

    // Optimistic concurrency control
    if (this.options.enableOptimisticLocking) {
      const existing = this.storage.get(processManager.id);

      if (existing) {
        // Check for version conflicts
        if (this.versionConflicts.has(processManager.id)) {
          this.versionConflicts.delete(processManager.id);
          throw new Error(
            `Optimistic locking failure: Process manager '${processManager.id}' was modified by another transaction`
          );
        }

        // Check version consistency (simplified)
        if (existing.state.version >= processManager.state.version) {
          throw new Error(
            `Version conflict: Expected version > ${existing.state.version}, got ${processManager.state.version}`
          );
        }
      }
    }

    // Store the process manager (deep clone to simulate persistence)
    this.storage.set(processManager.id, this.cloneProcessManager(processManager));

    // Audit logging
    this.logOperation('save', processManager.id, processManager.state.version);
  }

  /**
   * Loads a process manager by ID
   */
  async load(id: string): Promise<IProcessManager | undefined> {
    await this.simulateDelay();

    const processManager = this.storage.get(id);
    this.logOperation('load', id);

    // Return a clone to simulate loading from persistence
    return processManager ? this.cloneProcessManager(processManager) : undefined;
  }

  /**
   * Finds a process manager by ID (alias for load)
   */
  async findById(id: string): Promise<IProcessManager | undefined> {
    return this.load(id);
  }

  /**
   * Finds process managers by correlation data
   */
  async findByCorrelation(correlationData: Record<string, unknown>): Promise<IProcessManager[]> {
    await this.simulateDelay();

    const results: IProcessManager[] = [];

    for (const processManager of this.storage.values()) {
      const pmCorrelation = processManager.getCorrelationData();

      if (this.correlationMatches(correlationData, pmCorrelation)) {
        results.push(this.cloneProcessManager(processManager));
      }
    }

    this.logOperation('query', 'correlation-search', undefined, {
      correlationData,
      resultCount: results.length,
    });

    return results;
  }

  /**
   * Queries process managers with criteria
   */
  async query(criteria: QueryCriteria): Promise<IProcessManager[]> {
    await this.simulateDelay();

    let results = Array.from(this.storage.values());

    // Filter by status
    if (criteria.status) {
      const statusArray = Array.isArray(criteria.status) ? criteria.status : [criteria.status];
      results = results.filter(pm => statusArray.includes(pm.status));
    }

    // Filter by type
    if (criteria.type) {
      const typeArray = Array.isArray(criteria.type) ? criteria.type : [criteria.type];
      results = results.filter(pm => typeArray.includes(pm.type));
    }

    // Filter by created date range
    if (criteria.createdAfter) {
      results = results.filter(pm => pm.createdAt >= criteria.createdAfter!);
    }
    if (criteria.createdBefore) {
      results = results.filter(pm => pm.createdAt <= criteria.createdBefore!);
    }

    // Filter by updated date range
    if (criteria.updatedAfter) {
      results = results.filter(pm => pm.updatedAt >= criteria.updatedAfter!);
    }
    if (criteria.updatedBefore) {
      results = results.filter(pm => pm.updatedAt <= criteria.updatedBefore!);
    }

    // Filter by timeout status
    if (criteria.timeout !== undefined) {
      results = results.filter(pm => pm.isTimedOut() === criteria.timeout);
    }

    // Filter by correlation data
    if (criteria.correlationData) {
      results = results.filter(pm =>
        this.correlationMatches(criteria.correlationData!, pm.getCorrelationData())
      );
    }

    this.logOperation('query', 'advanced-search', undefined, {
      criteria,
      resultCount: results.length,
    });

    // Return clones
    return results.map(pm => this.cloneProcessManager(pm));
  }

  /**
   * Deletes a process manager by ID
   */
  async delete(id: string): Promise<boolean> {
    await this.simulateDelay();

    const existed = this.storage.has(id);
    this.storage.delete(id);
    this.versionConflicts.delete(id);
    this.failureSimulation.delete(id);

    this.logOperation('delete', id);

    return existed;
  }

  /**
   * Gets all process managers (use with caution in large datasets)
   */
  async getAll(): Promise<IProcessManager[]> {
    await this.simulateDelay();

    return Array.from(this.storage.values()).map(pm => this.cloneProcessManager(pm));
  }

  /**
   * Gets repository statistics
   */
  getStatistics(): RepositoryStatistics {
    const byStatus: Record<ProcessManagerStatus, number> = {
      CREATED: 0,
      RUNNING: 0,
      WAITING: 0,
      COMPLETED: 0,
      FAILED: 0,
      TIMED_OUT: 0,
    };

    const byType: Record<string, number> = {};
    let totalVersion = 0;
    let oldestProcess: Date | undefined;
    let newestProcess: Date | undefined;

    for (const pm of this.storage.values()) {
      byStatus[pm.status]++;
      byType[pm.type] = (byType[pm.type] || 0) + 1;
      totalVersion += pm.state.version;

      if (!oldestProcess || pm.createdAt < oldestProcess) {
        oldestProcess = pm.createdAt;
      }
      if (!newestProcess || pm.createdAt > newestProcess) {
        newestProcess = pm.createdAt;
      }
    }

    return {
      totalProcessManagers: this.storage.size,
      byStatus,
      byType,
      averageVersion: this.storage.size > 0 ? totalVersion / this.storage.size : 0,
      oldestProcess,
      newestProcess,
    };
  }

  /**
   * Gets the audit log entries
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Clears the audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Clears all history and data
   */
  clearHistory(): void {
    this.auditLog = [];
    this.versionConflicts.clear();
    this.failureSimulation.clear();
  }

  /**
   * Clears all stored process managers
   */
  clear(): void {
    this.storage.clear();
    this.versionConflicts.clear();
    this.failureSimulation.clear();
    this.auditLog = [];
  }

  /**
   * Simulates optimistic locking failure on next save
   */
  simulateOptimisticLockingFailure(processManagerId: string): void {
    this.versionConflicts.add(processManagerId);
  }

  /**
   * Simulates repository failure on next operation
   */
  simulateFailure(processManagerId: string, error: Error): void {
    this.failureSimulation.set(processManagerId, error);
  }

  /**
   * Simulates network/disk delay
   */
  setDelaySimulation(enabled: boolean, delayMs = 10): void {
    this.options.enableDelaySimulation = enabled;
    this.options.defaultDelay = delayMs;
  }

  private async simulateDelay(): Promise<void> {
    if (this.options.enableDelaySimulation && this.options.defaultDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.options.defaultDelay));
    }
  }

  private logOperation(
    operation: AuditLogEntry['operation'],
    processManagerId: string,
    version?: number,
    details?: Record<string, unknown>
  ): void {
    if (this.options.enableAuditLog) {
      this.auditLog.push({
        operation,
        processManagerId,
        timestamp: new Date(),
        version,
        details,
      });
    }
  }

  private correlationMatches(
    criteria: Record<string, unknown>,
    processManagerCorrelation: Record<string, unknown>
  ): boolean {
    // Simple correlation matching - can be enhanced for specific business rules
    for (const [key, value] of Object.entries(criteria)) {
      if (processManagerCorrelation[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private cloneProcessManager(processManager: IProcessManager): IProcessManager {
    // Deep clone to simulate persistence/loading
    // Note: This is a simplified clone - in real implementation, this would be serialization/deserialization
    return {
      ...processManager,
      state: {
        ...processManager.state,
        stepData: { ...processManager.state.stepData },
        correlationData: { ...processManager.state.correlationData },
        metadata: processManager.state.metadata ? { ...processManager.state.metadata } : undefined,
      },
    } as IProcessManager;
  }
}
