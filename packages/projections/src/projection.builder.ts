import {
  CheckpointCapability,
  CircuitBreakerCapability,
  DeadLetterCapability,
  SnapshotProjectionCapability,
} from './capabilities';
import { ExponentialBackoffStrategy } from './error-strategy';
import {
  ProjectionEngine,
  EnhancedProjectionEngine,
} from './projection-engine';
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

export class ProjectionBuilder<TReadModel> {
  protected engine: ProjectionEngine<TReadModel>; // zmiana z private na protected
  protected projection: IProjection<TReadModel>; // dodane
  protected store: IProjectionStore<TReadModel>; // dodane

  constructor(
    projection: IProjection<TReadModel>,
    store: IProjectionStore<TReadModel>,
  ) {
    this.projection = projection; // dodane
    this.store = store; // dodane
    this.engine = new ProjectionEngine(projection, store);
  }

  static create<TReadModel>(
    projection: IProjection<TReadModel>,
    store: IProjectionStore<TReadModel>,
  ): ProjectionBuilder<TReadModel> {
    return new ProjectionBuilder(projection, store);
  }

  withCheckpoints(store: IProjectionCheckpointStore, interval = 100): this {
    this.engine.addCapability(new CheckpointCapability(store, interval));
    return this;
  }

  withSnapshots(store: IProjectionSnapshotStore, interval = 1000): this {
    this.engine.addCapability(
      new SnapshotProjectionCapability(store, interval),
    );
    return this;
  }

  build(): IProjectionEngine<TReadModel> {
    return this.engine;
  }
}

// projection-builder-enhanced.ts
export class EnhancedProjectionBuilder<
  TReadModel,
> extends ProjectionBuilder<TReadModel> {
  withRetryStrategy(
    config: IProjectionRetryConfig,
    strategy?: IProjectionErrorStrategy,
  ): this {
    // Teraz this.projection i this.store są dostępne
    this.engine = new EnhancedProjectionEngine(
      this.projection,
      this.store,
      config,
      strategy || new ExponentialBackoffStrategy(),
    );
    return this;
  }

  withCircuitBreaker(config: ICircuitBreakerConfig): this {
    this.engine.addCapability(new CircuitBreakerCapability(config));
    return this;
  }

  withDeadLetter(
    store: IDeadLetterStore,
    shouldDeadLetter?: (error: Error, attempts: number) => boolean,
  ): this {
    this.engine.addCapability(
      new DeadLetterCapability(store, shouldDeadLetter),
    );
    return this;
  }

  // Override build method to ensure proper typing
  override build(): EnhancedProjectionEngine<TReadModel> {
    return this.engine as EnhancedProjectionEngine<TReadModel>;
  }
}
