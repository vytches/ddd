import {
  CheckpointCapability,
  CircuitBreakerCapability,
  DeadLetterCapability,
  SnapshotProjectionCapability,
} from './capabilities';
import { ExponentialBackoffStrategy } from './error-strategy';
import { ProjectionEngine, EnhancedProjectionEngine } from './projection-engine';
import type {
  ICircuitBreakerConfig,
  IDeadLetterStore,
  IProjection,
  IProjectionCheckpointStore,
  IProjectionEngine,
  IProjectionErrorStrategy,
  IProjectionRetryConfig,
  IProjectionSnapshotStore,
  IProjectionStore,
} from './projection-interfaces';

/**
 * @llm-summary ProjectionBuilder class for projection builder operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * ProjectionBuilder class implementing architectural component for projection builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ProjectionBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ProjectionBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ProjectionBuilder<TReadModel> {
  protected engine: ProjectionEngine<TReadModel>; // zmiana z private na protected
  protected projection: IProjection<TReadModel>; // dodane
  protected store: IProjectionStore<TReadModel>; // dodane

  constructor(projection: IProjection<TReadModel>, store: IProjectionStore<TReadModel>) {
    this.projection = projection; // dodane
    this.store = store; // dodane
    this.engine = new ProjectionEngine(projection, store);
  }

  static create<TReadModel>(
    projection: IProjection<TReadModel>,
    store: IProjectionStore<TReadModel>
  ): ProjectionBuilder<TReadModel> {
    return new ProjectionBuilder(projection, store);
  }

  withCheckpoints(store: IProjectionCheckpointStore, interval = 100): this {
    this.engine.addCapability(new CheckpointCapability(store, interval));
    return this;
  }

  withSnapshots(store: IProjectionSnapshotStore, interval = 1000): this {
    this.engine.addCapability(new SnapshotProjectionCapability(store, interval));
    return this;
  }

  build(): IProjectionEngine<TReadModel> {
    return this.engine;
  }
}

// projection-builder-enhanced.ts

/**
 * @llm-summary EnhancedProjectionBuilder class for enhanced projection builder operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * EnhancedProjectionBuilder class implementing architectural component for enhanced projection builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EnhancedProjectionBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new EnhancedProjectionBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class EnhancedProjectionBuilder<TReadModel> extends ProjectionBuilder<TReadModel> {
  withRetryStrategy(config: IProjectionRetryConfig, strategy?: IProjectionErrorStrategy): this {
    // Teraz this.projection i this.store są dostępne
    this.engine = new EnhancedProjectionEngine(
      this.projection,
      this.store,
      config,
      strategy || new ExponentialBackoffStrategy()
    );
    return this;
  }

  withCircuitBreaker(config: ICircuitBreakerConfig): this {
    this.engine.addCapability(new CircuitBreakerCapability(config));
    return this;
  }

  withDeadLetter(
    store: IDeadLetterStore,
    shouldDeadLetter?: (error: Error, attempts: number) => boolean
  ): this {
    this.engine.addCapability(new DeadLetterCapability(store, shouldDeadLetter));
    return this;
  }

  // Override build method to ensure proper typing
  override build(): EnhancedProjectionEngine<TReadModel> {
    return this.engine as EnhancedProjectionEngine<TReadModel>;
  }
}
