import { Logger } from '@vytches/ddd-logging';
import type { IProcessManager } from '../interfaces/process-manager.interface';
import type {
  IProcessRepository,
  ProcessManagerId,
  CorrelationData,
  ProcessSnapshot,
} from '../interfaces/process-repository.interface';
import {
  ProcessRepositoryError,
  ConcurrencyError,
  ValidationError,
  StorageError,
} from './process-repository-errors';

/**
 * Configuration options for the in-memory repository
 */
export interface InMemoryRepositoryOptions {
  /** Enable optimistic concurrency control validation */
  enableOptimisticLocking?: boolean;

  /** Maximum number of process managers to store */
  maxStorageSize?: number;

  /** Maximum number of snapshots to store per process manager */
  maxSnapshotsPerProcess?: number;

  /** Enable detailed audit logging */
  enableAuditLog?: boolean;

  /** Simulate network/disk delays for testing */
  enableDelaySimulation?: boolean;

  /** Default delay in milliseconds for simulated operations */
  defaultDelay?: number;
}

/**
 * Internal storage entry for process managers with metadata
 */
export interface ProcessStorageEntry {
  /** The stored process manager instance */
  processManager: IProcessManager;

  /** When this entry was created */
  createdAt: Date;

  /** When this entry was last updated */
  updatedAt: Date;

  /** Storage-specific metadata */
  metadata: {
    /** Original state version when stored */
    storedVersion: number;

    /** Storage operation counter */
    saveCount: number;

    /** Last access timestamp */
    lastAccessed: Date;
  };
}

/**
 * Query options for advanced process manager searches
 */
export interface QueryOptions {
  /** Limit the number of results returned */
  limit?: number;

  /** Skip the first N results */
  offset?: number;

  /** Sort field (defaults to 'updatedAt') */
  sortBy?: 'createdAt' | 'updatedAt' | 'id' | 'type';

  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
}

/**
 * Repository statistics for monitoring and debugging
 */
export interface RepositoryStatistics {
  /** Total number of stored process managers */
  totalProcessManagers: number;

  /** Total number of stored snapshots */
  totalSnapshots: number;

  /** Process managers grouped by type */
  processManagersByType: Record<string, number>;

  /** Memory usage estimation in bytes */
  estimatedMemoryUsage: number;

  /** Last operation timestamp */
  lastOperationAt?: Date;

  /** Operation counters */
  operationCounts: {
    saves: number;
    loads: number;
    deletes: number;
    correlationQueries: number;
    snapshotSaves: number;
    snapshotLoads: number;
  };
}

/**
 * In-memory implementation of IProcessRepository.
 * Suitable for development, testing, and small-scale deployments.
 * Provides full functionality with optimistic concurrency control.
 */
export class InMemoryProcessRepository implements IProcessRepository {
  private readonly logger = Logger.forContext('InMemoryProcessRepository');

  // Primary storage maps
  private readonly processStorage = new Map<ProcessManagerId, ProcessStorageEntry>();
  private readonly snapshotStorage = new Map<ProcessManagerId, ProcessSnapshot[]>();

  // Configuration
  private readonly options: Required<InMemoryRepositoryOptions>;

  // Statistics and monitoring
  private readonly stats: RepositoryStatistics = {
    totalProcessManagers: 0,
    totalSnapshots: 0,
    processManagersByType: {},
    estimatedMemoryUsage: 0,
    operationCounts: {
      saves: 0,
      loads: 0,
      deletes: 0,
      correlationQueries: 0,
      snapshotSaves: 0,
      snapshotLoads: 0,
    },
  };

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.options = {
      enableOptimisticLocking: true,
      maxStorageSize: 10000,
      maxSnapshotsPerProcess: 50,
      enableAuditLog: false,
      enableDelaySimulation: false,
      defaultDelay: 0,
      ...options,
    };

