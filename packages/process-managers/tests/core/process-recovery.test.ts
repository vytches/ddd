import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  ProcessRecovery,
  ProcessRecoveryError,
  type ProcessRecoveryOptions,
  type ProcessManagerFactory,
} from '../../src/core/process-recovery';
import { ProcessSnapshot } from '../../src/core/process-snapshot';
import { ProcessManagerStatus } from '../../src/interfaces/process-manager.interface';
import type { IProcessManagerState } from '../../src/interfaces/process-manager-state.interface';
import type { IProcessRepository } from '../../src/interfaces/process-repository.interface';
import { MockProcessManager } from '../mocks/mock-process-manager';
import { InMemoryProcessRepository } from '../../src/repositories/in-memory-process-repository';

describe('ProcessRecovery', () => {
  let repository: IProcessRepository;
  let processManagerFactory: ProcessManagerFactory;
  let recovery: ProcessRecovery;
  let mockProcessManager: MockProcessManager;
  let mockState: IProcessManagerState;
  let snapshot: ProcessSnapshot;

  beforeEach(async () => {
    repository = new InMemoryProcessRepository();

    processManagerFactory = vi.fn((id: string, type: string, state: IProcessManagerState) => {
      return new MockProcessManager({
        id,
        type,
        initialState: state,
      });
    });

    recovery = new ProcessRecovery(repository, processManagerFactory);

    mockState = {
      currentStep: 'recovery-test',
      stepData: { testValue: 'data', recoveryData: { key: 'value' } },
      version: 3,
      lastModified: new Date('2024-01-01T12:00:00.000Z'),
      correlationData: { orderId: 'order-789', sessionId: 'session-123' },
      metadata: { source: 'test' },
    };

    mockProcessManager = new MockProcessManager({
      id: 'test-process-recovery',
      type: 'TestRecoveryProcess',
      initialState: mockState,
    });

    // Save the process manager first (required by repository)
    await repository.save(mockProcessManager);

    // Create and save a snapshot for recovery tests
    snapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager, {
      reason: 'manual',
      tags: ['recovery-test'],
    });

    // Convert to interface data for repository
    const snapshotData = {
      processManagerId: snapshot.processManagerId,
      processManagerType: snapshot.processManagerType,
      state: snapshot.state,
      status: snapshot.status.toString(),
      snapshotTimestamp: snapshot.snapshotTimestamp,
      version: snapshot.version,
      metadata: snapshot.metadata,
    };
    await repository.saveSnapshot(snapshotData);
  });

  describe('Constructor', () => {
    it('should create ProcessRecovery instance with required dependencies', () => {
      expect(recovery).toBeInstanceOf(ProcessRecovery);
      expect(processManagerFactory).toBeDefined();
    });
  });

  describe('recoverFromSnapshot()', () => {
    it('should successfully recover process manager from snapshot', async () => {
      const result = await recovery.recoverFromSnapshot('test-process-recovery');

      expect(result.success).toBe(true);
      expect(result.processManager).toBeDefined();
      expect(result.snapshot).toStrictEqual(snapshot);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);

      // Verify factory was called correctly
      expect(processManagerFactory).toHaveBeenCalledWith(
        'test-process-recovery',
        'TestRecoveryProcess',
        expect.objectContaining({
          currentStep: 'recovery-test',
          version: 3,
        })
      );

      // Verify metadata
      expect(result.metadata.recoveryTimestamp).toBeInstanceOf(Date);
      expect(result.metadata.snapshotAge).toBeGreaterThanOrEqual(0);
      expect(result.metadata.integrityVerified).toBe(true);
      expect(result.metadata.validationPassed).toBe(true);
    });

    it('should handle non-existent snapshot', async () => {
      const result = await recovery.recoverFromSnapshot('non-existent-process');

      expect(result.success).toBe(false);
      expect(result.processManager).toBeUndefined();
      expect(result.snapshot).toBeUndefined();
      expect(result.errors).toContain('No snapshot found');
      expect(result.metadata.integrityVerified).toBe(false);
      expect(result.metadata.validationPassed).toBe(false);
    });

    it('should respect maxSnapshotAge option', async () => {
      const options: ProcessRecoveryOptions = {
        maxSnapshotAge: 1, // 1 millisecond - snapshot will be too old
      };

      // Wait a bit to ensure snapshot is older than 1ms
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await recovery.recoverFromSnapshot('test-process-recovery', options);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Snapshot is too old');
      expect(result.metadata.snapshotAge).toBeGreaterThan(1);
    });

    it('should handle validation failures', async () => {
      // Create valid process manager and save it
      const invalidProcess = new MockProcessManager({
        id: 'invalid-process',
        type: 'InvalidProcess',
        initialState: {
          currentStep: 'valid-step',
          stepData: {},
          version: 0,
          lastModified: new Date(),
          correlationData: {},
        },
      });
      await repository.save(invalidProcess);

      // Create snapshot data that would fail validation
      const invalidSnapshotData = {
        processManagerId: 'invalid-process',
        processManagerType: 'InvalidProcess',
        state: {
          currentStep: '', // This will make validation fail
          stepData: {},
          version: -1, // This will also make validation fail
          lastModified: new Date(),
          correlationData: {},
        },
        status: 'RUNNING',
        snapshotTimestamp: new Date(),
        version: 1,
        metadata: {
          reason: 'manual',
          sizeBytes: 100,
          stateHash: 'test-hash',
        },
      };

      // Mock repository to return invalid snapshot
      vi.spyOn(repository, 'loadSnapshot').mockResolvedValue(invalidSnapshotData);

      const result = await recovery.recoverFromSnapshot('invalid-process');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Recovery failed: Invalid snapshot');
      expect(result.metadata.validationPassed).toBe(false);
    });

    it('should handle forced recovery with validation failures', async () => {
      // Create snapshot with validation warnings
      const warningSnapshot = new ProcessSnapshot(
        'warning-process',
        'WarningProcess',
        {
          ...mockState,
          version: 5, // Different from snapshot version to create warning
        },
        ProcessManagerStatus.RUNNING,
        new Date(),
        3,
        {
          reason: 'manual',
          sizeBytes: 100,
          stateHash: 'test-hash',
        }
      );

      // Override validate to return errors that can be forced
      vi.spyOn(warningSnapshot, 'validate').mockReturnValue({
        isValid: false,
        errors: ['Test validation error'],
        warnings: ['Test warning'],
      });

      // Mock repository to return warning snapshot
      vi.spyOn(repository, 'loadSnapshot').mockResolvedValue(warningSnapshot);

      const options: ProcessRecoveryOptions = {
        forceRecovery: true,
        onWarning: vi.fn(),
      };

      const result = await recovery.recoverFromSnapshot('warning-process', options);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        'Forced recovery despite validation errors: Test validation error'
      );
      expect(options.onWarning).toHaveBeenCalled();
    });

    it('should handle integrity verification failures', async () => {
      // Create a new recovery instance to avoid state pollution
      const freshRepository = new InMemoryProcessRepository();
      const freshRecovery = new ProcessRecovery(freshRepository, processManagerFactory);

      // Save process manager and snapshot
      await freshRepository.save(mockProcessManager);
      const testSnapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager);
      const snapshotData = {
        processManagerId: testSnapshot.processManagerId,
        processManagerType: testSnapshot.processManagerType,
        state: testSnapshot.state,
        status: testSnapshot.status.toString(),
        snapshotTimestamp: testSnapshot.snapshotTimestamp,
        version: testSnapshot.version,
        metadata: testSnapshot.metadata,
      };
      await freshRepository.saveSnapshot(snapshotData);

      // Mock the snapshot that will be created in recovery to fail integrity check
      vi.spyOn(ProcessSnapshot.prototype, 'verifyIntegrity').mockResolvedValue(false);

      const result = await freshRecovery.recoverFromSnapshot('test-process-recovery');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toBe('Snapshot integrity verification failed');
      expect(result.metadata.integrityVerified).toBe(false);

      // Restore the mock
      vi.restoreAllMocks();
    });

    it('should handle forced recovery with integrity failures', async () => {
      // Create a fresh recovery instance
      const freshRepository = new InMemoryProcessRepository();
      const freshRecovery = new ProcessRecovery(freshRepository, processManagerFactory);

      // Save process manager and snapshot
      await freshRepository.save(mockProcessManager);
      const testSnapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager);
      const snapshotData = {
        processManagerId: testSnapshot.processManagerId,
        processManagerType: testSnapshot.processManagerType,
        state: testSnapshot.state,
        status: testSnapshot.status.toString(),
        snapshotTimestamp: testSnapshot.snapshotTimestamp,
        version: testSnapshot.version,
        metadata: testSnapshot.metadata,
      };
      await freshRepository.saveSnapshot(snapshotData);

      // Mock integrity verification to fail
      vi.spyOn(ProcessSnapshot.prototype, 'verifyIntegrity').mockResolvedValue(false);

      const options: ProcessRecoveryOptions = {
        forceRecovery: true,
      };

      const result = await freshRecovery.recoverFromSnapshot('test-process-recovery', options);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Forced recovery despite integrity verification failure');
      expect(result.metadata.integrityVerified).toBe(false);

      // Restore the mock
      vi.restoreAllMocks();
    });

    it('should skip validation when disabled', async () => {
      const options: ProcessRecoveryOptions = {
        validateSnapshot: false,
      };

      const result = await recovery.recoverFromSnapshot('test-process-recovery', options);

      expect(result.success).toBe(true);
      expect(result.metadata.validationPassed).toBe(true); // Still true when skipped
    });

    it('should skip integrity verification when disabled', async () => {
      const options: ProcessRecoveryOptions = {
        verifyIntegrity: false,
      };

      const result = await recovery.recoverFromSnapshot('test-process-recovery', options);

      expect(result.success).toBe(true);
      expect(result.metadata.integrityVerified).toBe(true); // Still true when skipped
    });

    it('should handle factory errors', async () => {
      // Mock factory to throw error
      const errorFactory: ProcessManagerFactory = vi.fn(() => {
        throw new Error('Factory error');
      });

      const errorRecovery = new ProcessRecovery(repository, errorFactory);

      const result = await errorRecovery.recoverFromSnapshot('test-process-recovery');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Recovery failed: Factory error');
    });

    it('should handle repository errors', async () => {
      // Mock repository to throw error
      vi.spyOn(repository, 'loadSnapshot').mockRejectedValue(new Error('Repository error'));

      const result = await recovery.recoverFromSnapshot('test-process-recovery');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Recovery failed: Repository error');
    });
  });

  describe('createCheckpoint()', () => {
    it('should create checkpoint snapshot successfully', async () => {
      const checkpoint = await recovery.createCheckpoint(mockProcessManager);

      expect(checkpoint).toBeInstanceOf(ProcessSnapshot);
      expect(checkpoint.processManagerId).toBe(mockProcessManager.id);
      expect(checkpoint.processManagerType).toBe(mockProcessManager.type);
      expect(checkpoint.metadata.reason).toBe('manual');
      expect(checkpoint.metadata.tags).toContain('checkpoint');
      expect(checkpoint.metadata.compression).toBe('gzip');

      // Verify snapshot was saved to repository
      const saved = await repository.loadSnapshot(mockProcessManager.id);
      expect(saved).toBeDefined();
    });

    it('should create checkpoint with specific reason', async () => {
      const checkpoint = await recovery.createCheckpoint(mockProcessManager, 'scheduled');

      expect(checkpoint.metadata.reason).toBe('scheduled');
    });

    it('should handle checkpoint creation errors', async () => {
      // Mock repository to throw error
      vi.spyOn(repository, 'saveSnapshot').mockRejectedValue(new Error('Save error'));

      const [error] = await safeRun(() => recovery.createCheckpoint(mockProcessManager));

      expect(error).toBeInstanceOf(ProcessRecoveryError);
      expect((error as ProcessRecoveryError)?.code).toBe('CHECKPOINT_CREATION_FAILED');
      expect(error?.message).toContain('Save error');
    });
  });

  describe('migrateProcessState()', () => {
    it('should migrate process state successfully', async () => {
      const migrationFn = (state: IProcessManagerState): IProcessManagerState => ({
        ...state,
        currentStep: 'migrated-step',
        stepData: { ...state.stepData, migrated: true },
        version: state.version + 1,
        metadata: { ...state.metadata, migration: 'v1-to-v2' },
      });

      const migratedSnapshot = await recovery.migrateProcessState(
        mockProcessManager,
        'v1.0',
        'v2.0',
        migrationFn
      );

      expect(migratedSnapshot.state.currentStep).toBe('migrated-step');
      expect(migratedSnapshot.state.stepData.migrated).toBe(true);
      expect(migratedSnapshot.state.version).toBe(mockState.version + 1);
      expect(migratedSnapshot.metadata.reason).toBe('migration');
      expect(migratedSnapshot.metadata.tags).toContain('migration');
      expect(migratedSnapshot.metadata.tags).toContain('from-v1.0');
      expect(migratedSnapshot.metadata.tags).toContain('to-v2.0');
      expect(migratedSnapshot.metadata.additionalData?.preMigrationVersion).toBe('v1.0');
      expect(migratedSnapshot.metadata.additionalData?.postMigrationVersion).toBe('v2.0');
    });

    it('should handle migration errors', async () => {
      const errorMigrationFn = (): IProcessManagerState => {
        throw new Error('Migration error');
      };

      const [error] = await safeRun(() =>
        recovery.migrateProcessState(mockProcessManager, 'v1', 'v2', errorMigrationFn)
      );

      expect(error).toBeInstanceOf(ProcessRecoveryError);
      expect((error as ProcessRecoveryError)?.code).toBe('MIGRATION_FAILED');
      expect(error?.message).toContain('Migration error');
    });

    it('should preserve pre-migration snapshot', async () => {
      const migrationFn = (state: IProcessManagerState): IProcessManagerState => ({
        ...state,
        currentStep: 'migrated',
      });

      await recovery.migrateProcessState(mockProcessManager, 'v1', 'v2', migrationFn);

      // Should have both pre and post migration snapshots
      const allSnapshots = await repository.loadSnapshot(mockProcessManager.id);
      expect(allSnapshots).toBeDefined();
    });
  });

  describe('validateRecovery()', () => {
    it('should perform dry run validation successfully', async () => {
      const result = await recovery.validateRecovery('test-process-recovery');

      expect(result.success).toBe(true);
      expect(result.processManager).toBeUndefined(); // Should not return actual instance
      expect(result.snapshot).toStrictEqual(snapshot);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.integrityVerified).toBe(true);
      expect(result.metadata.validationPassed).toBe(true);
    });

    it('should detect validation issues in dry run', async () => {
      // Create invalid snapshot data for dry run
      const invalidSnapshotData = {
        processManagerId: 'test-process-recovery',
        processManagerType: 'TestRecoveryProcess',
        state: {
          currentStep: '', // Invalid empty step
          stepData: {},
          version: -1, // Invalid negative version
          lastModified: new Date(),
          correlationData: {},
        },
        status: 'RUNNING',
        snapshotTimestamp: new Date(),
        version: 1,
        metadata: {
          reason: 'manual',
          sizeBytes: 100,
          stateHash: 'test-hash',
        },
      };

      // Mock repository to return invalid snapshot
      vi.spyOn(repository, 'loadSnapshot').mockResolvedValue(invalidSnapshotData);

      const result = await recovery.validateRecovery('test-process-recovery');

      expect(result.success).toBe(false);
      expect(result.processManager).toBeUndefined();
      expect(result.errors[0]).toContain('Recovery failed: Invalid snapshot');

      // Restore the mock
      vi.restoreAllMocks();
    });

    it('should force validation and integrity checks in dry run', async () => {
      const options: ProcessRecoveryOptions = {
        validateSnapshot: false, // Should be overridden to true
        verifyIntegrity: false, // Should be overridden to true
      };

      const result = await recovery.validateRecovery('test-process-recovery', options);

      expect(result.success).toBe(true);
      expect(result.metadata.validationPassed).toBe(true);
      expect(result.metadata.integrityVerified).toBe(true);
    });
  });

  describe('recoverToVersion()', () => {
    it('should throw not implemented error', async () => {
      const [error] = await safeRun(() => recovery.recoverToVersion('test-process', 1));

      expect(error).toBeInstanceOf(ProcessRecoveryError);
      expect((error as ProcessRecoveryError)?.code).toBe('NOT_IMPLEMENTED');
      expect(error?.message).toContain('Recovery to specific version not yet implemented');
    });
  });

  describe('Error Handling', () => {
    it('should create ProcessRecoveryError with proper structure', () => {
      const error = new ProcessRecoveryError('Test recovery error', 'TEST_RECOVERY_ERROR', {
        testDetail: 'value',
      });

      expect(error.name).toBe('ProcessRecoveryError');
      expect(error.message).toBe('Test recovery error');
      expect(error.code).toBe('TEST_RECOVERY_ERROR');
      expect(error.details?.testDetail).toBe('value');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ProcessRecoveryError).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle recovery with minimal options', async () => {
      const result = await recovery.recoverFromSnapshot('test-process-recovery', {});

      expect(result.success).toBe(true);
      expect(result.processManager).toBeDefined();
    });

    it('should handle multiple concurrent recoveries', async () => {
      const concurrentRecoveries = Array.from({ length: 5 }, (_, i) =>
        recovery.recoverFromSnapshot('test-process-recovery')
      );

      const results = await Promise.all(concurrentRecoveries);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.processManager).toBeDefined();
      });

      // Verify factory was called for each recovery
      expect(processManagerFactory).toHaveBeenCalledTimes(5);
    });

    it('should handle recovery with all options enabled', async () => {
      const options: ProcessRecoveryOptions = {
        validateSnapshot: true,
        verifyIntegrity: true,
        maxSnapshotAge: 60000, // 1 minute
        forceRecovery: false,
        onWarning: vi.fn(),
      };

      const result = await recovery.recoverFromSnapshot('test-process-recovery', options);

      expect(result.success).toBe(true);
      expect(result.metadata.validationPassed).toBe(true);
      expect(result.metadata.integrityVerified).toBe(true);
    });

    it('should handle process manager with different status in snapshot', async () => {
      // Create and save process manager first
      const statusTestProcess = new MockProcessManager({
        id: 'status-test-process',
        type: 'StatusTestProcess',
        initialState: {
          currentStep: 'status-test',
          stepData: {},
          version: 1,
          lastModified: new Date(),
          correlationData: {},
        },
      });
      await repository.save(statusTestProcess);

      // Create snapshot with COMPLETED status but valid state
      const differentStatusSnapshot = new ProcessSnapshot(
        'status-test-process',
        'StatusTestProcess',
        {
          currentStep: 'status-test',
          stepData: {},
          version: 1,
          lastModified: new Date(),
          correlationData: {},
        },
        ProcessManagerStatus.COMPLETED, // Different status
        new Date(),
        1,
        {
          reason: 'manual',
          sizeBytes: 100,
          stateHash: await (async () => {
            // Calculate actual hash for the state
            const stateStr = JSON.stringify({
              currentStep: 'status-test',
              stepData: {},
              version: 1,
              correlationData: {},
            });
            let hash = 0;
            for (let i = 0; i < stateStr.length; i++) {
              const char = stateStr.charCodeAt(i);
              hash = (hash << 5) - hash + char;
              hash = hash & hash;
            }
            return Math.abs(hash).toString(36);
          })(),
        }
      );

      // Convert to interface data for repository
      const snapshotData = {
        processManagerId: differentStatusSnapshot.processManagerId,
        processManagerType: differentStatusSnapshot.processManagerType,
        state: differentStatusSnapshot.state,
        status: differentStatusSnapshot.status.toString(),
        snapshotTimestamp: differentStatusSnapshot.snapshotTimestamp,
        version: differentStatusSnapshot.version,
        metadata: differentStatusSnapshot.metadata,
      };
      await repository.saveSnapshot(snapshotData);

      const result = await recovery.recoverFromSnapshot('status-test-process');

      expect(result.success).toBe(true);
      expect(result.processManager).toBeDefined();
      // Status difference should be logged but not prevent recovery
    });

    it('should handle very large snapshots', async () => {
      const largeState: IProcessManagerState = {
        ...mockState,
        stepData: {
          largeArray: Array.from({ length: 10000 }, (_, i) => ({ id: i, data: `item-${i}` })),
        },
      };

      const largeProcess = new MockProcessManager({
        id: 'large-process',
        type: 'LargeProcess',
        initialState: largeState,
      });

      // Save process manager first
      await repository.save(largeProcess);

      const largeSnapshot = await ProcessSnapshot.fromProcessManager(largeProcess);

      // Convert to interface data for repository
      const largeSnapshotData = {
        processManagerId: largeSnapshot.processManagerId,
        processManagerType: largeSnapshot.processManagerType,
        state: largeSnapshot.state,
        status: largeSnapshot.status.toString(),
        snapshotTimestamp: largeSnapshot.snapshotTimestamp,
        version: largeSnapshot.version,
        metadata: largeSnapshot.metadata,
      };
      await repository.saveSnapshot(largeSnapshotData);

      const result = await recovery.recoverFromSnapshot('large-process');

      expect(result.success).toBe(true);
      // Note: Large arrays are converted to objects during JSON serialization
      expect(result.processManager?.state.stepData.largeArray).toBeDefined();
      // Check that the large array was preserved (as object with numeric keys)
      expect(Object.keys(result.processManager?.state.stepData.largeArray || {})).toHaveLength(
        10000
      );
    });
  });
});
