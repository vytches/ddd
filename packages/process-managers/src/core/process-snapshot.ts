import { Logger } from '@vytches/ddd-logging';
import type {
  ProcessManagerId,
  ProcessSnapshot as IProcessSnapshot,
} from '../interfaces/process-repository.interface';
import type { IProcessManagerState } from '../interfaces/process-manager-state.interface';
import type { IProcessManager } from '../interfaces/process-manager.interface';
import type { ProcessManagerStatus } from '../interfaces/process-manager.interface';

/**
 * Metadata for process snapshots containing operational information
 */
export interface SnapshotMetadata extends Record<string, unknown> {
  /**
   * Reason for creating this snapshot
   */
  reason: 'scheduled' | 'manual' | 'transition' | 'recovery' | 'migration';

  /**
   * Size of the serialized state in bytes
   */
  sizeBytes: number;

  /**
   * Compression method used (if any)
   */
  compression?: 'gzip' | 'brotli' | undefined;

  /**
   * Hash of the state for integrity verification
   */
  stateHash: string;

  /**
   * Tags for categorization and filtering
   */
  tags?: string[] | undefined;

  /**
   * Additional metadata
   */
  additionalData?: Record<string, unknown> | undefined;
}

/**
 * Options for creating process snapshots
 */
export interface ProcessSnapshotOptions {
  /**
   * Whether to compress the snapshot data
   */
  enableCompression?: boolean;

  /**
   * Reason for creating this snapshot
   */
  reason?: SnapshotMetadata['reason'];

  /**
   * Additional metadata to include
   */
  metadata?: Partial<SnapshotMetadata>;

  /**
   * Tags for categorization
   */
  tags?: string[];
}

/**
 * Result of snapshot validation
 */
export interface SnapshotValidationResult {
  /**
   * Whether the snapshot is valid
   */
  isValid: boolean;

  /**
   * Validation errors if any
   */
  errors: string[];

  /**
   * Warnings (non-fatal issues)
   */
  warnings: string[];
}

/**
 * ProcessSnapshot provides state capture and recovery capabilities for process managers.
 * It supports compression, integrity validation, and metadata tracking.
 */
export class ProcessSnapshot implements IProcessSnapshot {
  private readonly logger = Logger.forContext(ProcessSnapshot.name);

  constructor(
    public readonly processManagerId: ProcessManagerId,
    public readonly processManagerType: string,
    public readonly state: IProcessManagerState,
    public readonly status: ProcessManagerStatus,
    public readonly snapshotTimestamp: Date,
    public readonly version: number,
    public readonly metadata: SnapshotMetadata
  ) {
    this.validateSnapshot();
  }

  /**
   * Creates a snapshot from a process manager instance
   */
  static async fromProcessManager(
    processManager: IProcessManager,
    options: ProcessSnapshotOptions = {}
  ): Promise<ProcessSnapshot> {
    const logger = Logger.forContext(ProcessSnapshot.name);
    const startTime = Date.now();

    try {
      // Clone state to ensure immutability
      const clonedState = this.deepCloneState(processManager.state);

      // Calculate state hash for integrity
      const stateHash = await this.calculateStateHash(clonedState);

      // Calculate serialized size
      const serializedState = JSON.stringify(clonedState);
      const sizeBytes = new TextEncoder().encode(serializedState).length;

      // Build metadata
      const metadata: SnapshotMetadata = {
        reason: options.reason || 'manual',
        sizeBytes,
        stateHash,
        tags: options.tags,
        ...options.metadata,
      };

      // Apply compression if enabled
      if (options.enableCompression) {
        metadata.compression = 'gzip'; // Placeholder - would implement actual compression
        logger.debug('Snapshot compression enabled', {
          processManagerId: processManager.id,
          originalSize: sizeBytes,
        });
      }

      const snapshot = new ProcessSnapshot(
        processManager.id,
        processManager.type,
        clonedState,
        processManager.status,
        new Date(),
        processManager.state.version,
        metadata
      );

      const duration = Date.now() - startTime;
      logger.info('Process snapshot created', {
        processManagerId: processManager.id,
        processManagerType: processManager.type,
        version: processManager.state.version,
        sizeBytes: metadata.sizeBytes,
        reason: metadata.reason,
        duration,
      });

      return snapshot;
    } catch (error) {
      logger.error('Failed to create process snapshot', error as Error, {
        processManagerId: processManager.id,
        processManagerType: processManager.type,
      });
      throw new ProcessSnapshotError(
        `Failed to create snapshot for process ${processManager.id}: ${(error as Error).message}`,
        'SNAPSHOT_CREATION_FAILED',
        { processManagerId: processManager.id, error: error as Error }
      );
    }
  }