    this.logger.info('InMemoryProcessRepository initialized', {
      maxStorageSize: this.options.maxStorageSize,
      maxSnapshotsPerProcess: this.options.maxSnapshotsPerProcess,
      optimisticLocking: this.options.enableOptimisticLocking,
      auditLog: this.options.enableAuditLog,
    });
  }

  /**
   * Saves a process manager to storage with optimistic concurrency control
   */
  async save(process: IProcessManager): Promise<void> {
    await this.simulateDelay();

    try {
      this.validateProcessManager(process, 'save');

      const processId = process.id;
      const existingEntry = this.processStorage.get(processId);

      // Check storage limits for new entries
      if (!existingEntry && this.processStorage.size >= this.options.maxStorageSize) {
        throw new StorageError(
          'save',
          `Storage limit exceeded: cannot store more than ${this.options.maxStorageSize} process managers`,
          undefined,
          { currentSize: this.processStorage.size, limit: this.options.maxStorageSize }
        );
      }

      // Optimistic concurrency control
      if (this.options.enableOptimisticLocking && existingEntry) {
        const storedVersion = existingEntry.metadata.storedVersion;
        const incomingVersion = process.state.version;

        if (incomingVersion <= storedVersion) {
          throw new ConcurrencyError(processId, storedVersion + 1, incomingVersion, {
            operation: 'save',
            storedAt: existingEntry.updatedAt,
            processType: process.type,
          });
        }
      }

      // Create storage entry
      const now = new Date();
      const entry: ProcessStorageEntry = {
        processManager: this.cloneProcessManager(process),
        createdAt: existingEntry?.createdAt || now,
        updatedAt: now,
        metadata: {
          storedVersion: process.state.version,
          saveCount: (existingEntry?.metadata.saveCount || 0) + 1,
          lastAccessed: now,
        },
      };

      // Store the entry
      this.processStorage.set(processId, entry);

      // Update statistics
      this.stats.operationCounts.saves++;
      this.stats.lastOperationAt = now;
      this.updateStatistics();

      if (this.options.enableAuditLog) {
        this.logger.info('Process manager saved', {
          processManagerId: processId,
          processType: process.type,
          version: process.state.version,
          saveCount: entry.metadata.saveCount,
          isUpdate: !!existingEntry,
        });
      }
    } catch (error) {
      this.logger.error('Failed to save process manager', error as Error, {
        processManagerId: process?.id,
        processType: process?.type,
        version: process?.state?.version,
      });
      throw error;
    }
  }

  /**
   * Loads a process manager by ID
   */
  async load(id: ProcessManagerId): Promise<IProcessManager | undefined> {
    await this.simulateDelay();

    try {
      this.validateProcessManagerId(id, 'load');

      const entry = this.processStorage.get(id);
      if (!entry) {
        if (this.options.enableAuditLog) {
          this.logger.debug('Process manager not found', { processManagerId: id });
        }
        return undefined;
      }

      // Update access tracking
      entry.metadata.lastAccessed = new Date();

      // Update statistics
      this.stats.operationCounts.loads++;
      this.stats.lastOperationAt = new Date();

      if (this.options.enableAuditLog) {
        this.logger.debug('Process manager loaded', {
          processManagerId: id,
          processType: entry.processManager.type,
          version: entry.processManager.state.version,
          saveCount: entry.metadata.saveCount,
        });
      }

      return this.cloneProcessManager(entry.processManager);
    } catch (error) {
      this.logger.error('Failed to load process manager', error as Error, {
        processManagerId: id,
      });
      throw error;
    }
  }

  /**
   * Finds process managers by correlation data
   */
  async findByCorrelation(correlation: CorrelationData): Promise<IProcessManager[]> {
    await this.simulateDelay();

    try {
      this.validateCorrelationData(correlation, 'findByCorrelation');

      const results: IProcessManager[] = [];
      const now = new Date();

      for (const [id, entry] of this.processStorage.entries()) {
        const processCorrelation = entry.processManager.getCorrelationData();

        if (this.correlationMatches(correlation, processCorrelation)) {
          entry.metadata.lastAccessed = now;
          results.push(this.cloneProcessManager(entry.processManager));
        }
      }

      // Update statistics
      this.stats.operationCounts.correlationQueries++;
      this.stats.lastOperationAt = now;

      if (this.options.enableAuditLog) {
        this.logger.debug('Correlation query executed', {
          correlationData: correlation,
          resultCount: results.length,
        });
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to find by correlation', error as Error, {
        correlationData: correlation,
      });
      throw error;
    }
  }

  /**
   * Saves a process manager snapshot
   */
  async saveSnapshot(snapshot: ProcessSnapshot): Promise<void> {
    await this.simulateDelay();

    try {
      this.validateSnapshot(snapshot, 'saveSnapshot');

      const processId = snapshot.processManagerId;
      let snapshots = this.snapshotStorage.get(processId) || [];

      // Check if process manager exists
      if (!this.processStorage.has(processId)) {
        throw new ValidationError(
          `Cannot save snapshot: process manager '${processId}' does not exist`,
          'processManagerId',
          processId
        );
      }

      // Add new snapshot
      const clonedSnapshot = this.cloneSnapshot(snapshot);
      snapshots.push(clonedSnapshot);

      // Sort by timestamp (newest first) and enforce limit
      snapshots.sort((a, b) => b.snapshotTimestamp.getTime() - a.snapshotTimestamp.getTime());
      if (snapshots.length > this.options.maxSnapshotsPerProcess) {
        snapshots = snapshots.slice(0, this.options.maxSnapshotsPerProcess);
      }

      this.snapshotStorage.set(processId, snapshots);

      // Update statistics
      this.stats.operationCounts.snapshotSaves++;
      this.stats.lastOperationAt = new Date();
      this.updateStatistics();

      if (this.options.enableAuditLog) {
        this.logger.info('Process snapshot saved', {
          processManagerId: processId,
          processType: snapshot.processManagerType,
          version: snapshot.version,
          snapshotTimestamp: snapshot.snapshotTimestamp,
          totalSnapshots: snapshots.length,
        });
      }
    } catch (error) {
      this.logger.error('Failed to save snapshot', error as Error, {
        processManagerId: snapshot?.processManagerId,
        processType: snapshot?.processManagerType,
      });
      throw error;
    }
  }

  /**
   * Loads the most recent snapshot for a process manager
   */
  async loadSnapshot(processManagerId: ProcessManagerId): Promise<ProcessSnapshot | undefined> {
    await this.simulateDelay();

    try {
      this.validateProcessManagerId(processManagerId, 'loadSnapshot');

      const snapshots = this.snapshotStorage.get(processManagerId);
      if (!snapshots || snapshots.length === 0) {
        if (this.options.enableAuditLog) {
          this.logger.debug('No snapshots found', { processManagerId });
        }
        return undefined;
      }

      // Return the most recent snapshot (first in sorted array)
      const latestSnapshot = snapshots[0];
      if (!latestSnapshot) {
        // This should never happen since we check length above, but TypeScript requires it
        return undefined;
      }

      // Update statistics
      this.stats.operationCounts.snapshotLoads++;
      this.stats.lastOperationAt = new Date();

      if (this.options.enableAuditLog) {
        this.logger.debug('Snapshot loaded', {
          processManagerId,
          version: latestSnapshot.version,
          snapshotTimestamp: latestSnapshot.snapshotTimestamp,
        });
      }

      return this.cloneSnapshot(latestSnapshot);
    } catch (error) {
      this.logger.error('Failed to load snapshot', error as Error, {
        processManagerId,
      });
      throw error;
    }
  }

  /**
   * Deletes a process manager and all its snapshots
   */
  async delete(id: ProcessManagerId): Promise<boolean> {
    await this.simulateDelay();

    try {
      this.validateProcessManagerId(id, 'delete');

      const existed = this.processStorage.has(id);

      if (existed) {
        const entry = this.processStorage.get(id);
        this.processStorage.delete(id);
        this.snapshotStorage.delete(id);

        // Update statistics
        this.stats.operationCounts.deletes++;
        this.stats.lastOperationAt = new Date();
        this.updateStatistics();

        if (this.options.enableAuditLog) {
          this.logger.info('Process manager deleted', {
            processManagerId: id,
            processType: entry?.processManager.type,
            saveCount: entry?.metadata.saveCount,
          });
        }
      }

      return existed;
    } catch (error) {
      this.logger.error('Failed to delete process manager', error as Error, {
        processManagerId: id,
      });
      throw error;
    }
  }

  /**
   * Checks if a process manager exists
   */
  async exists(id: ProcessManagerId): Promise<boolean> {
    await this.simulateDelay();

    try {
      this.validateProcessManagerId(id, 'exists');
      return this.processStorage.has(id);
    } catch (error) {
      this.logger.error('Failed to check existence', error as Error, {
        processManagerId: id,
      });
      throw error;
    }
  }

  /**
   * Gets repository statistics for monitoring
   */
  getStatistics(): RepositoryStatistics {
    this.updateStatistics();
    return { ...this.stats };
  }

  /**
   * Clears all stored data (useful for testing)
   */
  clear(): void {
    this.processStorage.clear();
    this.snapshotStorage.clear();

    // Reset statistics
    this.stats.totalProcessManagers = 0;
    this.stats.totalSnapshots = 0;
    this.stats.processManagersByType = {};
    this.stats.estimatedMemoryUsage = 0;
    this.stats.lastOperationAt = new Date();

    this.logger.info('Repository cleared');
  }

  /**
   * Updates internal statistics
   */
  private updateStatistics(): void {
    this.stats.totalProcessManagers = this.processStorage.size;

    // Count total snapshots and group by type
    let totalSnapshots = 0;
    const typeCounter: Record<string, number> = {};

    for (const [_, entry] of this.processStorage.entries()) {
      const type = entry.processManager.type;
      typeCounter[type] = (typeCounter[type] || 0) + 1;
    }

    for (const snapshots of this.snapshotStorage.values()) {
      totalSnapshots += snapshots.length;
    }

    this.stats.totalSnapshots = totalSnapshots;
    this.stats.processManagersByType = typeCounter;

    // Rough memory usage estimation
    this.stats.estimatedMemoryUsage =
      this.processStorage.size * 1024 + // Rough estimate per process manager
      totalSnapshots * 512; // Rough estimate per snapshot
  }

  /**
   * Simulates operation delay for testing
   */
  private async simulateDelay(): Promise<void> {
    if (this.options.enableDelaySimulation && this.options.defaultDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.options.defaultDelay));
    }
  }

  /**
   * Validates process manager data
   */
  private validateProcessManager(process: IProcessManager, operation: string): void {
    if (!process) {
      throw new ValidationError(`Process manager is required for ${operation}`, 'process', process);
    }

    if (!process.id || typeof process.id !== 'string' || process.id.trim().length === 0) {
      throw new ValidationError('Process manager ID must be a non-empty string', 'id', process.id);
    }

    if (!process.type || typeof process.type !== 'string' || process.type.trim().length === 0) {
      throw new ValidationError(
        'Process manager type must be a non-empty string',
        'type',
        process.type
      );
    }

    if (!process.state) {
      throw new ValidationError('Process manager state is required', 'state', process.state);
    }

    if (typeof process.state.version !== 'number' || process.state.version < 0) {
      throw new ValidationError(
        'Process state version must be a non-negative number',
        'state.version',
        process.state.version
      );
    }
  }

  /**
   * Validates process manager ID
   */
  private validateProcessManagerId(id: ProcessManagerId, operation: string): void {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new ValidationError(
        `Process manager ID must be a non-empty string for ${operation}`,
        'id',
        id
      );
    }
  }

  /**
   * Validates correlation data
   */
  private validateCorrelationData(correlation: CorrelationData, operation: string): void {
    if (!correlation || typeof correlation !== 'object') {
      throw new ValidationError(
        `Correlation data must be an object for ${operation}`,
        'correlation',
        correlation
      );
    }

    if (Object.keys(correlation).length === 0) {
      throw new ValidationError(
        `Correlation data cannot be empty for ${operation}`,
        'correlation',
        correlation
      );
    }
  }

  /**
   * Validates snapshot data
   */
  private validateSnapshot(snapshot: ProcessSnapshot, operation: string): void {
    if (!snapshot) {
      throw new ValidationError(`Snapshot is required for ${operation}`, 'snapshot', snapshot);
    }

    if (!snapshot.processManagerId || typeof snapshot.processManagerId !== 'string') {
      throw new ValidationError(
        'Snapshot processManagerId must be a non-empty string',
        'processManagerId',
        snapshot.processManagerId
      );
    }

    if (!snapshot.processManagerType || typeof snapshot.processManagerType !== 'string') {
      throw new ValidationError(
        'Snapshot processManagerType must be a non-empty string',
        'processManagerType',
        snapshot.processManagerType
      );
    }

    if (!snapshot.state) {
      throw new ValidationError('Snapshot state is required', 'state', snapshot.state);
    }

    if (!(snapshot.snapshotTimestamp instanceof Date)) {
      throw new ValidationError(
        'Snapshot timestamp must be a Date',
        'snapshotTimestamp',
        snapshot.snapshotTimestamp
      );
    }

    if (typeof snapshot.version !== 'number' || snapshot.version < 0) {
      throw new ValidationError(
        'Snapshot version must be a non-negative number',
        'version',
        snapshot.version
      );
    }
  }

  /**
   * Checks if correlation data matches
   */
  private correlationMatches(
    criteria: CorrelationData,
    processCorrelation: CorrelationData
  ): boolean {
    for (const [key, value] of Object.entries(criteria)) {
      if (processCorrelation[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Deep clones a process manager for isolation
   */
  private cloneProcessManager(process: IProcessManager): IProcessManager {
    // For testing, we use JSON serialization/deserialization to simulate persistence
    // This breaks the prototype chain which is what would happen in real persistence
    try {
      // Create a serializable representation
      const serializable = {
        id: process.id,
        type: process.type,
        state: {
          ...process.state,
          stepData: { ...process.state.stepData },
          correlationData: { ...process.state.correlationData },
          metadata: process.state.metadata ? { ...process.state.metadata } : undefined,
        },
        status: process.status,
        createdAt: process.createdAt,
        updatedAt: process.updatedAt,
        timeout: process.timeout,
        // Add methods that need to be preserved
        getCorrelationData: () => ({ ...process.state.correlationData }),
        canHandle: () => true,
        isComplete: () => false,
        isTimedOut: () => false,
        handle: async () => ({ success: true }),
        updateState: async () => {
          // No-op for serialized copy
        },
        complete: () => {
          // No-op for serialized copy
        },
        fail: () => {
          // No-op for serialized copy
        },
      };

      return serializable as IProcessManager;
    } catch (error) {
      // Fallback to simple object copy
      return {
        id: process.id,
        type: process.type,
        state: {
          ...process.state,
          stepData: { ...process.state.stepData },
          correlationData: { ...process.state.correlationData },
          metadata: process.state.metadata ? { ...process.state.metadata } : undefined,
        },
        status: process.status,
        createdAt: process.createdAt,
        updatedAt: process.updatedAt,
        timeout: process.timeout,
        getCorrelationData: () => ({ ...process.state.correlationData }),
        canHandle: () => true,
        isComplete: () => false,
        isTimedOut: () => false,
        handle: async () => ({ success: true }),
        updateState: async () => {
          // No-op for serialized copy
        },
        complete: () => {
          // No-op for serialized copy
        },
        fail: () => {
          // No-op for serialized copy
        },
      } as IProcessManager;
    }
  }

  /**
   * Deep clones a snapshot for isolation
   */
  private cloneSnapshot(snapshot: ProcessSnapshot): ProcessSnapshot {
    return {
      ...snapshot,
      state: {
        ...snapshot.state,
        stepData: { ...snapshot.state.stepData },
        correlationData: { ...snapshot.state.correlationData },
        metadata: snapshot.state.metadata ? { ...snapshot.state.metadata } : undefined,
      },
      metadata: snapshot.metadata ? { ...snapshot.metadata } : undefined,
    };
  }
}
