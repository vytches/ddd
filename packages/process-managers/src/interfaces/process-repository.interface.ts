import type { IProcessManager } from './process-manager.interface';
import type { IProcessManagerState } from './process-manager-state.interface';

/**
 * Strong-typed identifier for process managers
 */
export type ProcessManagerId = string;

/**
 * Correlation data used to find related process managers
 */
export interface CorrelationData {
  [key: string]: unknown;
}

/**
 * Snapshot of a process manager's state at a specific point in time
 * Used for performance optimization and recovery scenarios
 */
export interface ProcessSnapshot {
  /** Unique identifier for the process manager */
  processManagerId: ProcessManagerId;

  /** Type of the process manager */
  processManagerType: string;

  /** Snapshot of the state at this point */
  state: IProcessManagerState;

  /** Status at the time of snapshot */
  status: string;

  /** When this snapshot was created */
  snapshotTimestamp: Date;

  /** Version of the process manager at snapshot time */
  version: number;

  /** Optional metadata about the snapshot */
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Repository interface for persisting and retrieving process managers.
 * Provides state management and persistence capabilities for long-running workflows.
 */
export interface IProcessRepository {
  /**
   * Saves a process manager to persistent storage.
   * Handles both creation and updates with optimistic concurrency control.
   *
   * @param process - The process manager to save
   * @throws {ConcurrencyError} When version conflicts occur
   * @throws {ValidationError} When process data is invalid
   * @throws {StorageError} When persistence operation fails
   */
  save(process: IProcessManager): Promise<void>;

  /**
   * Loads a process manager by its unique identifier.
   *
   * @param id - The unique identifier of the process manager
   * @returns The process manager if found, undefined otherwise
   * @throws {ValidationError} When id is invalid
   * @throws {StorageError} When retrieval operation fails
   */
  load(id: ProcessManagerId): Promise<IProcessManager | undefined>;

  /**
   * Finds process managers that match the given correlation data.
   * Used for routing events to appropriate process instances.
   *
   * @param correlation - Correlation criteria to match against
   * @returns Array of matching process managers (may be empty)
   * @throws {ValidationError} When correlation data is invalid
   * @throws {StorageError} When query operation fails
   */
  findByCorrelation(correlation: CorrelationData): Promise<IProcessManager[]>;

  /**
   * Saves a process manager snapshot for performance optimization.
   * Snapshots allow faster reconstruction of process state.
   *
   * @param snapshot - The snapshot to save
   * @throws {ValidationError} When snapshot data is invalid
   * @throws {StorageError} When persistence operation fails
   */
  saveSnapshot(snapshot: ProcessSnapshot): Promise<void>;

  /**
   * Loads the most recent snapshot for a process manager.
   * Used to optimize process reconstruction from events.
   *
   * @param processManagerId - The process manager identifier
   * @returns The most recent snapshot if available, undefined otherwise
   * @throws {ValidationError} When id is invalid
   * @throws {StorageError} When retrieval operation fails
   */
  loadSnapshot(processManagerId: ProcessManagerId): Promise<ProcessSnapshot | undefined>;

  /**
   * Deletes a process manager and all its snapshots.
   * Used for cleanup of completed or expired processes.
   *
   * @param id - The unique identifier of the process manager
   * @returns true if the process was deleted, false if it didn't exist
   * @throws {ValidationError} When id is invalid
   * @throws {StorageError} When deletion operation fails
   */
  delete(id: ProcessManagerId): Promise<boolean>;

  /**
   * Checks if a process manager exists without loading it.
   * Useful for existence validation without full retrieval cost.
   *
   * @param id - The unique identifier to check
   * @returns true if the process manager exists, false otherwise
   * @throws {ValidationError} When id is invalid
   * @throws {StorageError} When check operation fails
   */
  exists(id: ProcessManagerId): Promise<boolean>;
}
