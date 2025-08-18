import { Logger } from '@vytches/ddd-logging';
import type { IProcessManager } from '../interfaces/process-manager.interface';
import type {
  IProcessRepository,
  ProcessSnapshot as IProcessSnapshot,
} from '../interfaces/process-repository.interface';
import type { IProcessManagerState } from '../interfaces/process-manager-state.interface';
import { ProcessSnapshot, ProcessSnapshotError } from './process-snapshot';

/**
 * Options for process recovery operations
 */
export interface ProcessRecoveryOptions {
  /**
   * Whether to validate the snapshot before recovery
   */
  validateSnapshot?: boolean;

  /**
   * Whether to verify snapshot integrity
   */
  verifyIntegrity?: boolean;

  /**
   * Maximum age of snapshot to accept (in milliseconds)
   */
  maxSnapshotAge?: number;

  /**
   * Whether to force recovery even with warnings
   */
  forceRecovery?: boolean;

  /**
   * Callback for handling recovery warnings
   */
  onWarning?: (warning: string) => void;
}

/**
 * Result of a process recovery operation
 */
export interface ProcessRecoveryResult {
  /**
   * Whether the recovery was successful
   */
  success: boolean;

  /**
   * The recovered process manager (if successful)
   */
  processManager?: IProcessManager | undefined;

  /**
   * The snapshot used for recovery
   */
  snapshot?: ProcessSnapshot | IProcessSnapshot | undefined;

  /**
   * Any errors that occurred during recovery
   */
  errors: string[];

  /**
   * Any warnings generated during recovery
   */
  warnings: string[];

  /**
   * Recovery metadata
   */
  metadata: {
    recoveryTimestamp: Date;
    snapshotAge: number;
    integrityVerified: boolean;
    validationPassed: boolean;
  };
}

/**
 * Factory function type for creating process manager instances
 */
export type ProcessManagerFactory = (
  id: string,
  type: string,
  state: IProcessManagerState
) => IProcessManager;

/**
 * ProcessRecovery handles restoration of process managers from snapshots.
 * It provides validation, integrity checking, and recovery capabilities.
 */
export class ProcessRecovery {
  private readonly logger = Logger.forContext(ProcessRecovery.name);

  constructor(
    private readonly repository: IProcessRepository,
    private readonly processManagerFactory: ProcessManagerFactory
  ) {}

