import { Logger } from '@vytches/ddd-logging';
import type {
  ISaga,
  ISagaQuery,
  ISagaQueryResult,
  ISagaRepository,
  ISagaRepositoryConfig,
  ISagaState,
} from '../interfaces';
import { SagaConcurrencyError, SagaNotFoundError, SagaStatus } from '../interfaces';

export class InMemorySagaRepository implements ISagaRepository {
  private readonly logger: ReturnType<typeof Logger.forContext>;
  private readonly sagas: Map<string, ISaga> = new Map();
  private readonly correlationIndex: Map<string, Set<string>> = new Map();
  private readonly typeStatusIndex: Map<string, Set<string>> = new Map();
  private readonly config: Required<ISagaRepositoryConfig> & {
    retentionPolicy: {
      completedAfterDays: number;
      compensatedAfterDays: number;
      failedAfterDays: number;
    };
    serialization: {
      dateFormat: string;
      excludeProperties: string[];
      includePrivateProperties: boolean;
    };
  };

  constructor(config: Partial<ISagaRepositoryConfig> = {}) {
    this.logger = Logger.forContext('InMemorySagaRepository');
    this.config = {
      connection: config.connection || 'in-memory',
      maxConnections: config.maxConnections ?? 1,
      connectionTimeout: config.connectionTimeout ?? 5000,
      queryTimeout: config.queryTimeout ?? 10000,
      enableOptimisticLocking: config.enableOptimisticLocking ?? true,
      enableEncryption: config.enableEncryption ?? false,
      encryptionKey: config.encryptionKey || '',
      enableAuditLog: config.enableAuditLog ?? true,
      retentionPolicy: {
        completedAfterDays: config.retentionPolicy?.completedAfterDays ?? 30,
        compensatedAfterDays: config.retentionPolicy?.compensatedAfterDays ?? 60,
        failedAfterDays: config.retentionPolicy?.failedAfterDays ?? 90,
      },
      serialization: {
        dateFormat: config.serialization?.dateFormat ?? 'ISO',
        excludeProperties: config.serialization?.excludeProperties ?? [],
        includePrivateProperties: config.serialization?.includePrivateProperties ?? false,
      },
    };

    this.logger.info('InMemorySagaRepository initialized', {
      enableOptimisticLocking: this.config.enableOptimisticLocking,
      enableAuditLog: this.config.enableAuditLog,
      retentionPolicy: this.config.retentionPolicy,
    });
  }

