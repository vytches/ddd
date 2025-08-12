/* eslint-disable @typescript-eslint/no-explicit-any */
// projection-interfaces.ts
import type {
  Capability,
  CapabilityConstructor,
  IDomainEvent,
  IProjectionCapability,
} from '@vytches/ddd-contracts';
import type { ProjectionError } from './projection-errors';

export interface IProjection<TReadModel> {
  readonly name: string;
  readonly eventTypes: string[];

  createInitialState(): TReadModel | Promise<TReadModel>;
  apply(readModel: TReadModel, event: IDomainEvent): TReadModel | Promise<TReadModel>;
  handles(eventType: string): boolean;
}

export interface IProjectionStore<TReadModel> {
  load(projectionName: string): Promise<TReadModel | null>;
  save(projectionName: string, state: TReadModel): Promise<void>;
  delete(projectionName: string): Promise<void>;
  deleteAll(): Promise<void>;
  exists(projectionName: string): Promise<boolean>;
}

// Re-export from contracts for convenience
export type { IProjectionCapability } from '@vytches/ddd-contracts';

export interface ICapabilityContext<TReadModel> {
  getProjectionName(): string;
  getStore(): IProjectionStore<TReadModel>;
  executeHooks(hookName: string, ...args: unknown[]): Promise<void>;
}

export interface IProjectionLifecycleCapability<TReadModel> {
  onBeforeApply?(state: TReadModel, event: IDomainEvent): Promise<void> | void;
  onAfterApply?(state: TReadModel, event: IDomainEvent): Promise<void> | void;
  onError?(error: ProjectionError, event?: IDomainEvent): Promise<void> | void;
}

export interface IProjectionEngine<TReadModel> {
  getProjectionName(): string;
  getEventTypes(): string[];
  processEvent(event: IDomainEvent): Promise<void>;
  isInterestedIn(event: IDomainEvent): boolean;
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

export interface ICheckpointProjectionCapability<TReadModel>
  extends IProjectionLifecycleCapability<TReadModel> {
  saveCheckpoint(state: TReadModel, position: number): Promise<void>;
  loadCheckpoint(): Promise<{ state: TReadModel; position: number } | null>;
}

export interface ISnapshotProjectionCapability<TReadModel>
  extends IProjectionLifecycleCapability<TReadModel> {
  createSnapshot(state: TReadModel, position: number): Promise<void>;
  loadLatestSnapshot(): Promise<{ state: TReadModel; position: number } | null>;
}

export interface IProjectionCheckpoint<TState = unknown> {
  projectionName: string;
  position: number;
  state: TState;
  timestamp: Date;
  eventCount?: number;
  metadata?: Record<string, unknown>;
}

export interface IProjectionCheckpointStore {
  save<TState>(
    projectionName: string,
    checkpoint: Omit<IProjectionCheckpoint<TState>, 'projectionName'>
  ): Promise<void>;

  load<TState>(projectionName: string): Promise<IProjectionCheckpoint<TState> | null>;

  delete(projectionName: string): Promise<void>;
}

export interface IProjectionSnapshot<TState = unknown> {
  projectionName: string;
  position: number;
  state: TState;
  timestamp: Date;
  version?: number;
  metadata?: Record<string, unknown>;
}

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

export interface IProjectionBuilder<TReadModel> {
  withCheckpoints(store: IProjectionCheckpointStore, options?: CheckpointProjectionOptions): this;
  withSnapshots(store: IProjectionSnapshotStore, options?: SnapshotProjectionOptions): this;
  withCustomCapability<T extends Capability & IProjectionCapability>(capability: T): this;
  build(): IProjectionEngine<TReadModel>;
}

export interface CheckpointProjectionOptions {
  interval?: number;
  saveOnRebuildComplete?: boolean;
}

export interface SnapshotProjectionOptions {
  interval?: number;
  maxSnapshots?: number;
  compressState?: (state: unknown) => unknown;
  decompressState?: (compressed: unknown) => unknown;
}

export interface IProjectionRetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[]; // Error types that should be retried
  nonRetryableErrors: string[]; // Error types that should NOT be retried
}

export interface IProjectionErrorStrategy {
  shouldRetry(error: Error, attempt: number, config?: IProjectionRetryConfig): boolean;
  getRetryDelay(attempt: number, config: IProjectionRetryConfig): number;
  getDelay?(attempt: number, config?: IProjectionRetryConfig): number; // For test compatibility
  isRetryableError(error: Error, config: IProjectionRetryConfig): boolean;
}

export interface IDeadLetterStore {
  store(deadLetter: IDeadLetter): Promise<void>;
  getByProjection(projectionName: string): Promise<IDeadLetter[]>;
  retry(deadLetterId: string): Promise<IDomainEvent>;
  delete(deadLetterId: string): Promise<void>;
}

export interface IDeadLetter {
  id: string;
  projectionName: string;
  event: IDomainEvent;
  error: Error;
  attemptCount: number;
  firstFailedAt: Date;
  lastFailedAt: Date;
  metadata?: Record<string, any>;
}

export interface ICircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, rejecting requests
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

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