  /**
   * Recovers a process manager from its most recent snapshot
   */
  async recoverFromSnapshot(
    processManagerId: string,
    options: ProcessRecoveryOptions = {}
  ): Promise<ProcessRecoveryResult> {
    const startTime = Date.now();
    const recoveryTimestamp = new Date();

    this.logger.info('Starting process recovery from snapshot', {
      processManagerId,
      options,
    });

    try {
      // Load the most recent snapshot
      const snapshotData = await this.repository.loadSnapshot(processManagerId);
      if (!snapshotData) {
        return this.createFailureResult('No snapshot found', [], [], {
          recoveryTimestamp,
          snapshotAge: 0,
          integrityVerified: false,
          validationPassed: false,
        });
      }

      // Convert to ProcessSnapshot class if it's just the interface
      let snapshot: ProcessSnapshot;
      if (snapshotData instanceof ProcessSnapshot) {
        snapshot = snapshotData;
      } else {
        // Create ProcessSnapshot instance from interface data
        snapshot = new ProcessSnapshot(
          snapshotData.processManagerId,
          snapshotData.processManagerType,
          snapshotData.state,
          snapshotData.status as any, // Convert string to enum if needed
          snapshotData.snapshotTimestamp,
          snapshotData.version,
          (snapshotData.metadata as any) || {
            reason: 'recovery',
            sizeBytes: 0,
            stateHash: 'unknown',
          }
        );
      }

      // Calculate snapshot age
      const snapshotAge = recoveryTimestamp.getTime() - snapshot.snapshotTimestamp.getTime();

      // Check snapshot age if specified
      if (options.maxSnapshotAge && snapshotAge > options.maxSnapshotAge) {
        return this.createFailureResult(
          `Snapshot is too old: ${snapshotAge}ms > ${options.maxSnapshotAge}ms`,
          [],
          [],
          { recoveryTimestamp, snapshotAge, integrityVerified: false, validationPassed: false }
        );
      }

      // Validate snapshot if requested
      let validationPassed = true;
      let warnings: string[] = [];

      if (options.validateSnapshot !== false) {
        const validation = snapshot.validate();
        validationPassed = validation.isValid;
        warnings = validation.warnings;

        if (!validation.isValid) {
          const errorMsg = `Snapshot validation failed: ${validation.errors.join(', ')}`;
          if (!options.forceRecovery) {
            return this.createFailureResult(errorMsg, validation.errors, warnings, {
              recoveryTimestamp,
              snapshotAge,
              integrityVerified: false,
              validationPassed: false,
            });
          } else {
            warnings.push(
              `Forced recovery despite validation errors: ${validation.errors.join(', ')}`
            );
          }
        }
      }

      // Verify integrity if requested
      let integrityVerified = true;
      if (options.verifyIntegrity !== false) {
        integrityVerified = await snapshot.verifyIntegrity();
        if (!integrityVerified) {
          const errorMsg = 'Snapshot integrity verification failed';
          if (!options.forceRecovery) {
            return this.createFailureResult(errorMsg, [errorMsg], warnings, {
              recoveryTimestamp,
              snapshotAge,
              integrityVerified: false,
              validationPassed,
            });
          } else {
            warnings.push('Forced recovery despite integrity verification failure');
          }
        }
      }

      // Handle warnings
      if (warnings.length > 0) {
        warnings.forEach(warning => {
          this.logger.warn('Process recovery warning', {
            processManagerId,
            warning,
          });
          options.onWarning?.(warning);
        });
      }

      // Create process manager from snapshot
      const processManager = this.processManagerFactory(
        snapshot.processManagerId,
        snapshot.processManagerType,
        snapshot.state
      );

      // Restore process manager status
      if (processManager.status !== snapshot.status) {
        // Note: This would require extending the process manager interface
        // to allow status restoration, or handling it in the factory
        this.logger.debug('Process manager status differs from snapshot', {
          processManagerId,
          currentStatus: processManager.status,
          snapshotStatus: snapshot.status,
        });
      }

      const duration = Date.now() - startTime;
      this.logger.info('Process recovery completed successfully', {
        processManagerId,
        processManagerType: snapshot.processManagerType,
        version: snapshot.version,
        snapshotAge,
        integrityVerified,
        validationPassed,
        duration,
      });

      return {
        success: true,
        processManager,
        snapshot,
        errors: [],
        warnings,
        metadata: {
          recoveryTimestamp,
          snapshotAge,
          integrityVerified,
          validationPassed,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Process recovery failed', error as Error, {
        processManagerId,
        duration,
      });

      return this.createFailureResult(
        `Recovery failed: ${(error as Error).message}`,
        [(error as Error).message],
        [],
        {
          recoveryTimestamp,
          snapshotAge: 0,
          integrityVerified: false,
          validationPassed: false,
        }
      );
    }
  }

  /**
   * Recovers a process manager to a specific snapshot version
   */
  async recoverToVersion(
    processManagerId: string,
    version: number,
    options: ProcessRecoveryOptions = {}
  ): Promise<ProcessRecoveryResult> {
    this.logger.info('Starting process recovery to specific version', {
      processManagerId,
      targetVersion: version,
      options,
    });

    // Note: This would require extending the repository interface to support
    // version-specific snapshot retrieval
    throw new ProcessRecoveryError(
      'Recovery to specific version not yet implemented - requires repository extension',
      'NOT_IMPLEMENTED',
      { processManagerId, version }
    );
  }

  /**
   * Creates a checkpoint snapshot for a process manager
   */
  async createCheckpoint(
    processManager: IProcessManager,
    reason: 'scheduled' | 'manual' | 'transition' | 'recovery' | 'migration' = 'manual'
  ): Promise<ProcessSnapshot> {
    this.logger.info('Creating process checkpoint', {
      processManagerId: processManager.id,
      processManagerType: processManager.type,
      version: processManager.state.version,
      reason,
    });

    try {
      const snapshot = await ProcessSnapshot.fromProcessManager(processManager, {
        reason,
        enableCompression: true,
        tags: ['checkpoint'],
      });

      // Convert ProcessSnapshot class to interface data for repository
      const snapshotData: IProcessSnapshot = {
        processManagerId: snapshot.processManagerId,
        processManagerType: snapshot.processManagerType,
        state: snapshot.state,
        status: snapshot.status.toString(),
        snapshotTimestamp: snapshot.snapshotTimestamp,
        version: snapshot.version,
        metadata: snapshot.metadata,
      };
      await this.repository.saveSnapshot(snapshotData);

      this.logger.info('Process checkpoint created successfully', {
        processManagerId: processManager.id,
        version: snapshot.version,
        sizeBytes: snapshot.metadata.sizeBytes,
        reason,
      });

      return snapshot;
    } catch (error) {
      this.logger.error('Failed to create process checkpoint', error as Error, {
        processManagerId: processManager.id,
      });
      throw new ProcessRecoveryError(
        `Failed to create checkpoint for process ${processManager.id}: ${(error as Error).message}`,
        'CHECKPOINT_CREATION_FAILED',
        { processManagerId: processManager.id, error: error as Error }
      );
    }
  }

