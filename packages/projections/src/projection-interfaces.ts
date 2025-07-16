/* eslint-disable @typescript-eslint/no-explicit-any */
// projection-interfaces.ts
import type {
  IExtendedDomainEvent,
  Capability,
  CapabilityConstructor,
  IProjectionCapability,
} from '@vytches-ddd/contracts';
import type { ProjectionError } from './projection-errors';

/**
 * @llm-summary Contract for projection functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * Projection interface implementing architectural component for projection operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjection implements IProjection {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjection<TReadModel> {
  readonly name: string;
  readonly eventTypes: string[];

  createInitialState(): TReadModel | Promise<TReadModel>;
  apply(readModel: TReadModel, event: IExtendedDomainEvent): TReadModel | Promise<TReadModel>;
  handles(eventType: string): boolean;
}

/**
 * @llm-summary Contract for projection store functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ProjectionStore interface implementing architectural component for projection store operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionStore implements IProjectionStore {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjectionStore<TReadModel> {
  load(projectionName: string): Promise<TReadModel | null>;
  save(projectionName: string, state: TReadModel): Promise<void>;
  delete(projectionName: string): Promise<void>;
  deleteAll(): Promise<void>;
  exists(projectionName: string): Promise<boolean>;
}

// Re-export from contracts for convenience
export type { IProjectionCapability } from '@vytches-ddd/contracts';

/**
 * @llm-summary Contract for capability context functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * CapabilityContext interface implementing architectural component for capability context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCapabilityContext implements ICapabilityContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ICapabilityContext<TReadModel> {
  getProjectionName(): string;
  getStore(): IProjectionStore<TReadModel>;
  executeHooks(hookName: string, ...args: unknown[]): Promise<void>;
}

// Lifecycle hooks

/**
 * @llm-summary Contract for projection lifecycle capability functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ProjectionLifecycleCapability interface implementing architectural component for projection lifecycle capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionLifecycleCapability implements IProjectionLifecycleCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjectionLifecycleCapability<TReadModel> {
  onBeforeApply?(state: TReadModel, event: IExtendedDomainEvent): Promise<void> | void;
  onAfterApply?(state: TReadModel, event: IExtendedDomainEvent): Promise<void> | void;
  onError?(error: ProjectionError, event?: IExtendedDomainEvent): Promise<void> | void;
}

/**
 * @llm-summary Contract for projection engine functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ProjectionEngine interface implementing architectural component for projection engine operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionEngine implements IProjectionEngine {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjectionEngine<TReadModel> {
  getProjectionName(): string;
  getEventTypes(): string[];
  processEvent(event: IExtendedDomainEvent): Promise<void>;
  isInterestedIn(event: IExtendedDomainEvent): boolean;
  getState(): Promise<TReadModel | null>;
  reset(): Promise<void>;
  addCapability<T extends Capability & IProjectionCapability>(capability: T): this;
  getCapability<T extends Capability & IProjectionCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): T | undefined;
  hasCapability<T extends Capability & IProjectionCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): boolean;
  removeCapability<T extends Capability & IProjectionCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): this;
}

/**
 * @llm-summary Contract for checkpoint projection capability functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * CheckpointProjectionCapability interface implementing architectural component for checkpoint projection capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCheckpointProjectionCapability implements ICheckpointProjectionCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ICheckpointProjectionCapability<TReadModel>
  extends IProjectionLifecycleCapability<TReadModel> {
  saveCheckpoint(state: TReadModel, position: number): Promise<void>;
  loadCheckpoint(): Promise<{ state: TReadModel; position: number } | null>;
}

/**
 * @llm-summary Contract for snapshot projection capability functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * SnapshotProjectionCapability interface implementing architectural component for snapshot projection capability operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSnapshotProjectionCapability implements ISnapshotProjectionCapability {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ISnapshotProjectionCapability<TReadModel>
  extends IProjectionLifecycleCapability<TReadModel> {
  createSnapshot(state: TReadModel, position: number): Promise<void>;
  loadLatestSnapshot(): Promise<{ state: TReadModel; position: number } | null>;
}

/**
 * @llm-summary Contract for projection checkpoint functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ProjectionCheckpoint interface implementing architectural component for projection checkpoint operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionCheckpoint implements IProjectionCheckpoint {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjectionCheckpoint<TState = unknown> {
  projectionName: string;
  position: number;
  state: TState;
  timestamp: Date;
  eventCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * @llm-summary Contract for projection checkpoint store functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ProjectionCheckpointStore interface implementing architectural component for projection checkpoint store operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionCheckpointStore implements IProjectionCheckpointStore {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjectionCheckpointStore {
  save<TState>(
    projectionName: string,
    checkpoint: Omit<IProjectionCheckpoint<TState>, 'projectionName'>
  ): Promise<void>;

  load<TState>(projectionName: string): Promise<IProjectionCheckpoint<TState> | null>;

  delete(projectionName: string): Promise<void>;
}

/**
 * @llm-summary Contract for projection snapshot functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ProjectionSnapshot interface implementing architectural component for projection snapshot operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionSnapshot implements IProjectionSnapshot {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjectionSnapshot<TState = unknown> {
  projectionName: string;
  position: number;
  state: TState;
  timestamp: Date;
  version?: number;
  metadata?: Record<string, unknown>;
}

/**
 * @llm-summary Contract for projection snapshot store functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ProjectionSnapshotStore interface implementing architectural component for projection snapshot store operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionSnapshotStore implements IProjectionSnapshotStore {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjectionSnapshotStore {
  save<TState>(
    projectionName: string,
    snapshot: Omit<IProjectionSnapshot<TState>, 'projectionName'>
  ): Promise<void>;

  load<TState>(projectionName: string): Promise<IProjectionSnapshot<TState> | null>;

  loadLatest<TState>(projectionName: string): Promise<IProjectionSnapshot<TState> | null>;

  delete(projectionName: string): Promise<void>;

  deleteOlderThan(projectionName: string, date: Date): Promise<number>;
}

/**
 * @llm-summary Contract for projection builder functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ProjectionBuilder interface implementing architectural component for projection builder operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionBuilder implements IProjectionBuilder {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjectionBuilder<TReadModel> {
  withCheckpoints(store: IProjectionCheckpointStore, options?: CheckpointProjectionOptions): this;
  withSnapshots(store: IProjectionSnapshotStore, options?: SnapshotProjectionOptions): this;
  withCustomCapability<T extends Capability & IProjectionCapability>(capability: T): this;
  build(): IProjectionEngine<TReadModel>;
}

/**
 * @llm-summary Contract for checkpoint projection options functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * CheckpointProjectionOptions interface implementing architectural component for checkpoint projection options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCheckpointProjectionOptions implements CheckpointProjectionOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CheckpointProjectionOptions {
  interval?: number;
  saveOnRebuildComplete?: boolean;
}

/**
 * @llm-summary Contract for snapshot projection options functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * SnapshotProjectionOptions interface implementing architectural component for snapshot projection options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteSnapshotProjectionOptions implements SnapshotProjectionOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface SnapshotProjectionOptions {
  interval?: number;
  maxSnapshots?: number;
  compressState?: (state: unknown) => unknown;
  decompressState?: (compressed: unknown) => unknown;
}

/**
 * @llm-summary Contract for projection retry config functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ProjectionRetryConfig interface implementing architectural component for projection retry config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionRetryConfig implements IProjectionRetryConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjectionRetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[]; // Error types that should be retried
  nonRetryableErrors: string[]; // Error types that should NOT be retried
}

/**
 * @llm-summary Contract for projection error strategy functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ProjectionErrorStrategy interface implementing architectural component for projection error strategy operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteProjectionErrorStrategy implements IProjectionErrorStrategy {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IProjectionErrorStrategy {
  shouldRetry(error: Error, attempt: number, config?: IProjectionRetryConfig): boolean;
  getRetryDelay(attempt: number, config: IProjectionRetryConfig): number;
  getDelay?(attempt: number, config?: IProjectionRetryConfig): number; // For test compatibility
  isRetryableError(error: Error, config: IProjectionRetryConfig): boolean;
}

/**
 * @llm-summary Contract for dead letter store functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * DeadLetterStore interface implementing architectural component for dead letter store operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDeadLetterStore implements IDeadLetterStore {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IDeadLetterStore {
  store(deadLetter: IDeadLetter): Promise<void>;
  getByProjection(projectionName: string): Promise<IDeadLetter[]>;
  retry(deadLetterId: string): Promise<IExtendedDomainEvent>;
  delete(deadLetterId: string): Promise<void>;
}

/**
 * @llm-summary Contract for dead letter functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * DeadLetter interface implementing architectural component for dead letter operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDeadLetter implements IDeadLetter {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IDeadLetter {
  id: string;
  projectionName: string;
  event: IExtendedDomainEvent;
  error: Error;
  attemptCount: number;
  firstFailedAt: Date;
  lastFailedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * @llm-summary Contract for circuit breaker config functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * CircuitBreakerConfig interface implementing architectural component for circuit breaker config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCircuitBreakerConfig implements ICircuitBreakerConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ICircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

/**
 * @llm-summary Enumeration of circuit state values
 * @llm-domain Architecture
 * @llm-usage Frequent
 *
 * @description
 * CircuitState enum implementing architectural component for circuit state operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: CircuitState = CircuitState.VALUE;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, rejecting requests
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

/**
 * @llm-summary Contract for error projection state functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ErrorProjectionState interface implementing architectural component for error projection state operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteErrorProjectionState implements ErrorProjectionState {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ErrorProjectionState {
  totalErrors: number;
  errorsByProjection: Map<string, number>;
  errorsByType: Map<string, number>;
  recentErrors: Array<{
    projectionName: string;
    eventType: string;
    error: string;
    timestamp: Date;
  }>;
}
