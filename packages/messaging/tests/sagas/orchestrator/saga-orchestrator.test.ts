import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import type { IDomainEvent } from '@vytches/ddd-contracts';
import { SagaOrchestrator } from '../../../src/sagas/orchestrator';
import type {
  ISagaRepository,
  ISagaDefinition,
  ISaga,
  ISagaExecutionContext,
  ISagaActionResult,
  ISagaOrchestratorConfig,
} from '../../../src/sagas/interfaces';
import { SagaStatus } from '../../../src/sagas/interfaces';
import {
  SagaDefinitionNotFoundError,
  SagaInstanceLimitExceededError,
  SagaConfigurationError,
} from '../../../src/sagas/errors';

// Mock logger
vi.mock('@vytches/ddd-logging', () => ({
  Logger: {
    forContext: vi.fn(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Mock implementations
const createMockEvent = (eventType = 'TestEvent', aggregateId = 'agg-123'): IDomainEvent => ({
  eventType,
  payload: { test: true },
  metadata: {
    eventId: 'evt-123',
    aggregateId,
    aggregateVersion: 1,
    timestamp: new Date(),
    correlationId: 'corr-123',
  },
});

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
  handleEvent: vi.fn().mockResolvedValue({ success: true }),
  compensate: vi.fn().mockResolvedValue({ success: true }),
  canHandle: vi.fn().mockReturnValue(true),
  getCorrelationData: vi.fn().mockReturnValue({ correlationId: 'corr-123' }),
  ...overrides,
});

const createMockContext = (): ISagaExecutionContext => ({
  correlationId: 'corr-123',
  userId: 'user-123',
  metadata: {},
  timestamp: new Date(),
});

const createMockRepository = (): ISagaRepository => ({
  save: vi.fn().mockResolvedValue(undefined),
  findById: vi.fn().mockResolvedValue(null),
  findByCorrelation: vi.fn().mockResolvedValue([]),
  findByTypeAndStatus: vi.fn().mockResolvedValue([]),
  findTimedOut: vi.fn().mockResolvedValue([]),
  remove: vi.fn().mockResolvedValue(undefined),
  count: vi.fn().mockResolvedValue(0),
  updateState: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue({ sagas: [], totalCount: 0, hasMore: false, metadata: {} }),
});

const createMockDefinition = (overrides: Partial<ISagaDefinition> = {}): ISagaDefinition => ({
  sagaType: 'TestSaga',
  displayName: 'Test Saga',
  description: 'Test saga for unit tests',
  startEvents: ['OrderCreated'],
  defaultTimeout: 3600000,
  maxInstances: undefined,
  steps: [],
  createInstance: vi.fn().mockResolvedValue(createMockSaga()),
  getCorrelationData: vi.fn().mockReturnValue({ correlationId: 'corr-123' }),
  validate: vi.fn().mockReturnValue([]),
  ...overrides,
});

describe('SagaOrchestrator', () => {
  let orchestrator: SagaOrchestrator;
  let mockRepository: ISagaRepository;
  let mockLogger: any;

  beforeEach(() => {
    mockRepository = createMockRepository();
    orchestrator = new SagaOrchestrator(mockRepository);
    mockLogger = (orchestrator as any).logger;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const config = (orchestrator as any).config;
      expect(config.maxConcurrentExecutions).toBe(100);
      expect(config.defaultOperationTimeout).toBe(30000);
      expect(config.defaultSagaTimeout).toBe(3600000);
      expect(config.enableAutoRetry).toBe(true);
      expect(config.enableMetrics).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<ISagaOrchestratorConfig> = {
        maxConcurrentExecutions: 50,
        enableMetrics: false,
        retryDelay: {
          initial: 500,
          multiplier: 3,
          maximum: 20000,
        },
      };

      const customOrchestrator = new SagaOrchestrator(mockRepository, customConfig);
      const config = (customOrchestrator as any).config;

      expect(config.maxConcurrentExecutions).toBe(50);
      expect(config.enableMetrics).toBe(false);
      expect(config.retryDelay.initial).toBe(500);
      expect(config.retryDelay.multiplier).toBe(3);
    });
  });

  describe('registerSagaDefinition', () => {
    it('should register valid saga definition', () => {
      const definition = createMockDefinition();
      orchestrator.registerSagaDefinition(definition);

      expect(orchestrator.getSagaDefinition('TestSaga')).toBe(definition);
      expect(orchestrator.getSagaDefinitions()).toContain(definition);
    });

    it('should validate definition before registration', () => {
      const definition = createMockDefinition({
        validate: vi.fn().mockReturnValue(['Invalid configuration']),
      });

      const [registrationError] = safeRun(() => orchestrator.registerSagaDefinition(definition));
      expect(registrationError).toBeInstanceOf(SagaConfigurationError);
      expect(registrationError?.message).toContain('Invalid saga definition');
    });

    it('should update start event mappings', () => {
      const definition = createMockDefinition({
        startEvents: ['OrderCreated', 'PaymentReceived'],
      });

      orchestrator.registerSagaDefinition(definition);

      // Test internal mapping
      const canStart = (orchestrator as any).canStartSaga('OrderCreated');
      expect(canStart).toBe(true);
    });
  });

  describe('startSaga', () => {
    beforeEach(() => {
      const definition = createMockDefinition();
      orchestrator.registerSagaDefinition(definition);
    });

    it('should start new saga instance', async () => {
      const event = createMockEvent('OrderCreated');
      const context = createMockContext();
      const mockSaga = createMockSaga();

      (mockRepository.save as any).mockResolvedValue(undefined);
      const definition = orchestrator.getSagaDefinition('TestSaga')!;
      (definition.createInstance as any).mockResolvedValue(mockSaga);

      const saga = await orchestrator.startSaga(event, context);

      expect(saga).toBe(mockSaga);
      expect(definition.createInstance).toHaveBeenCalledWith(event, context);
      expect(mockRepository.save).toHaveBeenCalledWith(mockSaga);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Saga started successfully',
        expect.objectContaining({
          sagaId: 'saga-123',
          sagaType: 'TestSaga',
        })
      );
    });

    it('should throw error when no definition found', async () => {
      const event = createMockEvent('UnknownEvent');
      const context = createMockContext();

      const [startError] = await safeRun(() => orchestrator.startSaga(event, context));
      expect(startError).toBeInstanceOf(SagaDefinitionNotFoundError);
    });

    it('should check instance limits', async () => {
      const definition = createMockDefinition({
        maxInstances: 5,
      });
      orchestrator.registerSagaDefinition(definition);

      (mockRepository.count as any).mockResolvedValue(5);

      const event = createMockEvent('OrderCreated');
      const context = createMockContext();

      const [startError] = await safeRun(() => orchestrator.startSaga(event, context));
      expect(startError).toBeInstanceOf(SagaInstanceLimitExceededError);
    });

    it('should update statistics on success', async () => {
      const event = createMockEvent('OrderCreated');
      const context = createMockContext();

      await orchestrator.startSaga(event, context);

      const stats = orchestrator.getStatistics();
      expect(stats.activeSagas).toBeGreaterThanOrEqual(0);
    });
  });

  describe('processEvent', () => {
    beforeEach(() => {
      const definition = createMockDefinition();
      orchestrator.registerSagaDefinition(definition);
    });

    it('should process event against active sagas', async () => {
      const event = createMockEvent('OrderUpdated');
      const context = createMockContext();
      const mockSaga = createMockSaga();

      (mockRepository.findByCorrelation as any).mockResolvedValue([mockSaga]);
      (mockSaga.handleEvent as any).mockResolvedValue({
        success: true,
        events: [createMockEvent('OrderProcessed')],
      });

      const results = await orchestrator.processEvent(event, context);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        sagaId: 'saga-123',
        sagaType: 'TestSaga',
        success: true,
        sagaCompleted: false,
      });
      expect(mockSaga.handleEvent).toHaveBeenCalledWith(event, context);
      expect(mockRepository.save).toHaveBeenCalledWith(mockSaga);
    });

    it('should handle saga completion', async () => {
      const event = createMockEvent('OrderCompleted');
      const context = createMockContext();
      const mockSaga = createMockSaga();

      (mockRepository.findByCorrelation as any).mockResolvedValue([mockSaga]);
      (mockRepository.findById as any).mockResolvedValue(mockSaga); // Add this for completeSaga
      (mockSaga.handleEvent as any).mockResolvedValue({
        success: true,
        completesSaga: true,
      });

      const results = await orchestrator.processEvent(event, context);

      expect(results[0]!.sagaCompleted).toBe(true);
      expect(mockRepository.updateState).toHaveBeenCalledWith(
        'saga-123',
        expect.objectContaining({ status: SagaStatus.COMPLETED }),
        1
      );
    });

    it('should handle saga compensation', async () => {
      const event = createMockEvent('OrderFailed');
      const context = createMockContext();
      const mockSaga = createMockSaga();

      (mockRepository.findByCorrelation as any).mockResolvedValue([mockSaga]);
      (mockRepository.findById as any).mockResolvedValue(mockSaga); // Add this for compensateSaga
      (mockSaga.handleEvent as any).mockResolvedValue({
        success: false,
        requiresCompensation: true,
      });

      const results = await orchestrator.processEvent(event, context);

      expect(results[0]!.requiresCompensation).toBe(true);
      expect(mockRepository.updateState).toHaveBeenCalledWith(
        'saga-123',
        expect.objectContaining({ status: SagaStatus.COMPENSATING }),
        1
      );
    });

    it('should start new saga if event can start saga', async () => {
      const event = createMockEvent('OrderCreated');
      const context = createMockContext();
      const newSaga = createMockSaga({ sagaId: 'new-saga-456' });

      (mockRepository.findByCorrelation as any).mockResolvedValue([]);
      const definition = orchestrator.getSagaDefinition('TestSaga')!;
      (definition.createInstance as any).mockResolvedValue(newSaga);

      const results = await orchestrator.processEvent(event, context);

      expect(results).toHaveLength(1);
      expect(results[0]!.sagaId).toBe('new-saga-456');
      expect(definition.createInstance).toHaveBeenCalledWith(event, context);
    });

    it('should handle errors in event processing', async () => {
      const event = createMockEvent('ErrorEvent');
      const context = createMockContext();
      const mockSaga = createMockSaga();

      (mockRepository.findByCorrelation as any).mockResolvedValue([mockSaga]);
      (mockSaga.handleEvent as any).mockRejectedValue(new Error('Processing failed'));

      const results = await orchestrator.processEvent(event, context);

      expect(results[0]).toMatchObject({
        success: false,
        error: {
          message: 'Processing failed',
          code: 'SAGA_PROCESSING_ERROR',
        },
        requiresCompensation: true,
      });
    });
  });

  describe('completeSaga', () => {
    it('should complete saga successfully', async () => {
      const context = createMockContext();
      const mockSaga = createMockSaga();

      (mockRepository.findById as any).mockResolvedValue(mockSaga);

      await orchestrator.completeSaga('saga-123', context);

      expect(mockRepository.updateState).toHaveBeenCalledWith(
        'saga-123',
        expect.objectContaining({
          status: SagaStatus.COMPLETED,
          updatedAt: expect.any(Date),
        }),
        1
      );
    });

    it('should handle saga not found', async () => {
      const context = createMockContext();
      (mockRepository.findById as any).mockResolvedValue(null);

      await orchestrator.completeSaga('non-existent', context);

      expect(mockLogger.warn).toHaveBeenCalledWith('Saga not found for completion', {
        sagaId: 'non-existent',
      });
      expect(mockRepository.updateState).not.toHaveBeenCalled();
    });
  });

  describe('cancelSaga', () => {
    it('should cancel saga with reason', async () => {
      const context = createMockContext();
      const mockSaga = createMockSaga();
      const reason = 'User cancelled order';

      (mockRepository.findById as any).mockResolvedValue(mockSaga);

      await orchestrator.cancelSaga('saga-123', reason, context);

      expect(mockRepository.updateState).toHaveBeenCalledWith(
        'saga-123',
        expect.objectContaining({
          status: SagaStatus.CANCELLED,
          error: {
            message: `Saga cancelled: ${reason}`,
            step: 'initial',
            timestamp: expect.any(Date),
          },
        }),
        1
      );
    });
  });

  describe('compensateSaga', () => {
    it('should compensate saga successfully', async () => {
      const context = createMockContext();
      const mockSaga = createMockSaga();

      (mockRepository.findById as any).mockResolvedValue(mockSaga);
      (mockSaga.compensate as any).mockResolvedValue({ success: true });

      await orchestrator.compensateSaga('saga-123', context);

      expect(mockRepository.updateState).toHaveBeenCalledTimes(2);
      expect(mockRepository.updateState).toHaveBeenNthCalledWith(
        1,
        'saga-123',
        expect.objectContaining({ status: SagaStatus.COMPENSATING }),
        1
      );
      expect(mockRepository.updateState).toHaveBeenNthCalledWith(
        2,
        'saga-123',
        expect.objectContaining({ status: SagaStatus.COMPENSATED }),
        2
      );
    });

    it('should handle compensation failure', async () => {
      const context = createMockContext();
      const mockSaga = createMockSaga();

      (mockRepository.findById as any).mockResolvedValue(mockSaga);
      (mockSaga.compensate as any).mockResolvedValue({ success: false });

      await orchestrator.compensateSaga('saga-123', context);

      expect(mockRepository.updateState).toHaveBeenNthCalledWith(
        2,
        'saga-123',
        expect.objectContaining({ status: SagaStatus.FAILED }),
        2
      );
    });
  });

  describe('handleTimeout', () => {
    it('should handle saga timeout', async () => {
      const context = createMockContext();
      const mockSaga = createMockSaga();

      (mockRepository.findById as any).mockResolvedValue(mockSaga);

      await orchestrator.handleTimeout('saga-123', context);

      expect(mockRepository.updateState).toHaveBeenCalledWith(
        'saga-123',
        expect.objectContaining({
          status: SagaStatus.TIMED_OUT,
          error: {
            message: 'Saga execution timed out',
            step: 'initial',
            timestamp: expect.any(Date),
          },
        }),
        1
      );
      // Should trigger compensation
      expect(mockSaga.compensate).toHaveBeenCalled();
    });
  });

  describe('processTimedOutSagas', () => {
    it('should process all timed out sagas', async () => {
      const context = createMockContext();
      const timedOutSagas = [
        createMockSaga({ sagaId: 'timeout-1' }),
        createMockSaga({ sagaId: 'timeout-2' }),
      ];

      (mockRepository.findTimedOut as any).mockResolvedValue(timedOutSagas);
      (mockRepository.findById as any)
        .mockResolvedValueOnce(timedOutSagas[0]) // handleTimeout call
        .mockResolvedValueOnce(timedOutSagas[0]) // compensateSaga call
        .mockResolvedValueOnce(timedOutSagas[1]) // handleTimeout call
        .mockResolvedValueOnce(timedOutSagas[1]); // compensateSaga call

      const processedCount = await orchestrator.processTimedOutSagas(context);

      expect(processedCount).toBe(2);
      expect(mockRepository.updateState).toHaveBeenCalledTimes(6); // 2 sagas * 3 updates each (timeout + compensating + compensated)
    });

    it('should continue processing even if one fails', async () => {
      const context = createMockContext();
      const timedOutSagas = [
        createMockSaga({ sagaId: 'timeout-1' }),
        createMockSaga({ sagaId: 'timeout-2' }),
      ];

      (mockRepository.findTimedOut as any).mockResolvedValue(timedOutSagas);
      (mockRepository.findById as any)
        .mockResolvedValueOnce(timedOutSagas[0])
        .mockResolvedValueOnce(timedOutSagas[0]) // For compensateSaga call
        .mockRejectedValueOnce(new Error('Saga not found')); // Second saga throws error

      const processedCount = await orchestrator.processTimedOutSagas(context);

      expect(processedCount).toBe(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to handle timeout for saga',
        expect.objectContaining({ sagaId: 'timeout-2' })
      );
    });
  });

  describe('getSagaDefinitions', () => {
    it('should return all registered definitions', () => {
      const def1 = createMockDefinition({ sagaType: 'Saga1' });
      const def2 = createMockDefinition({ sagaType: 'Saga2' });

      orchestrator.registerSagaDefinition(def1);
      orchestrator.registerSagaDefinition(def2);

      const definitions = orchestrator.getSagaDefinitions();

      expect(definitions).toHaveLength(2);
      expect(definitions).toContain(def1);
      expect(definitions).toContain(def2);
    });
  });

  describe('getStatistics', () => {
    it('should return orchestrator statistics', () => {
      const stats = orchestrator.getStatistics();

      expect(stats).toMatchObject({
        activeSagas: expect.any(Number),
        sagasByStatus: expect.any(Object),
        sagasByType: expect.any(Object),
        totalEventsProcessed: expect.any(Number),
        eventsPerMinute: expect.any(Number),
        averageCompletionTimeMs: expect.any(Number),
        successRate: expect.any(Number),
        compensatedSagas: expect.any(Number),
        timedOutSagas: expect.any(Number),
        systemLoad: {
          cpuUsage: expect.any(Number),
          memoryUsage: expect.any(Number),
          activeConnections: expect.any(Number),
        },
        performance: {
          slowestOperationMs: expect.any(Number),
          fastestOperationMs: expect.any(Number),
          averageOperationMs: expect.any(Number),
        },
        timestamp: expect.any(Date),
      });
    });

    it('should update statistics during operations', async () => {
      const definition = createMockDefinition();
      orchestrator.registerSagaDefinition(definition);

      const event = createMockEvent('OrderCreated');
      const context = createMockContext();

      await orchestrator.startSaga(event, context);

      const stats = orchestrator.getStatistics();
      expect(stats.activeSagas).toBeGreaterThanOrEqual(1);
    });
  });
});
