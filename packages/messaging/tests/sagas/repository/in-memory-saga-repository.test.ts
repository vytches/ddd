import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemorySagaRepository } from '../../../src/sagas/repository';
import type {
  ISaga,
  ISagaState,
  ISagaQuery,
  ISagaRepositoryConfig,
} from '../../../src/sagas/interfaces';
import { SagaStatus, SagaConcurrencyError, SagaNotFoundError } from '../../../src/sagas/interfaces';

// Mock logger
vi.mock('@vytches-ddd/logging', () => ({
  Logger: {
    forContext: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Mock saga implementation
const createMockSaga = (overrides: Partial<ISaga> = {}): ISaga => ({
  sagaId: 'saga-123',
  sagaType: 'TestSaga',
  status: SagaStatus.STARTED,
  state: {
    sagaId: 'saga-123',
    sagaType: 'TestSaga',
    status: SagaStatus.STARTED,
    currentStep: 'initial',
    stepData: {},
    compensationData: {},
    correlationId: 'corr-123',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    timeoutAt: undefined,
    version: 1,
  },
  handleEvent: vi.fn(),
  compensate: vi.fn(),
  canHandle: vi.fn(),
  getCorrelationData: vi.fn().mockReturnValue({ correlationId: 'corr-123' }),
  ...overrides,
});

describe('InMemorySagaRepository', () => {
  let repository: InMemorySagaRepository;
  let mockLogger: any;

  beforeEach(() => {
    repository = new InMemorySagaRepository();
    mockLogger = (repository as any).logger;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const config = (repository as any).config;
      expect(config.enableOptimisticLocking).toBe(true);
      expect(config.enableAuditLog).toBe(true);
      expect(config.retentionPolicy.completedAfterDays).toBe(30);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<ISagaRepositoryConfig> = {
        enableOptimisticLocking: false,
        enableAuditLog: false,
        retentionPolicy: {
          completedAfterDays: 7,
          compensatedAfterDays: 14,
          failedAfterDays: 30,
        },
      };

      const customRepo = new InMemorySagaRepository(customConfig);
      const config = (customRepo as any).config;

      expect(config.enableOptimisticLocking).toBe(false);
      expect(config.enableAuditLog).toBe(false);
      expect(config.retentionPolicy.completedAfterDays).toBe(7);
    });
  });

  describe('save', () => {
    it('should save saga successfully', async () => {
      const saga = createMockSaga();
      await repository.save(saga);

      const retrieved = await repository.findById('saga-123');
      expect(retrieved).toBe(saga);
    });

    it('should update correlation index', async () => {
      const saga = createMockSaga();
      await repository.save(saga);

      const found = await repository.findByCorrelation({ correlationId: 'corr-123' });
      expect(found).toContain(saga);
    });

    it('should update type/status index', async () => {
      const saga = createMockSaga();
      await repository.save(saga);

      const found = await repository.findByTypeAndStatus('TestSaga', SagaStatus.STARTED);
      expect(found).toContain(saga);
    });

    it('should handle optimistic concurrency control', async () => {
      const saga1 = createMockSaga();
      await repository.save(saga1);

      // Try to save with same version
      const saga2 = createMockSaga({
        state: { ...saga1.state, version: 1 },
      });

      await expect(repository.save(saga2)).rejects.toThrow(SagaConcurrencyError);
    });

    it('should allow save when optimistic locking disabled', async () => {
      const repo = new InMemorySagaRepository({ enableOptimisticLocking: false });
      const saga1 = createMockSaga();
      await repo.save(saga1);

      const saga2 = createMockSaga({
        state: { ...saga1.state, version: 1 },
      });

      await expect(repo.save(saga2)).resolves.toBeUndefined();
    });

    it('should log audit trail when enabled', async () => {
      const saga = createMockSaga();
      await repository.save(saga);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Saga saved',
        expect.objectContaining({
          sagaId: 'saga-123',
          sagaType: 'TestSaga',
          status: SagaStatus.STARTED,
        })
      );
    });
  });

  describe('findById', () => {
    it('should find saga by ID', async () => {
      const saga = createMockSaga();
      await repository.save(saga);

      const found = await repository.findById('saga-123');
      expect(found).toBe(saga);
    });

    it('should return null when saga not found', async () => {
      const found = await repository.findById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('findByCorrelation', () => {
    it('should find sagas by correlation data', async () => {
      const saga1 = createMockSaga({
        sagaId: 'saga-1',
        getCorrelationData: vi.fn().mockReturnValue({
          correlationId: 'corr-123',
          orderId: 'order-456',
        }),
      });
      const saga2 = createMockSaga({
        sagaId: 'saga-2',
        getCorrelationData: vi.fn().mockReturnValue({
          correlationId: 'corr-123',
          orderId: 'order-456',
        }),
      });
      const saga3 = createMockSaga({
        sagaId: 'saga-3',
        getCorrelationData: vi.fn().mockReturnValue({
          correlationId: 'corr-999',
          orderId: 'order-999',
        }),
      });

      await repository.save(saga1);
      await repository.save(saga2);
      await repository.save(saga3);

      const found = await repository.findByCorrelation({
        correlationId: 'corr-123',
        orderId: 'order-456',
      });

      expect(found).toHaveLength(2);
      expect(found).toContain(saga1);
      expect(found).toContain(saga2);
      expect(found).not.toContain(saga3);
    });

    it('should return empty array when no matches', async () => {
      const found = await repository.findByCorrelation({
        correlationId: 'non-existent',
      });

      expect(found).toEqual([]);
    });
  });

  describe('findByTypeAndStatus', () => {
    it('should find sagas by type and status', async () => {
      const saga1 = createMockSaga({ sagaId: 'saga-1', status: SagaStatus.STARTED });
      const saga2 = createMockSaga({
        sagaId: 'saga-2',
        status: SagaStatus.COMPLETED,
        state: { ...saga1.state, sagaId: 'saga-2', status: SagaStatus.COMPLETED },
      });
      const saga3 = createMockSaga({
        sagaId: 'saga-3',
        sagaType: 'OtherSaga',
        state: { ...saga1.state, sagaId: 'saga-3', sagaType: 'OtherSaga' },
      });

      await repository.save(saga1);
      await repository.save(saga2);
      await repository.save(saga3);

      const foundByType = await repository.findByTypeAndStatus('TestSaga');
      expect(foundByType).toHaveLength(2);
      expect(foundByType).toContain(saga1);
      expect(foundByType).toContain(saga2);

      const foundByTypeAndStatus = await repository.findByTypeAndStatus(
        'TestSaga',
        SagaStatus.STARTED
      );
      expect(foundByTypeAndStatus).toHaveLength(1);
      expect(foundByTypeAndStatus).toContain(saga1);
    });
  });

  describe('findTimedOut', () => {
    it('should find timed out sagas', async () => {
      const now = new Date();
      const pastTime = new Date(now.getTime() - 10000); // 10 seconds ago
      const futureTime = new Date(now.getTime() + 10000); // 10 seconds future

      const timedOutSaga = createMockSaga({
        sagaId: 'timeout-1',
        state: {
          ...createMockSaga().state,
          sagaId: 'timeout-1',
          status: SagaStatus.EXECUTING,
          timeoutAt: pastTime,
        },
      });

      const notTimedOutSaga = createMockSaga({
        sagaId: 'timeout-2',
        state: {
          ...createMockSaga().state,
          sagaId: 'timeout-2',
          status: SagaStatus.EXECUTING,
          timeoutAt: futureTime,
        },
      });

      const completedSaga = createMockSaga({
        sagaId: 'timeout-3',
        state: {
          ...createMockSaga().state,
          sagaId: 'timeout-3',
          status: SagaStatus.COMPLETED,
          timeoutAt: pastTime, // Should not be considered timed out
        },
      });

      await repository.save(timedOutSaga);
      await repository.save(notTimedOutSaga);
      await repository.save(completedSaga);

      const timedOut = await repository.findTimedOut();

      expect(timedOut).toHaveLength(1);
      expect(timedOut[0]!.sagaId).toBe('timeout-1');
    });

    it('should respect beforeDate parameter', async () => {
      const checkDate = new Date('2024-01-01');
      const beforeDate = new Date('2023-12-31');
      const afterDate = new Date('2024-01-02');

      const saga = createMockSaga({
        state: {
          ...createMockSaga().state,
          status: SagaStatus.WAITING,
          timeoutAt: beforeDate,
        },
      });

      await repository.save(saga);

      const timedOut = await repository.findTimedOut(checkDate);
      expect(timedOut).toHaveLength(1);

      const notTimedOut = await repository.findTimedOut(beforeDate);
      expect(notTimedOut).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('should remove saga', async () => {
      const saga = createMockSaga();
      await repository.save(saga);

      await repository.remove('saga-123');

      const found = await repository.findById('saga-123');
      expect(found).toBeNull();
    });

    it('should remove from indexes', async () => {
      const saga = createMockSaga();
      await repository.save(saga);

      await repository.remove('saga-123');

      const foundByCorrelation = await repository.findByCorrelation({ correlationId: 'corr-123' });
      expect(foundByCorrelation).toHaveLength(0);

      const foundByType = await repository.findByTypeAndStatus('TestSaga');
      expect(foundByType).toHaveLength(0);
    });

    it('should throw error when saga not found', async () => {
      await expect(repository.remove('non-existent')).rejects.toThrow(SagaNotFoundError);
    });
  });

  describe('count', () => {
    it('should count sagas by type', async () => {
      const saga1 = createMockSaga({ sagaId: 'saga-1' });
      const saga2 = createMockSaga({ sagaId: 'saga-2' });
      const saga3 = createMockSaga({
        sagaId: 'saga-3',
        sagaType: 'OtherSaga',
        state: { ...saga1.state, sagaId: 'saga-3', sagaType: 'OtherSaga' },
      });

      await repository.save(saga1);
      await repository.save(saga2);
      await repository.save(saga3);

      const count = await repository.count('TestSaga');
      expect(count).toBe(2);
    });

    it('should count sagas by type and status', async () => {
      const saga1 = createMockSaga({ sagaId: 'saga-1', status: SagaStatus.STARTED });
      const saga2 = createMockSaga({
        sagaId: 'saga-2',
        status: SagaStatus.COMPLETED,
        state: { ...saga1.state, sagaId: 'saga-2', status: SagaStatus.COMPLETED },
      });

      await repository.save(saga1);
      await repository.save(saga2);

      const count = await repository.count('TestSaga', SagaStatus.STARTED);
      expect(count).toBe(1);
    });
  });

  describe('updateState', () => {
    it('should update saga state', async () => {
      const saga = createMockSaga();
      await repository.save(saga);

      await repository.updateState(
        'saga-123',
        {
          status: SagaStatus.EXECUTING,
          currentStep: 'processPayment',
        },
        1
      );

      const updated = await repository.findById('saga-123');
      expect(updated?.state.status).toBe(SagaStatus.EXECUTING);
      expect(updated?.state.currentStep).toBe('processPayment');
      expect(updated?.state.version).toBe(2);
    });

    it('should throw concurrency error on version mismatch', async () => {
      const saga = createMockSaga();
      await repository.save(saga);

      await expect(
        repository.updateState(
          'saga-123',
          { status: SagaStatus.EXECUTING },
          0 // Wrong version
        )
      ).rejects.toThrow(SagaConcurrencyError);
    });

    it('should throw error when saga not found', async () => {
      await expect(
        repository.updateState('non-existent', { status: SagaStatus.EXECUTING }, 1)
      ).rejects.toThrow(SagaNotFoundError);
    });

    it('should update indexes after state change', async () => {
      const saga = createMockSaga();
      await repository.save(saga);

      await repository.updateState('saga-123', { status: SagaStatus.COMPLETED }, 1);

      const foundStarted = await repository.findByTypeAndStatus('TestSaga', SagaStatus.STARTED);
      expect(foundStarted).toHaveLength(0);

      const foundCompleted = await repository.findByTypeAndStatus('TestSaga', SagaStatus.COMPLETED);
      expect(foundCompleted).toHaveLength(1);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Add test data
      const saga1 = createMockSaga({
        sagaId: 'saga-1',
        state: {
          ...createMockSaga().state,
          sagaId: 'saga-1',
          status: SagaStatus.STARTED,
          currentStep: 'step1',
          createdAt: new Date('2024-01-01'),
          metadata: { region: 'US' },
        },
      });

      const saga2 = createMockSaga({
        sagaId: 'saga-2',
        state: {
          ...createMockSaga().state,
          sagaId: 'saga-2',
          sagaType: 'OrderSaga',
          status: SagaStatus.COMPLETED,
          currentStep: 'step2',
          createdAt: new Date('2024-01-02'),
          metadata: { region: 'EU' },
        },
      });

      const saga3 = createMockSaga({
        sagaId: 'saga-3',
        state: {
          ...createMockSaga().state,
          sagaId: 'saga-3',
          status: SagaStatus.FAILED,
          currentStep: 'step1',
          createdAt: new Date('2024-01-03'),
          metadata: { region: 'US' },
        },
      });

      await repository.save(saga1);
      await repository.save(saga2);
      await repository.save(saga3);
    });

    it('should query by saga type', async () => {
      const result = await repository.query({ sagaType: 'TestSaga' });
      expect(result.totalCount).toBe(2);
      expect(result.sagas).toHaveLength(2);
    });

    it('should query by status', async () => {
      const result = await repository.query({ status: SagaStatus.COMPLETED });
      expect(result.totalCount).toBe(1);
      expect(result.sagas[0]!.sagaId).toBe('saga-2');
    });

    it('should query by multiple statuses', async () => {
      const result = await repository.query({
        status: [SagaStatus.STARTED, SagaStatus.FAILED],
      });
      expect(result.totalCount).toBe(2);
    });

    it('should query by current step', async () => {
      const result = await repository.query({ currentStep: 'step1' });
      expect(result.totalCount).toBe(2);
    });

    it('should query by date range', async () => {
      const result = await repository.query({
        createdBetween: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-02'),
        },
      });
      expect(result.totalCount).toBe(2);
    });

    it('should query by metadata', async () => {
      const result = await repository.query({
        metadata: { region: 'US' },
      });
      expect(result.totalCount).toBe(2);
    });

    it('should apply sorting', async () => {
      const result = await repository.query({
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.sagas[0]!.sagaId).toBe('saga-3');
      expect(result.sagas[1]!.sagaId).toBe('saga-2');
      expect(result.sagas[2]!.sagaId).toBe('saga-1');
    });

    it('should apply pagination', async () => {
      const result = await repository.query({
        limit: 2,
        offset: 1,
      });

      expect(result.sagas).toHaveLength(2);
      expect(result.totalCount).toBe(3);
      expect(result.hasMore).toBe(false);
    });

    it('should indicate hasMore correctly', async () => {
      const result = await repository.query({
        limit: 2,
        offset: 0,
      });

      expect(result.hasMore).toBe(true);
    });

    it('should include metadata in result', async () => {
      const query: ISagaQuery = { sagaType: 'TestSaga' };
      const result = await repository.query(query);

      expect(result.metadata).toMatchObject({
        executionTime: expect.any(Number),
        query,
        timestamp: expect.any(Date),
      });
    });
  });

  describe('index management', () => {
    it('should maintain correlation index correctly', async () => {
      const testRepo = new InMemorySagaRepository({ enableOptimisticLocking: false });
      const saga1 = createMockSaga({
        sagaId: 'saga-1',
        getCorrelationData: vi.fn().mockReturnValue({
          correlationId: 'corr-123',
          orderId: 'order-456',
        }),
      });

      await testRepo.save(saga1);

      // Update correlation data
      saga1.getCorrelationData = vi.fn().mockReturnValue({
        correlationId: 'corr-999',
        orderId: 'order-999',
      });

      await testRepo.save(saga1);

      // Should find by new correlation
      const foundNew = await testRepo.findByCorrelation({
        correlationId: 'corr-999',
        orderId: 'order-999',
      });
      expect(foundNew).toContain(saga1);

      // Should NOT find by old correlation (limitation: old correlations are lost)
      const foundOld = await testRepo.findByCorrelation({
        correlationId: 'corr-123',
        orderId: 'order-456',
      });
      expect(foundOld).toHaveLength(0); // Known limitation: old correlations are lost when correlation data changes
    });
  });
});