  /**
   * Save saga state to persistence store
   * @param saga - Saga instance to save
   * @throws ConcurrencyError if version conflict detected
   */
  async save(saga: ISaga): Promise<void> {
    const sagaId = saga.sagaId;
    const currentState = saga.state;

    this.logger.debug('Saving saga', {
      sagaId,
      sagaType: currentState.sagaType,
      status: currentState.status,
      version: currentState.version,
    });

    try {
      // Check for optimistic concurrency conflicts
      if (this.config.enableOptimisticLocking) {
        const existingSaga = this.sagas.get(sagaId);
        if (existingSaga && existingSaga.state.version >= currentState.version) {
          throw new SagaConcurrencyError(sagaId, currentState.version, existingSaga.state.version);
        }
      }

      // Store saga
      this.sagas.set(sagaId, saga);

      // Update correlation index
      this.updateCorrelationIndex(saga);

      // Update type/status index
      this.updateTypeStatusIndex(saga);

      // Log audit trail if enabled
      if (this.config.enableAuditLog) {
        this.logger.info('Saga saved', {
          sagaId,
          sagaType: currentState.sagaType,
          status: currentState.status,
          version: currentState.version,
          currentStep: currentState.currentStep,
          correlationId: currentState.correlationId,
        });
      }
    } catch (error) {
      this.logger.error('Failed to save saga', error instanceof Error ? error : undefined, {
        saga_id: sagaId,
        error_message: error instanceof Error ? error.message : String(error),
        error_stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Find saga by its unique identifier
   * @param sagaId - Unique saga identifier
   * @returns Saga instance or null if not found
   */
  async findById(sagaId: string): Promise<ISaga | null> {
    this.logger.debug('Finding saga by ID', { sagaId });

    const saga = this.sagas.get(sagaId);
    if (!saga) {
      this.logger.debug('Saga not found', { sagaId });
      return null;
    }

    this.logger.debug('Saga found', {
      sagaId,
      sagaType: saga.state.sagaType,
      status: saga.state.status,
    });

    return saga;
  }

  /**
   * Find sagas by correlation data
   * @param correlationData - Correlation criteria
   * @returns Array of matching saga instances
   */
  async findByCorrelation(correlationData: Record<string, unknown>): Promise<ISaga[]> {
    this.logger.debug('Finding sagas by correlation', { correlationData });

    const correlationKey = this.createCorrelationKey(correlationData);
    const sagaIds = this.correlationIndex.get(correlationKey) || new Set();

    const matchingSagas: ISaga[] = [];
    for (const sagaId of sagaIds) {
      const saga = this.sagas.get(sagaId);
      if (saga && this.matchesCorrelation(saga, correlationData)) {
        matchingSagas.push(saga);
      }
    }

    this.logger.debug('Sagas found by correlation', {
      correlationKey,
      matchingCount: matchingSagas.length,
    });

    return matchingSagas;
  }

  /**
   * Find sagas by type and status
   * @param sagaType - Type of saga to find
   * @param status - Status filter (optional)
   * @returns Array of matching saga instances
   */
  async findByTypeAndStatus(sagaType: string, status?: string): Promise<ISaga[]> {
    this.logger.debug('Finding sagas by type and status', { sagaType, status });

    const indexKey = this.createTypeStatusKey(sagaType, status);
    const sagaIds = this.typeStatusIndex.get(indexKey) || new Set();

    const matchingSagas: ISaga[] = [];
    for (const sagaId of sagaIds) {
      const saga = this.sagas.get(sagaId);
      if (saga) {
        if (!status || saga.state.status === status) {
          matchingSagas.push(saga);
        }
      }
    }

    this.logger.debug('Sagas found by type and status', {
      sagaType,
      status,
      matchingCount: matchingSagas.length,
    });

    return matchingSagas;
  }

  /**
   * Find sagas that have timed out
   * @param beforeDate - Find sagas that timed out before this date
   * @returns Array of timed out saga instances
   */
  async findTimedOut(beforeDate: Date = new Date()): Promise<ISaga[]> {
    this.logger.debug('Finding timed out sagas', { beforeDate });

    const timedOutSagas: ISaga[] = [];

    for (const saga of this.sagas.values()) {
      const state = saga.state;
      if (state.timeoutAt && state.timeoutAt < beforeDate) {
        // Only consider active sagas as timed out
        if (
          state.status === SagaStatus.STARTED ||
          state.status === SagaStatus.EXECUTING ||
          state.status === SagaStatus.WAITING
        ) {
          timedOutSagas.push(saga);
        }
      }
    }

    this.logger.debug('Timed out sagas found', {
      beforeDate,
      timedOutCount: timedOutSagas.length,
    });

    return timedOutSagas;
  }

  /**
   * Remove saga from persistence store
   * @param sagaId - Unique saga identifier
   */
  async remove(sagaId: string): Promise<void> {
    this.logger.debug('Removing saga', { sagaId });

    const saga = this.sagas.get(sagaId);
    if (!saga) {
      throw new SagaNotFoundError(sagaId);
    }

    // Remove from main storage
    this.sagas.delete(sagaId);

    // Remove from indexes
    this.removeFromCorrelationIndex(saga);
    this.removeFromTypeStatusIndex(saga);

    if (this.config.enableAuditLog) {
      this.logger.info('Saga removed', {
        sagaId,
        sagaType: saga.state.sagaType,
        status: saga.state.status,
      });
    }
  }

  /**
   * Get total count of sagas by type
   * @param sagaType - Type of saga to count
   * @param status - Status filter (optional)
   * @returns Number of matching sagas
   */
  async count(sagaType: string, status?: string): Promise<number> {
    const sagas = await this.findByTypeAndStatus(sagaType, status);
    const count = sagas.length;

    this.logger.debug('Saga count', { sagaType, status, count });

    return count;
  }

  /**
   * Update saga state directly (for advanced scenarios)
   * @param sagaId - Unique saga identifier
   * @param updateData - Partial state to update
   * @param expectedVersion - Expected version for optimistic locking
   * @throws ConcurrencyError if version conflict detected
   */
  async updateState(
    sagaId: string,
    updateData: Partial<ISagaState>,
    expectedVersion: number
  ): Promise<void> {
    this.logger.debug('Updating saga state directly', {
      sagaId,
      expectedVersion,
      updateFields: Object.keys(updateData),
    });

    const saga = this.sagas.get(sagaId);
    if (!saga) {
      throw new SagaNotFoundError(sagaId);
    }

    // Check optimistic concurrency
    if (this.config.enableOptimisticLocking && saga.state.version !== expectedVersion) {
      throw new SagaConcurrencyError(sagaId, expectedVersion, saga.state.version);
    }

    // Create updated state with proper versioning
    const updatedState: ISagaState = {
      ...saga.state,
      ...updateData,
      version: saga.state.version + 1,
      updatedAt: new Date(),
    };

    // Create a new saga instance with updated state (enterprise pattern)
    // This maintains immutability principles and proper state management
    const updatedSaga = Object.create(Object.getPrototypeOf(saga));
    Object.assign(updatedSaga, saga);
    Object.defineProperty(updatedSaga, 'state', {
      value: updatedState,
      writable: false,
      enumerable: true,
      configurable: false,
    });

    // Replace the saga in storage with the updated instance
    this.sagas.set(sagaId, updatedSaga);

    // Update indexes
    this.updateCorrelationIndex(updatedSaga);
    this.updateTypeStatusIndex(updatedSaga);

    if (this.config.enableAuditLog) {
      this.logger.info('Saga state updated directly', {
        sagaId,
        oldVersion: expectedVersion,
        newVersion: updatedState.version,
        updateFields: Object.keys(updateData),
      });
    }
  }

  /**
   * Query sagas with advanced criteria
   * @param query - Query criteria
   * @returns Query result with sagas and metadata
   */
  async query(query: ISagaQuery): Promise<ISagaQueryResult> {
    const startTime = Date.now();

    this.logger.debug('Executing saga query', { query });

    let matchingSagas = Array.from(this.sagas.values());

    // Apply filters
    if (query.sagaType) {
      matchingSagas = matchingSagas.filter(saga => saga.state.sagaType === query.sagaType);
    }

    if (query.status) {
      const statusFilter = Array.isArray(query.status) ? query.status : [query.status];
      matchingSagas = matchingSagas.filter(saga => statusFilter.includes(saga.state.status));
    }

    if (query.currentStep) {
      matchingSagas = matchingSagas.filter(saga => saga.state.currentStep === query.currentStep);
    }

    if (query.createdBetween) {
      const { start, end } = query.createdBetween;
      matchingSagas = matchingSagas.filter(
        saga => saga.state.createdAt >= start && saga.state.createdAt <= end
      );
    }

    if (query.updatedBetween) {
      const { start, end } = query.updatedBetween;
      matchingSagas = matchingSagas.filter(
        saga => saga.state.updatedAt >= start && saga.state.updatedAt <= end
      );
    }

    if (query.correlationData) {
      matchingSagas = matchingSagas.filter(saga =>
        this.matchesCorrelation(saga, query.correlationData!)
      );
    }

    if (query.metadata) {
      matchingSagas = matchingSagas.filter(saga => this.matchesMetadata(saga, query.metadata!));
    }

    const totalCount = matchingSagas.length;

    // Apply sorting
    if (query.sortBy) {
      const sortOrder = query.sortOrder || 'asc';
      matchingSagas.sort((a, b) => {
        const aValue = this.getSortValue(a, query.sortBy!);
        const bValue = this.getSortValue(b, query.sortBy!);

        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || totalCount;
    const paginatedSagas = matchingSagas.slice(offset, offset + limit);

    const executionTime = Date.now() - startTime;

    const result: ISagaQueryResult = {
      sagas: paginatedSagas,
      totalCount,
      hasMore: offset + limit < totalCount,
      metadata: {
        executionTime,
        query,
        timestamp: new Date(),
      },
    };

    this.logger.debug('Saga query completed', {
      totalCount,
      returnedCount: paginatedSagas.length,
      executionTime,
      hasMore: result.hasMore,
    });

    return result;
  }

  /**
   * Update correlation index for a saga
   * @param saga - Saga instance
   */
  private updateCorrelationIndex(saga: ISaga): void {
    const correlationData = saga.getCorrelationData();
    const correlationKey = this.createCorrelationKey(correlationData);

    if (!this.correlationIndex.has(correlationKey)) {
      this.correlationIndex.set(correlationKey, new Set());
    }

    this.correlationIndex.get(correlationKey)!.add(saga.sagaId);
  }

  /**
   * Update type/status index for a saga
   * @param saga - Saga instance
   */
  private updateTypeStatusIndex(saga: ISaga): void {
    const typeKey = this.createTypeStatusKey(saga.state.sagaType);
    const typeStatusKey = this.createTypeStatusKey(saga.state.sagaType, saga.state.status);

    // Update type index
    if (!this.typeStatusIndex.has(typeKey)) {
      this.typeStatusIndex.set(typeKey, new Set());
    }
    this.typeStatusIndex.get(typeKey)!.add(saga.sagaId);

    // Update type+status index
    if (!this.typeStatusIndex.has(typeStatusKey)) {
      this.typeStatusIndex.set(typeStatusKey, new Set());
    }
    this.typeStatusIndex.get(typeStatusKey)!.add(saga.sagaId);
  }

  /**
   * Remove saga from correlation index
   * @param saga - Saga instance
   */
  private removeFromCorrelationIndex(saga: ISaga): void {
    const correlationData = saga.getCorrelationData();
    const correlationKey = this.createCorrelationKey(correlationData);

    const sagaIds = this.correlationIndex.get(correlationKey);
    if (sagaIds) {
      sagaIds.delete(saga.sagaId);
      if (sagaIds.size === 0) {
        this.correlationIndex.delete(correlationKey);
      }
    }
  }

  /**
   * Remove saga from type/status index
   * @param saga - Saga instance
   */
  private removeFromTypeStatusIndex(saga: ISaga): void {
    const typeKey = this.createTypeStatusKey(saga.state.sagaType);
    const typeStatusKey = this.createTypeStatusKey(saga.state.sagaType, saga.state.status);

    // Remove from type index
    const typeSagaIds = this.typeStatusIndex.get(typeKey);
    if (typeSagaIds) {
      typeSagaIds.delete(saga.sagaId);
      if (typeSagaIds.size === 0) {
        this.typeStatusIndex.delete(typeKey);
      }
    }

    // Remove from type+status index
    const typeStatusSagaIds = this.typeStatusIndex.get(typeStatusKey);
    if (typeStatusSagaIds) {
      typeStatusSagaIds.delete(saga.sagaId);
      if (typeStatusSagaIds.size === 0) {
        this.typeStatusIndex.delete(typeStatusKey);
      }
    }
  }

  /**
   * Create correlation key from correlation data
   * @param correlationData - Correlation data
   */
  private createCorrelationKey(correlationData: Record<string, unknown>): string {
    const sortedKeys = Object.keys(correlationData).sort();
    const keyParts = sortedKeys.map(key => `${key}:${correlationData[key]}`);
    return keyParts.join('|');
  }

  /**
   * Create type/status index key
   * @param sagaType - Saga type
   * @param status - Saga status (optional)
   */
  private createTypeStatusKey(sagaType: string, status?: string): string {
    return status ? `${sagaType}:${status}` : sagaType;
  }

  /**
   * Check if saga matches correlation criteria
   * @param saga - Saga instance
   * @param correlationData - Correlation criteria
   */
  private matchesCorrelation(saga: ISaga, correlationData: Record<string, unknown>): boolean {
    const sagaCorrelation = saga.getCorrelationData();

    for (const [key, value] of Object.entries(correlationData)) {
      if (sagaCorrelation[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if saga matches metadata criteria
   * @param saga - Saga instance
   * @param metadata - Metadata criteria
   */
  private matchesMetadata(saga: ISaga, metadata: Record<string, unknown>): boolean {
    const sagaMetadata = saga.state.metadata;

    for (const [key, value] of Object.entries(metadata)) {
      if (sagaMetadata[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get sort value for saga
   * @param saga - Saga instance
   * @param sortBy - Property to sort by
   */
  private getSortValue(saga: ISaga, sortBy: string): number | string {
    const state = saga.state;

    switch (sortBy) {
      case 'createdAt':
        return state.createdAt.getTime();
      case 'updatedAt':
        return state.updatedAt.getTime();
      case 'sagaId':
        return state.sagaId;
      case 'sagaType':
        return state.sagaType;
      case 'status':
        return state.status;
      case 'currentStep':
        return state.currentStep;
      default:
        return state.sagaId; // Default sort by ID
    }
  }
}