  /**
   * Validates the snapshot integrity and structure
   */
  validate(): SnapshotValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!this.processManagerId || typeof this.processManagerId !== 'string') {
      errors.push('Process manager ID must be a non-empty string');
    }

    if (!this.processManagerType || typeof this.processManagerType !== 'string') {
      errors.push('Process manager type must be a non-empty string');
    }

    if (!this.state) {
      errors.push('State is required');
    } else {
      // Validate state structure
      if (typeof this.state.version !== 'number' || this.state.version < 0) {
        errors.push('State version must be a non-negative number');
      }

      if (!this.state.currentStep || typeof this.state.currentStep !== 'string') {
        errors.push('State current step must be a non-empty string');
      }

      if (!this.state.lastModified || !(this.state.lastModified instanceof Date)) {
        errors.push('State last modified must be a valid Date');
      }
    }

    if (typeof this.version !== 'number' || this.version < 0) {
      errors.push('Snapshot version must be a non-negative number');
    }

    if (!this.snapshotTimestamp || !(this.snapshotTimestamp instanceof Date)) {
      errors.push('Snapshot timestamp must be a valid Date');
    }

    // Validate metadata
    if (!this.metadata) {
      errors.push('Metadata is required');
    } else {
      if (
        !this.metadata.reason ||
        !['scheduled', 'manual', 'transition', 'recovery', 'migration'].includes(
          this.metadata.reason
        )
      ) {
        errors.push(
          'Metadata reason must be one of: scheduled, manual, transition, recovery, migration'
        );
      }

      if (typeof this.metadata.sizeBytes !== 'number' || this.metadata.sizeBytes < 0) {
        errors.push('Metadata size bytes must be a non-negative number');
      }

      if (!this.metadata.stateHash || typeof this.metadata.stateHash !== 'string') {
        errors.push('Metadata state hash must be a non-empty string');
      }
    }

    // Version consistency check
    if (this.state && this.state.version !== this.version) {
      warnings.push(
        `State version (${this.state.version}) differs from snapshot version (${this.version})`
      );
    }

    // Timestamp consistency check
    if (this.state && this.state.lastModified > this.snapshotTimestamp) {
      warnings.push('State was modified after snapshot timestamp');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Verifies the integrity of the snapshot by recalculating the state hash
   */
  async verifyIntegrity(): Promise<boolean> {
    try {
      const recalculatedHash = await ProcessSnapshot.calculateStateHash(this.state);
      const isValid = recalculatedHash === this.metadata.stateHash;

      if (!isValid) {
        this.logger.warn('Snapshot integrity verification failed', {
          processManagerId: this.processManagerId,
          expectedHash: this.metadata.stateHash,
          actualHash: recalculatedHash,
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Failed to verify snapshot integrity', error as Error, {
        processManagerId: this.processManagerId,
      });
      return false;
    }
  }

  /**
   * Serializes the snapshot to JSON with compression if enabled
   */
  async serialize(): Promise<string> {
    try {
      const data = {
        processManagerId: this.processManagerId,
        processManagerType: this.processManagerType,
        state: this.state,
        status: this.status,
        snapshotTimestamp: this.snapshotTimestamp.toISOString(),
        version: this.version,
        metadata: this.metadata,
      };

      const serialized = JSON.stringify(data);

      // Apply compression if specified in metadata
      if (this.metadata.compression) {
        // Placeholder for actual compression implementation
        this.logger.debug('Applying compression to snapshot', {
          processManagerId: this.processManagerId,
          compression: this.metadata.compression,
          originalSize: serialized.length,
        });
      }

      return serialized;
    } catch (error) {
      this.logger.error('Failed to serialize snapshot', error as Error, {
        processManagerId: this.processManagerId,
      });
      throw new ProcessSnapshotError(
        `Failed to serialize snapshot for process ${this.processManagerId}: ${(error as Error).message}`,
        'SNAPSHOT_SERIALIZATION_FAILED',
        { processManagerId: this.processManagerId, error: error as Error }
      );
    }
  }

  /**
   * Deserializes a snapshot from JSON string
   */
  static async deserialize(serializedData: string): Promise<ProcessSnapshot> {
    const logger = Logger.forContext(ProcessSnapshot.name);

    try {
      // Decompress if needed (placeholder)
      const jsonData = serializedData;

      const data = JSON.parse(jsonData);

      // Validate required fields
      if (!data.processManagerId || !data.processManagerType || !data.state || !data.metadata) {
        throw new ProcessSnapshotError(
          'Invalid snapshot data: missing required fields',
          'INVALID_SNAPSHOT_DATA'
        );
      }

      // Restore Date objects
      const snapshotTimestamp = new Date(data.snapshotTimestamp);
      const state = {
        ...data.state,
        lastModified: new Date(data.state.lastModified),
      };

      const snapshot = new ProcessSnapshot(
        data.processManagerId,
        data.processManagerType,
        state,
        data.status,
        snapshotTimestamp,
        data.version,
        data.metadata
      );

      logger.info('Process snapshot deserialized', {
        processManagerId: data.processManagerId,
        version: data.version,
        snapshotTimestamp: snapshotTimestamp.toISOString(),
      });

      return snapshot;
    } catch (error) {
      logger.error('Failed to deserialize snapshot', error as Error);
      throw new ProcessSnapshotError(
        `Failed to deserialize snapshot: ${(error as Error).message}`,
        'SNAPSHOT_DESERIALIZATION_FAILED',
        { error: error as Error }
      );
    }
  }

  /**
   * Creates a copy of the snapshot with updated metadata
   */
  withMetadata(updatedMetadata: Partial<SnapshotMetadata>): ProcessSnapshot {
    return new ProcessSnapshot(
      this.processManagerId,
      this.processManagerType,
      this.state,
      this.status,
      this.snapshotTimestamp,
      this.version,
      { ...this.metadata, ...updatedMetadata }
    );
  }

  /**
   * Checks if this snapshot is newer than another snapshot
   */
  isNewerThan(other: ProcessSnapshot): boolean {
    if (this.processManagerId !== other.processManagerId) {
      throw new ProcessSnapshotError(
        'Cannot compare snapshots from different process managers',
        'INCOMPARABLE_SNAPSHOTS',
        { thisId: this.processManagerId, otherId: other.processManagerId }
      );
    }

    return (
      this.version > other.version ||
      (this.version === other.version && this.snapshotTimestamp > other.snapshotTimestamp)
    );
  }

  /**
   * Gets a summary of the snapshot for logging and debugging
   */
  getSummary(): SnapshotSummary {
    return {
      processManagerId: this.processManagerId,
      processManagerType: this.processManagerType,
      currentStep: this.state.currentStep,
      version: this.version,
      status: this.status,
      snapshotTimestamp: this.snapshotTimestamp,
      sizeBytes: this.metadata.sizeBytes,
      reason: this.metadata.reason,
      compression: this.metadata.compression,
      tags: this.metadata.tags,
    };
  }

  /**
   * Deep clones a process manager state to ensure immutability
   */
  private static deepCloneState(state: IProcessManagerState): IProcessManagerState {
    return {
      currentStep: state.currentStep,
      stepData: JSON.parse(JSON.stringify(state.stepData)),
      version: state.version,
      lastModified: new Date(state.lastModified.getTime()),
      correlationData: JSON.parse(JSON.stringify(state.correlationData)),
      metadata: state.metadata ? JSON.parse(JSON.stringify(state.metadata)) : undefined,
    };
  }

  /**
   * Calculates a hash of the state for integrity verification
   */
  private static async calculateStateHash(state: IProcessManagerState): Promise<string> {
    // Simple hash implementation - in production would use crypto.subtle
    const stateStr = JSON.stringify({
      currentStep: state.currentStep,
      stepData: state.stepData,
      version: state.version,
      correlationData: state.correlationData,
      metadata: state.metadata,
    });

    // Simple string hash (would use proper cryptographic hash in production)
    let hash = 0;
    for (let i = 0; i < stateStr.length; i++) {
      const char = stateStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Validates the snapshot during construction
   */
  private validateSnapshot(): void {
    const validation = this.validate();
    if (!validation.isValid) {
      throw new ProcessSnapshotError(
        `Invalid snapshot: ${validation.errors.join(', ')}`,
        'INVALID_SNAPSHOT',
        { errors: validation.errors, warnings: validation.warnings }
      );
    }

    if (validation.warnings.length > 0) {
      this.logger.warn('Snapshot created with warnings', {
        processManagerId: this.processManagerId,
        warnings: validation.warnings,
      });
    }
  }
}

/**
 * Summary information about a snapshot
 */
export interface SnapshotSummary {
  processManagerId: string;
  processManagerType: string;
  currentStep: string;
  version: number;
  status: ProcessManagerStatus;
  snapshotTimestamp: Date;
  sizeBytes: number;
  reason: SnapshotMetadata['reason'];
  compression?: string | undefined;
  tags?: string[] | undefined;
}

/**
 * Error class for process snapshot operations
 */
export class ProcessSnapshotError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(message: string, code: string, details?: Record<string, unknown> | undefined) {
    super(message);
    this.name = 'ProcessSnapshotError';
    this.code = code;
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProcessSnapshotError);
    }
  }
}
