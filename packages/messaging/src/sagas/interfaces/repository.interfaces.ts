import type { ISaga, ISagaState } from './saga.interfaces';

export interface ISagaRepository {
  /**
   * Save saga state to persistence store
   * @param saga - Saga instance to save
   * @throws ConcurrencyError if version conflict detected
   */
  save(saga: ISaga): Promise<void>;

  /**
   * Find saga by its unique identifier
   * @param sagaId - Unique saga identifier
   * @returns Saga instance or null if not found
   */
  findById(sagaId: string): Promise<ISaga | null>;

  /**
   * Find sagas by correlation data
   * @param correlationData - Correlation criteria
   * @returns Array of matching saga instances
   */
  findByCorrelation(correlationData: Record<string, unknown>): Promise<ISaga[]>;

  /**
   * Find sagas by type and status
   * @param sagaType - Type of saga to find
   * @param status - Status filter (optional)
   * @returns Array of matching saga instances
   */
  findByTypeAndStatus(sagaType: string, status?: string): Promise<ISaga[]>;

  /**
   * Find sagas that have timed out
   * @param beforeDate - Find sagas that timed out before this date
   * @returns Array of timed out saga instances
   */
  findTimedOut(beforeDate?: Date): Promise<ISaga[]>;

  /**
   * Remove saga from persistence store
   * @param sagaId - Unique saga identifier
   */
  remove(sagaId: string): Promise<void>;

  /**
   * Get total count of sagas by type
   * @param sagaType - Type of saga to count
   * @param status - Status filter (optional)
   * @returns Number of matching sagas
   */
  count(sagaType: string, status?: string): Promise<number>;

  /**
   * Update saga state directly (for advanced scenarios)
   * @param sagaId - Unique saga identifier
   * @param updateData - Partial state to update
   * @param expectedVersion - Expected version for optimistic locking
   * @throws ConcurrencyError if version conflict detected
   */
  updateState(
    sagaId: string,
    updateData: Partial<ISagaState>,
    expectedVersion: number
  ): Promise<void>;

  /**
   * Query sagas with advanced criteria
   * @param query - Query criteria
   * @returns Query result with sagas and metadata
   */
  query(query: ISagaQuery): Promise<ISagaQueryResult>;
}

export interface ISagaQuery {
  /** Saga type filter */
  sagaType?: string;

  /** Status filters */
  status?: string | string[];

  /** Correlation data filters */
  correlationData?: Record<string, unknown>;

  /** Created date range */
  createdBetween?: {
    start: Date;
    end: Date;
  };

  /** Updated date range */
  updatedBetween?: {
    start: Date;
    end: Date;
  };

  /** Step name filter */
  currentStep?: string;

  /** Metadata filters */
  metadata?: Record<string, unknown>;

  /** Pagination */
  offset?: number;
  limit?: number;

  /** Sorting */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ISagaQueryResult {
  /** Array of matching saga instances */
  sagas: ISaga[];

  /** Total count (before pagination) */
  totalCount: number;

  /** Whether there are more results */
  hasMore: boolean;

  /** Query metadata */
  metadata: {
    executionTime: number;
    query: ISagaQuery;
    timestamp: Date;
  };
}

export interface ISagaRepositoryConfig {
  /** Connection string or configuration object */
  connection?: string | object;

  /** Maximum number of connections */
  maxConnections?: number;

  /** Connection timeout (milliseconds) */
  connectionTimeout?: number;

  /** Query timeout (milliseconds) */
  queryTimeout?: number;

  /** Enable optimistic concurrency control */
  enableOptimisticLocking?: boolean;

  /** Enable saga state encryption */
  enableEncryption?: boolean;

  /** Encryption key for saga state */
  encryptionKey?: string;

  /** Enable audit logging */
  enableAuditLog?: boolean;

  /** Retention policy for completed sagas */
  retentionPolicy?: {
    completedAfterDays: number;
    compensatedAfterDays: number;
    failedAfterDays: number;
  };

  /** Custom serialization options */
  serialization?: {
    dateFormat?: string;
    excludeProperties?: string[];
    includePrivateProperties?: boolean;
  };
}

export class SagaConcurrencyError extends Error {
  constructor(
    public readonly sagaId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      `Concurrency conflict for saga ${sagaId}: expected version ${expectedVersion}, actual version ${actualVersion}`
    );
    this.name = 'SagaConcurrencyError';
  }
}

export class SagaNotFoundError extends Error {
  constructor(public readonly sagaId: string) {
    super(`Saga with id ${sagaId} not found`);
    this.name = 'SagaNotFoundError';
  }
}

export interface ISagaRepositoryFactory {
  /**
   * Create saga repository with specified configuration
   * @param config - Repository configuration
   * @returns Configured saga repository instance
   */
  createRepository(config: ISagaRepositoryConfig): ISagaRepository;

  /**
   * Get default repository configuration
   * @returns Default configuration object
   */
  getDefaultConfig(): ISagaRepositoryConfig;

  /**
   * Validate repository configuration
   * @param config - Configuration to validate
   * @returns Array of validation errors (empty if valid)
   */
  validateConfig(config: ISagaRepositoryConfig): string[];
}
