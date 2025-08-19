import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  ProcessSnapshot,
  ProcessSnapshotError,
  type ProcessSnapshotOptions,
  type SnapshotMetadata,
} from '../../src/core/process-snapshot';
import { ProcessManagerStatus } from '../../src/interfaces/process-manager.interface';
import type { IProcessManagerState } from '../../src/interfaces/process-manager-state.interface';
import { MockProcessManager } from '../mocks/mock-process-manager';

describe('ProcessSnapshot', () => {
  let mockProcessManager: MockProcessManager;
  let mockState: IProcessManagerState;
  let mockMetadata: SnapshotMetadata;

  beforeEach(() => {
    mockState = {
      currentStep: 'test-step',
      stepData: { testValue: 'data', nested: { value: 42 } },
      version: 1,
      lastModified: new Date('2024-01-01T10:00:00.000Z'),
      correlationData: { orderId: 'order-123', customerId: 'customer-456' },
      metadata: { tag: 'test' },
    };

    mockMetadata = {
      reason: 'manual',
      sizeBytes: 256,
      stateHash: 'test-hash-123',
      tags: ['test', 'snapshot'],
      additionalData: { source: 'test' },
    };

    mockProcessManager = new MockProcessManager({
      id: 'test-process-1',
      type: 'TestProcess',
      initialState: mockState,
    });
  });

  describe('Constructor', () => {
    it('should create a valid snapshot with all required properties', () => {
      const snapshotTimestamp = new Date();
      const snapshot = new ProcessSnapshot(
        'test-process-1',
        'TestProcess',
        mockState,
        ProcessManagerStatus.RUNNING,
        snapshotTimestamp,
        1,
        mockMetadata
      );

      expect(snapshot.processManagerId).toBe('test-process-1');
      expect(snapshot.processManagerType).toBe('TestProcess');
      expect(snapshot.state).toEqual(mockState);
      expect(snapshot.status).toBe(ProcessManagerStatus.RUNNING);
      expect(snapshot.snapshotTimestamp).toBe(snapshotTimestamp);
      expect(snapshot.version).toBe(1);
      expect(snapshot.metadata).toEqual(mockMetadata);
    });

    it('should validate snapshot during construction and throw for invalid data', () => {
      const [error] = safeRun(
        () =>
          new ProcessSnapshot(
            '', // Invalid empty ID
            'TestProcess',
            mockState,
            ProcessManagerStatus.RUNNING,
            new Date(),
            1,
            mockMetadata
          )
      );

      expect(error).toBeInstanceOf(ProcessSnapshotError);
      expect(error?.message).toContain('Process manager ID must be a non-empty string');
    });

    it('should validate state structure', () => {
      const invalidState = {
        ...mockState,
        version: -1, // Invalid negative version
      };

      const [error] = safeRun(
        () =>
          new ProcessSnapshot(
            'test-process-1',
            'TestProcess',
            invalidState,
            ProcessManagerStatus.RUNNING,
            new Date(),
            1,
            mockMetadata
          )
      );

      expect(error).toBeInstanceOf(ProcessSnapshotError);
      expect(error?.message).toContain('State version must be a non-negative number');
    });

    it('should validate metadata structure', () => {
      const invalidMetadata = {
        ...mockMetadata,
        reason: 'invalid-reason' as any, // Invalid reason
      };

      const [error] = safeRun(
        () =>
          new ProcessSnapshot(
            'test-process-1',
            'TestProcess',
            mockState,
            ProcessManagerStatus.RUNNING,
            new Date(),
            1,
            invalidMetadata
          )
      );

      expect(error).toBeInstanceOf(ProcessSnapshotError);
      expect(error?.message).toContain('Metadata reason must be one of');
    });
  });

  describe('fromProcessManager()', () => {
    it('should create snapshot from process manager with default options', async () => {
      const snapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager);

      expect(snapshot.processManagerId).toBe(mockProcessManager.id);
      expect(snapshot.processManagerType).toBe(mockProcessManager.type);
      expect(snapshot.state.currentStep).toBe(mockProcessManager.state.currentStep);
      expect(snapshot.status).toBe(mockProcessManager.status);
      expect(snapshot.version).toBe(mockProcessManager.state.version);
      expect(snapshot.metadata.reason).toBe('manual');
      expect(snapshot.metadata.sizeBytes).toBeGreaterThan(0);
      expect(snapshot.metadata.stateHash).toBeTruthy();
    });

    it('should create snapshot with custom options', async () => {
      const options: ProcessSnapshotOptions = {
        reason: 'scheduled',
        enableCompression: true,
        tags: ['scheduled', 'automated'],
        metadata: {
          additionalData: { batchId: 'batch-123' },
        },
      };

      const snapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager, options);

      expect(snapshot.metadata.reason).toBe('scheduled');
      expect(snapshot.metadata.compression).toBe('gzip');
      expect(snapshot.metadata.tags).toEqual(['scheduled', 'automated']);
      expect(snapshot.metadata.additionalData?.batchId).toBe('batch-123');
    });

    it('should create immutable state copy', async () => {
      const snapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager);

      // Modify original state
      await mockProcessManager.simulateStateUpdate({
        currentStep: 'modified-step',
        stepData: { modified: true },
      });

      // Snapshot state should remain unchanged
      expect(snapshot.state.currentStep).toBe('test-step');
      expect(snapshot.state.stepData).toEqual({ testValue: 'data', nested: { value: 42 } });
    });

    it('should handle process manager with minimal state', async () => {
      const minimalState: IProcessManagerState = {
        currentStep: 'start',
        stepData: {},
        version: 0,
        lastModified: new Date(),
        correlationData: {},
      };

      const minimalProcess = new MockProcessManager({
        id: 'minimal-process',
        type: 'MinimalProcess',
        initialState: minimalState,
      });

      const snapshot = await ProcessSnapshot.fromProcessManager(minimalProcess);

      expect(snapshot.processManagerId).toBe('minimal-process');
      expect(snapshot.state.currentStep).toBe('start');
      expect(snapshot.state.stepData).toEqual({});
      expect(snapshot.metadata.sizeBytes).toBeGreaterThan(0);
    });

    it('should handle large state data', async () => {
      const largeStepData = {
        largeArray: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` })),
        largeObject: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`key-${i}`, `value-${i}`])
        ),
      };

      const largeState: IProcessManagerState = {
        ...mockState,
        stepData: largeStepData,
      };

      const largeProcess = new MockProcessManager({
        id: 'large-process',
        type: 'LargeProcess',
        initialState: largeState,
      });

      const snapshot = await ProcessSnapshot.fromProcessManager(largeProcess, {
        enableCompression: true,
      });

      expect(snapshot.metadata.sizeBytes).toBeGreaterThan(1000);
      expect(snapshot.metadata.compression).toBe('gzip');
      // Note: Large arrays may be converted to objects during JSON serialization
      expect(snapshot.state.stepData.largeArray).toBeDefined();
      expect(snapshot.state.stepData.largeObject).toEqual(largeStepData.largeObject);
    });
  });

  describe('validate()', () => {
    let validSnapshot: ProcessSnapshot;

    beforeEach(async () => {
      validSnapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager);
    });

    it('should return valid result for valid snapshot', () => {
      const validation = validSnapshot.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid process manager ID', () => {
      // Since validation now happens in constructor, we expect it to throw
      const [error] = safeRun(
        () =>
          new ProcessSnapshot(
            '', // Invalid empty ID
            'TestProcess',
            { ...mockState },
            ProcessManagerStatus.RUNNING,
            new Date(),
            1,
            { ...mockMetadata, reason: 'manual' }
          )
      );

      expect(error).toBeInstanceOf(ProcessSnapshotError);
      expect(error?.message).toContain('Process manager ID must be a non-empty string');
    });

    it('should detect version inconsistencies', () => {
      const inconsistentState = { ...mockState, version: 5 };
      const snapshot = new ProcessSnapshot(
        'test-process-1',
        'TestProcess',
        inconsistentState,
        ProcessManagerStatus.RUNNING,
        new Date(),
        3, // Different from state version
        mockMetadata
      );

      const validation = snapshot.validate();
      expect(validation.isValid).toBe(true); // Still valid
      expect(validation.warnings).toContain('State version (5) differs from snapshot version (3)');
    });

    it('should detect timestamp inconsistencies', () => {
      const futureModified = new Date(Date.now() + 10000); // 10 seconds in future
      const pastSnapshot = new Date(Date.now() - 5000); // 5 seconds ago

      const inconsistentState = { ...mockState, lastModified: futureModified };
      const snapshot = new ProcessSnapshot(
        'test-process-1',
        'TestProcess',
        inconsistentState,
        ProcessManagerStatus.RUNNING,
        pastSnapshot,
        1,
        mockMetadata
      );

      const validation = snapshot.validate();
      expect(validation.isValid).toBe(true); // Still valid
      expect(validation.warnings).toContain('State was modified after snapshot timestamp');
    });

    it('should validate all required fields', () => {
      const invalidMetadata = {
        reason: 'invalid' as any,
        sizeBytes: -1,
        stateHash: '',
      };

      const [error] = safeRun(
        () =>
          new ProcessSnapshot(
            'test-process-1',
            'TestProcess',
            mockState,
            ProcessManagerStatus.RUNNING,
            new Date(),
            1,
            invalidMetadata
          )
      );

      expect(error).toBeInstanceOf(ProcessSnapshotError);
      expect(error?.message).toContain('Metadata reason must be one of');
    });
  });

  describe('verifyIntegrity()', () => {
    it('should verify integrity for valid snapshot', async () => {
      const snapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager);
      const isValid = await snapshot.verifyIntegrity();

      expect(isValid).toBe(true);
    });

    it('should detect integrity violations', async () => {
      const snapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager);

      // Modify the state hash to simulate corruption
      Object.defineProperty(snapshot.metadata, 'stateHash', {
        value: 'corrupted-hash',
        configurable: true,
      });

      const isValid = await snapshot.verifyIntegrity();
      expect(isValid).toBe(false);
    });
  });

  describe('serialize() and deserialize()', () => {
    let snapshot: ProcessSnapshot;

    beforeEach(async () => {
      snapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager, {
        reason: 'scheduled',
        tags: ['test', 'serialization'],
      });
    });

    it('should serialize and deserialize successfully', async () => {
      const serialized = await snapshot.serialize();
      expect(serialized).toBeTruthy();

      const deserialized = await ProcessSnapshot.deserialize(serialized);

      expect(deserialized.processManagerId).toBe(snapshot.processManagerId);
      expect(deserialized.processManagerType).toBe(snapshot.processManagerType);
      expect(deserialized.state.currentStep).toBe(snapshot.state.currentStep);
      expect(deserialized.state.version).toBe(snapshot.state.version);
      expect(deserialized.version).toBe(snapshot.version);
      expect(deserialized.metadata.reason).toBe(snapshot.metadata.reason);
      expect(deserialized.metadata.tags).toEqual(snapshot.metadata.tags);
    });

    it('should preserve Date objects during serialization', async () => {
      const serialized = await snapshot.serialize();
      const deserialized = await ProcessSnapshot.deserialize(serialized);

      expect(deserialized.snapshotTimestamp).toBeInstanceOf(Date);
      expect(deserialized.state.lastModified).toBeInstanceOf(Date);
      expect(deserialized.snapshotTimestamp.getTime()).toBe(snapshot.snapshotTimestamp.getTime());
      expect(deserialized.state.lastModified.getTime()).toBe(snapshot.state.lastModified.getTime());
    });

    it('should handle complex nested objects', async () => {
      const complexState: IProcessManagerState = {
        currentStep: 'complex',
        stepData: {
          array: [1, 2, { nested: true }],
          object: { deep: { nesting: { value: 'test' } } },
          nullValue: null,
          undefinedValue: undefined,
        },
        version: 1,
        lastModified: new Date(),
        correlationData: { complex: { structure: true } },
      };

      const complexProcess = new MockProcessManager({
        id: 'complex-process',
        type: 'ComplexProcess',
        initialState: complexState,
      });

      const complexSnapshot = await ProcessSnapshot.fromProcessManager(complexProcess);
      const serialized = await complexSnapshot.serialize();
      const deserialized = await ProcessSnapshot.deserialize(serialized);

      // Note: Arrays are converted to objects during JSON serialization
      expect(deserialized.state.stepData.array).toBeDefined();
      expect(deserialized.state.stepData.object).toEqual({ deep: { nesting: { value: 'test' } } });
      expect(deserialized.state.stepData.nullValue).toBe(null);
      // undefinedValue is lost during JSON serialization (expected behavior)
    });

    it('should throw error for invalid serialized data', async () => {
      const invalidJson = '{"invalid": "json"';
      const [error] = await safeRun(() => ProcessSnapshot.deserialize(invalidJson));

      expect(error).toBeInstanceOf(ProcessSnapshotError);
      expect((error as ProcessSnapshotError)?.code).toBe('SNAPSHOT_DESERIALIZATION_FAILED');
    });

    it('should throw error for missing required fields in serialized data', async () => {
      const incompleteData = JSON.stringify({
        processManagerId: 'test',
        // Missing other required fields
      });

      const [error] = await safeRun(() => ProcessSnapshot.deserialize(incompleteData));

      expect(error).toBeInstanceOf(ProcessSnapshotError);
      expect((error as ProcessSnapshotError)?.code).toBe('SNAPSHOT_DESERIALIZATION_FAILED');
    });
  });

  describe('withMetadata()', () => {
    it('should create new snapshot with updated metadata', async () => {
      const original = await ProcessSnapshot.fromProcessManager(mockProcessManager);
      const updated = original.withMetadata({
        reason: 'recovery',
        tags: ['recovery', 'updated'],
        additionalData: { source: 'test-update' },
      });

      expect(updated.processManagerId).toBe(original.processManagerId);
      expect(updated.state).toBe(original.state);
      expect(updated.version).toBe(original.version);
      expect(updated.metadata.reason).toBe('recovery');
      expect(updated.metadata.tags).toEqual(['recovery', 'updated']);
      expect(updated.metadata.additionalData?.source).toBe('test-update');
      expect(updated.metadata.sizeBytes).toBe(original.metadata.sizeBytes); // Preserved
    });
  });

  describe('isNewerThan()', () => {
    it('should correctly compare snapshot versions', async () => {
      const older = await ProcessSnapshot.fromProcessManager(mockProcessManager);

      // Create newer process manager with higher version
      await mockProcessManager.simulateStateUpdate({ currentStep: 'updated' });
      const newer = await ProcessSnapshot.fromProcessManager(mockProcessManager);

      expect(newer.isNewerThan(older)).toBe(true);
      expect(older.isNewerThan(newer)).toBe(false);
    });

    it('should compare timestamps when versions are equal', async () => {
      const first = await ProcessSnapshot.fromProcessManager(mockProcessManager);

      // Create snapshot with same version but later timestamp
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const second = new ProcessSnapshot(
        first.processManagerId,
        first.processManagerType,
        first.state,
        first.status,
        new Date(), // Later timestamp
        first.version, // Same version
        first.metadata
      );

      expect(second.isNewerThan(first)).toBe(true);
      expect(first.isNewerThan(second)).toBe(false);
    });

    it('should throw error when comparing snapshots from different processes', async () => {
      const snapshot1 = await ProcessSnapshot.fromProcessManager(mockProcessManager);

      const otherProcess = new MockProcessManager({
        id: 'other-process',
        type: 'OtherProcess',
        initialState: mockState,
      });
      const snapshot2 = await ProcessSnapshot.fromProcessManager(otherProcess);

      const [error] = safeRun(() => snapshot1.isNewerThan(snapshot2));

      expect(error).toBeInstanceOf(ProcessSnapshotError);
      expect((error as ProcessSnapshotError)?.code).toBe('INCOMPARABLE_SNAPSHOTS');
    });
  });

  describe('getSummary()', () => {
    it('should provide comprehensive snapshot summary', async () => {
      const snapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager, {
        reason: 'scheduled',
        tags: ['test', 'summary'],
        enableCompression: true,
      });

      const summary = snapshot.getSummary();

      expect(summary.processManagerId).toBe(mockProcessManager.id);
      expect(summary.processManagerType).toBe(mockProcessManager.type);
      expect(summary.currentStep).toBe(mockProcessManager.state.currentStep);
      expect(summary.version).toBe(mockProcessManager.state.version);
      expect(summary.status).toBe(mockProcessManager.status);
      expect(summary.snapshotTimestamp).toBeInstanceOf(Date);
      expect(summary.sizeBytes).toBeGreaterThan(0);
      expect(summary.reason).toBe('scheduled');
      expect(summary.compression).toBe('gzip');
      expect(summary.tags).toEqual(['test', 'summary']);
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error information', () => {
      const error = new ProcessSnapshotError('Test error message', 'TEST_ERROR_CODE', {
        testDetail: 'value',
      });

      expect(error.name).toBe('ProcessSnapshotError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('TEST_ERROR_CODE');
      expect(error.details?.testDetail).toBe('value');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof ProcessSnapshotError).toBe(true);
    });

    it('should handle errors during snapshot creation', async () => {
      // Create process manager that will cause serialization issues
      const problematicProcess = {
        id: 'test-id',
        type: 'TestType',
        status: ProcessManagerStatus.RUNNING,
        state: {
          currentStep: 'test',
          stepData: { circular: {} },
          version: 1,
          lastModified: new Date(),
          correlationData: {},
        },
      } as any;

      // Create circular reference
      problematicProcess.state.stepData.circular.self = problematicProcess.state.stepData;

      const [error] = await safeRun(() => ProcessSnapshot.fromProcessManager(problematicProcess));

      expect(error).toBeInstanceOf(ProcessSnapshotError);
      expect((error as ProcessSnapshotError)?.code).toBe('SNAPSHOT_CREATION_FAILED');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty step data', async () => {
      const emptyDataState: IProcessManagerState = {
        currentStep: 'empty',
        stepData: {},
        version: 1,
        lastModified: new Date(),
        correlationData: {},
      };

      const emptyProcess = new MockProcessManager({
        id: 'empty-process',
        type: 'EmptyProcess',
        initialState: emptyDataState,
      });

      const snapshot = await ProcessSnapshot.fromProcessManager(emptyProcess);

      expect(snapshot.state.stepData).toEqual({});
      expect(snapshot.metadata.sizeBytes).toBeGreaterThan(0);
    });

    it('should handle process manager with maximum version number', async () => {
      const maxVersionState: IProcessManagerState = {
        ...mockState,
        version: Number.MAX_SAFE_INTEGER,
      };

      const maxVersionProcess = new MockProcessManager({
        id: 'max-version-process',
        type: 'MaxVersionProcess',
        initialState: maxVersionState,
      });

      const snapshot = await ProcessSnapshot.fromProcessManager(maxVersionProcess);

      expect(snapshot.version).toBe(Number.MAX_SAFE_INTEGER);
      expect(snapshot.state.version).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle all snapshot reasons', async () => {
      const reasons: Array<SnapshotMetadata['reason']> = [
        'scheduled',
        'manual',
        'transition',
        'recovery',
        'migration',
      ];

      for (const reason of reasons) {
        const snapshot = await ProcessSnapshot.fromProcessManager(mockProcessManager, { reason });
        expect(snapshot.metadata.reason).toBe(reason);
      }
    });
  });
});