  /**
   * Migrates process state between different schema versions
   */
  async migrateProcessState(
    processManager: IProcessManager,
    fromVersion: string,
    toVersion: string,
    migrationFn: (state: IProcessManagerState) => IProcessManagerState
  ): Promise<ProcessSnapshot> {
    this.logger.info('Starting process state migration', {
      processManagerId: processManager.id,
      fromVersion,
      toVersion,
    });

    try {
      // Create pre-migration snapshot
      const preSnapshot = await this.createCheckpoint(processManager, 'migration');

      // Apply migration
      const migratedState = migrationFn(processManager.state);

      // Create process manager with migrated state
      const migratedProcess = this.processManagerFactory(
        processManager.id,
        processManager.type,
        migratedState
      );

      // Create post-migration snapshot
      const postSnapshot = await ProcessSnapshot.fromProcessManager(migratedProcess, {
        reason: 'migration',
        tags: ['migration', `from-${fromVersion}`, `to-${toVersion}`],
        metadata: {
          additionalData: {
            preMigrationVersion: fromVersion,
            postMigrationVersion: toVersion,
            preMigrationSnapshotId: preSnapshot.processManagerId,
          },
        },
      });

      // Convert ProcessSnapshot class to interface data for repository
      const postSnapshotData: IProcessSnapshot = {
        processManagerId: postSnapshot.processManagerId,
        processManagerType: postSnapshot.processManagerType,
        state: postSnapshot.state,
        status: postSnapshot.status.toString(),
        snapshotTimestamp: postSnapshot.snapshotTimestamp,
        version: postSnapshot.version,
        metadata: postSnapshot.metadata,
      };
      await this.repository.saveSnapshot(postSnapshotData);

      this.logger.info('Process state migration completed', {
        processManagerId: processManager.id,
        fromVersion,
        toVersion,
        preMigrationSize: preSnapshot.metadata.sizeBytes,
        postMigrationSize: postSnapshot.metadata.sizeBytes,
      });

      return postSnapshot;
    } catch (error) {
      this.logger.error('Process state migration failed', error as Error, {
        processManagerId: processManager.id,
        fromVersion,
        toVersion,
      });
      throw new ProcessRecoveryError(
        `Failed to migrate process ${processManager.id} from ${fromVersion} to ${toVersion}: ${(error as Error).message}`,
        'MIGRATION_FAILED',
        { processManagerId: processManager.id, fromVersion, toVersion, error: error as Error }
      );
    }
  }

  /**
   * Performs a recovery dry run to validate a snapshot without actually recovering
   */
  async validateRecovery(
    processManagerId: string,
    options: ProcessRecoveryOptions = {}
  ): Promise<ProcessRecoveryResult> {
    this.logger.info('Starting recovery validation (dry run)', {
      processManagerId,
      options,
    });

    // Set validation options for dry run
    const dryRunOptions: ProcessRecoveryOptions = {
      ...options,
      validateSnapshot: true,
      verifyIntegrity: true,
    };

    // Perform recovery without creating the actual process manager
    const result = await this.recoverFromSnapshot(processManagerId, dryRunOptions);

    // Don't return the actual process manager in dry run
    return {
      success: result.success,
      processManager: undefined,
      snapshot: result.snapshot,
      errors: result.errors,
      warnings: result.warnings,
      metadata: result.metadata,
    };
  }

  /**
   * Creates a failure result for recovery operations
   */
  private createFailureResult(
    primaryError: string,
    errors: string[],
    warnings: string[],
    metadata: ProcessRecoveryResult['metadata']
  ): ProcessRecoveryResult {
    return {
      success: false,
      errors: [primaryError, ...errors],
      warnings,
      metadata,
    };
  }
}

/**
 * Error class for process recovery operations
 */
export class ProcessRecoveryError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(message: string, code: string, details?: Record<string, unknown> | undefined) {
    super(message);
    this.name = 'ProcessRecoveryError';
    this.code = code;
    this.details = details;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProcessRecoveryError);
    }
  }
}
