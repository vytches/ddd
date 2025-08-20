import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { InMemoryProcessRepository } from '../../src/repositories/in-memory-process-repository';
import {
  ProcessRepositoryError,
  ConcurrencyError,
  ProcessValidationError,
  StorageError,
} from '../../src/repositories/process-repository-errors';
import type {
  IProcessRepository,
  ProcessManagerId,
  CorrelationData,
  ProcessSnapshot,
} from '../../src/interfaces/process-repository.interface';
import type { IProcessManager } from '../../src/interfaces/process-manager.interface';
import { ProcessManagerStatus } from '../../src/interfaces/process-manager.interface';
import { MockProcessManager } from '../mocks/mock-process-manager';

describe('InMemoryProcessRepository', () => {
  let repository: InMemoryProcessRepository;
  let mockProcessManager: MockProcessManager;
  let mockSnapshot: ProcessSnapshot;

  beforeEach(() => {
    repository = new InMemoryProcessRepository({
      enableOptimisticLocking: true,
      maxStorageSize: 100,
      maxSnapshotsPerProcess: 10,
      enableAuditLog: false,
      enableDelaySimulation: false,
    });

    mockProcessManager = new MockProcessManager({
      id: 'test-process-1',
      type: 'TestProcess',
      initialState: {
        currentStep: 'initial',
        stepData: { testData: 'value' },
        version: 1,
        lastModified: new Date(),
        correlationData: { orderId: 'order-123' },
      },
    });

    mockSnapshot = {
      processManagerId: 'test-process-1',
      processManagerType: 'TestProcess',
      state: {
        currentStep: 'snapshot-step',
        stepData: { snapshotData: 'value' },
        version: 5,
        lastModified: new Date(),
        correlationData: { orderId: 'order-123' },
      },
      status: ProcessManagerStatus.RUNNING,
      snapshotTimestamp: new Date(),
      version: 5,
      metadata: { snapshotReason: 'test' },
    };
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const repo = new InMemoryProcessRepository();
      const stats = repo.getStatistics();

      expect(stats.totalProcessManagers).toBe(0);
      expect(stats.totalSnapshots).toBe(0);
      expect(stats.operationCounts.saves).toBe(0);
    });

    it('should initialize with custom options', () => {
      const repo = new InMemoryProcessRepository({
        maxStorageSize: 50,
        enableOptimisticLocking: false,
        enableAuditLog: true,
      });

      const stats = repo.getStatistics();
      expect(stats.totalProcessManagers).toBe(0);
    });
  });

  describe('save()', () => {
    it('should save a new process manager successfully', async () => {
      const [error] = await safeRun(() => repository.save(mockProcessManager));

      expect(error).toBeUndefined();

      const stats = repository.getStatistics();
      expect(stats.totalProcessManagers).toBe(1);
      expect(stats.operationCounts.saves).toBe(1);
    });

    it('should update an existing process manager', async () => {
      // Save initial version
      await repository.save(mockProcessManager);

      // Update and save again
      await mockProcessManager.simulateStateUpdate({
        currentStep: 'updated',
      });

      const [error] = await safeRun(() => repository.save(mockProcessManager));

      expect(error).toBeUndefined();

      const stats = repository.getStatistics();
      expect(stats.totalProcessManagers).toBe(1);
      expect(stats.operationCounts.saves).toBe(2);
    });

    it('should enforce optimistic concurrency control', async () => {
      // Save initial version
      await repository.save(mockProcessManager);

      // Create another instance with same ID but lower version
      const conflictingProcess = new MockProcessManager({
        id: 'test-process-1',
        type: 'TestProcess',
        initialState: {
          currentStep: 'conflicting',
          stepData: {},
          version: 1, // Same version as stored
          lastModified: new Date(),
          correlationData: {},
        },
      });

      const [concurrencyError] = await safeRun(() => repository.save(conflictingProcess));

      expect(concurrencyError).toBeInstanceOf(ConcurrencyError);
      expect((concurrencyError as ConcurrencyError).expectedVersion).toBe(2);
      expect((concurrencyError as ConcurrencyError).actualVersion).toBe(1);
    });

    it('should enforce storage limits', async () => {
      const limitedRepo = new InMemoryProcessRepository({ maxStorageSize: 1 });

      // Save first process
      await limitedRepo.save(mockProcessManager);

      // Try to save second process
      const secondProcess = new MockProcessManager({
        id: 'test-process-2',
        type: 'TestProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 1,
          lastModified: new Date(),
          correlationData: {},
        },
      });

      const [storageError] = await safeRun(() => limitedRepo.save(secondProcess));

      expect(storageError).toBeInstanceOf(StorageError);
      expect(storageError?.message).toContain('Storage limit exceeded');
    });

    it('should validate process manager data', async () => {
      const invalidProcess = {
        id: '',
        type: 'TestProcess',
        state: { version: -1 },
      } as unknown as IProcessManager;

      const [validationError] = await safeRun(() => repository.save(invalidProcess));

      expect(validationError).toBeInstanceOf(ProcessValidationError);
    });
  });

  describe('load()', () => {
    it('should load an existing process manager', async () => {
      // Save a process manager
      await repository.save(mockProcessManager);

      const [error, loaded] = await safeRun(() => repository.load('test-process-1'));

      expect(error).toBeUndefined();
      expect(loaded).toBeDefined();
      expect(loaded!.id).toBe('test-process-1');
      expect(loaded!.type).toBe('TestProcess');
      expect(loaded!.state.currentStep).toBe('initial');
    });

    it('should return undefined for non-existent process manager', async () => {
      const [error, loaded] = await safeRun(() => repository.load('non-existent'));

      expect(error).toBeUndefined();
      expect(loaded).toBeUndefined();
    });

    it('should validate process manager ID', async () => {
      const [validationError] = await safeRun(() => repository.load(''));

      expect(validationError).toBeInstanceOf(ProcessValidationError);
      expect(validationError?.message).toContain('must be a non-empty string');
    });

    it('should return isolated copies', async () => {
      await repository.save(mockProcessManager);

      const loaded1 = await repository.load('test-process-1');
      const loaded2 = await repository.load('test-process-1');

      expect(loaded1).not.toBe(loaded2); // Different object references
      expect(loaded1!.state).not.toBe(loaded2!.state); // Different state references
    });
  });

  describe('findByCorrelation()', () => {
    beforeEach(async () => {
      // Save multiple process managers with different correlation data
      await repository.save(mockProcessManager);

      const secondProcess = new MockProcessManager({
        id: 'test-process-2',
        type: 'TestProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 1,
          lastModified: new Date(),
          correlationData: { orderId: 'order-456', customerId: 'customer-1' },
        },
      });
      await repository.save(secondProcess);

      const thirdProcess = new MockProcessManager({
        id: 'test-process-3',
        type: 'AnotherProcess',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 1,
          lastModified: new Date(),
          correlationData: { customerId: 'customer-1' },
        },
      });
      await repository.save(thirdProcess);
    });

    it('should find process managers by single correlation field', async () => {
      const [error, results] = await safeRun(() =>
        repository.findByCorrelation({ orderId: 'order-123' })
      );

      expect(error).toBeUndefined();
      expect(results).toBeDefined();
      expect(results).toHaveLength(1);
      if (results && results[0]) {
        expect(results[0].id).toBe('test-process-1');
      }
    });

    it('should find process managers by multiple correlation fields', async () => {
      const [error, results] = await safeRun(() =>
        repository.findByCorrelation({ orderId: 'order-456', customerId: 'customer-1' })
      );

      expect(error).toBeUndefined();
      expect(results).toBeDefined();
      expect(results).toHaveLength(1);
      if (results && results[0]) {
        expect(results[0].id).toBe('test-process-2');
      }
    });

    it('should return empty array when no matches found', async () => {
      const [error, results] = await safeRun(() =>
        repository.findByCorrelation({ orderId: 'non-existent' })
      );

      expect(error).toBeUndefined();
      expect(results).toHaveLength(0);
    });

    it('should validate correlation data', async () => {
      const [validationError] = await safeRun(() => repository.findByCorrelation({}));

      expect(validationError).toBeInstanceOf(ProcessValidationError);
      expect(validationError?.message).toContain('cannot be empty');
    });
  });

  describe('saveSnapshot()', () => {
    beforeEach(async () => {
      // Save the process manager first
      await repository.save(mockProcessManager);
    });

    it('should save a snapshot successfully', async () => {
      const [error] = await safeRun(() => repository.saveSnapshot(mockSnapshot));

      expect(error).toBeUndefined();

      const stats = repository.getStatistics();
      expect(stats.totalSnapshots).toBe(1);
      expect(stats.operationCounts.snapshotSaves).toBe(1);
    });

    it('should enforce snapshot limits per process', async () => {
      const limitedRepo = new InMemoryProcessRepository({
        maxSnapshotsPerProcess: 2,
      });
      await limitedRepo.save(mockProcessManager);

      // Save maximum allowed snapshots
      for (let i = 0; i < 3; i++) {
        const snapshot = {
          ...mockSnapshot,
          version: i + 1,
          snapshotTimestamp: new Date(Date.now() + i * 1000),
        };
        await limitedRepo.saveSnapshot(snapshot);
      }

      const stats = limitedRepo.getStatistics();
      expect(stats.totalSnapshots).toBe(2); // Should be limited to 2
    });

    it('should validate snapshot for non-existent process', async () => {
      const invalidSnapshot = {
        ...mockSnapshot,
        processManagerId: 'non-existent',
      };

      const [validationError] = await safeRun(() => repository.saveSnapshot(invalidSnapshot));

      expect(validationError).toBeInstanceOf(ProcessValidationError);
      expect(validationError?.message).toContain('does not exist');
    });

    it('should validate snapshot data', async () => {
      const invalidSnapshot = {
        ...mockSnapshot,
        processManagerId: '',
        version: -1,
      };

      const [validationError] = await safeRun(() => repository.saveSnapshot(invalidSnapshot));

      expect(validationError).toBeInstanceOf(ProcessValidationError);
    });
  });

  describe('loadSnapshot()', () => {
    beforeEach(async () => {
      await repository.save(mockProcessManager);
      await repository.saveSnapshot(mockSnapshot);
    });

    it('should load the most recent snapshot', async () => {
      // Save an older snapshot
      const olderSnapshot = {
        ...mockSnapshot,
        version: 3,
        snapshotTimestamp: new Date(Date.now() - 10000),
      };
      await repository.saveSnapshot(olderSnapshot);

      const [error, loaded] = await safeRun(() => repository.loadSnapshot('test-process-1'));

      expect(error).toBeUndefined();
      expect(loaded).toBeDefined();
      expect(loaded!.version).toBe(5); // Should be the newer snapshot
    });

    it('should return undefined for non-existent snapshots', async () => {
      const [error, loaded] = await safeRun(() => repository.loadSnapshot('non-existent'));

      expect(error).toBeUndefined();
      expect(loaded).toBeUndefined();
    });

    it('should return isolated copies', async () => {
      const loaded1 = await repository.loadSnapshot('test-process-1');
      const loaded2 = await repository.loadSnapshot('test-process-1');

      expect(loaded1).not.toBe(loaded2);
      expect(loaded1!.state).not.toBe(loaded2!.state);
    });
  });

  describe('delete()', () => {
    beforeEach(async () => {
      await repository.save(mockProcessManager);
      await repository.saveSnapshot(mockSnapshot);
    });

    it('should delete an existing process manager and its snapshots', async () => {
      const [error, deleted] = await safeRun(() => repository.delete('test-process-1'));

      expect(error).toBeUndefined();
      expect(deleted).toBe(true);

      const stats = repository.getStatistics();
      expect(stats.totalProcessManagers).toBe(0);
      expect(stats.totalSnapshots).toBe(0);
    });

    it('should return false for non-existent process manager', async () => {
      const [error, deleted] = await safeRun(() => repository.delete('non-existent'));

      expect(error).toBeUndefined();
      expect(deleted).toBe(false);
    });

    it('should validate process manager ID', async () => {
      const [validationError] = await safeRun(() => repository.delete(''));

      expect(validationError).toBeInstanceOf(ProcessValidationError);
    });
  });

  describe('exists()', () => {
    beforeEach(async () => {
      await repository.save(mockProcessManager);
    });

    it('should return true for existing process manager', async () => {
      const [error, exists] = await safeRun(() => repository.exists('test-process-1'));

      expect(error).toBeUndefined();
      expect(exists).toBe(true);
    });

    it('should return false for non-existent process manager', async () => {
      const [error, exists] = await safeRun(() => repository.exists('non-existent'));

      expect(error).toBeUndefined();
      expect(exists).toBe(false);
    });

    it('should validate process manager ID', async () => {
      const [validationError] = await safeRun(() => repository.exists(''));

      expect(validationError).toBeInstanceOf(ProcessValidationError);
    });
  });

  describe('getStatistics()', () => {
    it('should return accurate statistics', async () => {
      const initialStats = repository.getStatistics();
      expect(initialStats.totalProcessManagers).toBe(0);
      expect(initialStats.totalSnapshots).toBe(0);

      // Add some data
      await repository.save(mockProcessManager);
      await repository.saveSnapshot(mockSnapshot);

      const secondProcess = new MockProcessManager({
        id: 'test-process-2',
        type: 'AnotherType',
        initialState: {
          currentStep: 'initial',
          stepData: {},
          version: 1,
          lastModified: new Date(),
          correlationData: {},
        },
      });
      await repository.save(secondProcess);

      const finalStats = repository.getStatistics();
      expect(finalStats.totalProcessManagers).toBe(2);
      expect(finalStats.totalSnapshots).toBe(1);
      expect(finalStats.processManagersByType).toEqual({
        TestProcess: 1,
        AnotherType: 1,
      });
      expect(finalStats.operationCounts.saves).toBe(2);
      expect(finalStats.operationCounts.snapshotSaves).toBe(1);
    });
  });

  describe('clear()', () => {
    it('should clear all data and reset statistics', async () => {
      // Add some data
      await repository.save(mockProcessManager);
      await repository.saveSnapshot(mockSnapshot);

      let stats = repository.getStatistics();
      expect(stats.totalProcessManagers).toBe(1);
      expect(stats.totalSnapshots).toBe(1);

      // Clear everything
      repository.clear();

      stats = repository.getStatistics();
      expect(stats.totalProcessManagers).toBe(0);
      expect(stats.totalSnapshots).toBe(0);
      expect(Object.keys(stats.processManagersByType)).toHaveLength(0);

      // Verify data is actually gone
      const loaded = await repository.load('test-process-1');
      expect(loaded).toBeUndefined();
    });
  });

  describe('Concurrency and Error Handling', () => {
    it('should handle concurrent operations safely', async () => {
      const processes = Array.from(
        { length: 10 },
        (_, i) =>
          new MockProcessManager({
            id: `process-${i}`,
            type: 'TestProcess',
            initialState: {
              currentStep: 'initial',
              stepData: { index: i },
              version: 1,
              lastModified: new Date(),
              correlationData: { batchId: 'batch-1' },
            },
          })
      );

      // Save all processes concurrently
      const savePromises = processes.map(p => repository.save(p));
      const results = await Promise.allSettled(savePromises);

      // All should succeed
      results.forEach(result => {
        expect(result.status).toBe('fulfilled');
      });

      const stats = repository.getStatistics();
      expect(stats.totalProcessManagers).toBe(10);

      // Find by correlation should return all
      const found = await repository.findByCorrelation({ batchId: 'batch-1' });
      expect(found).toHaveLength(10);
    });

    it('should provide detailed error information', async () => {
      const [error] = await safeRun(() => repository.save(null as any));

      expect(error).toBeInstanceOf(ProcessValidationError);
      const validationError = error as ProcessValidationError;
      expect(validationError.code).toBe('VALIDATION_ERROR');
      expect(validationError.field).toBe('process');
      expect(validationError.details).toBeDefined();
    });
  });

  describe('Performance and Delay Simulation', () => {
    it('should respect delay simulation settings', async () => {
      const delayRepo = new InMemoryProcessRepository({
        enableDelaySimulation: true,
        defaultDelay: 10,
      });

      const start = Date.now();
      await delayRepo.save(mockProcessManager);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(10);
    });

    it('should not delay when simulation is disabled', async () => {
      const noDelayRepo = new InMemoryProcessRepository({
        enableDelaySimulation: false,
      });

      const start = Date.now();
      await noDelayRepo.save(mockProcessManager);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10);
    });
  });
});
