import type {
  IExtendedDomainEvent,
  Capability,
  CapabilityConstructor,
  IProjectionCapability,
  IEventStore,
  IReplayFilter,
  IReplayResult,
} from '@vytches-ddd/contracts';
import { CapabilityRegistry } from '@vytches-ddd/contracts';
import { LibUtils } from '@vytches-ddd/utils';

import { ProjectionError } from './projection-errors';
import type {
  ICapabilityContext,
  IProjection,
  IProjectionEngine,
  IProjectionErrorStrategy,
  IProjectionLifecycleCapability,
  IProjectionRetryConfig,
  IProjectionStore,
} from './projection-interfaces';
import { ExponentialBackoffStrategy } from './error-strategy';
import { ProjectionRebuilder, type IProjectionRebuildConfig } from './projection-rebuilder';

export class ProjectionEngine<TReadModel> implements IProjectionEngine<TReadModel> {
  private capabilities = new CapabilityRegistry();
  protected projection: IProjection<TReadModel>;
  protected store: IProjectionStore<TReadModel>;

  constructor(
    projection: IProjection<TReadModel>,
    store: IProjectionStore<TReadModel>,
    capabilities?: (Capability & IProjectionCapability)[]
  ) {
    this.projection = projection;
    this.store = store;

    // Attach initial capabilities if provided
    if (capabilities) {
      capabilities.forEach(capability => this.addCapability(capability));
    }
  }

  getProjectionName(): string {
    return this.projection.name;
  }

  getEventTypes(): string[] {
    return this.projection.eventTypes;
  }

  isInterestedIn(event: IExtendedDomainEvent): boolean {
    return this.projection.handles(event.eventType);
  }

  async processEvent(event: IExtendedDomainEvent): Promise<void> {
    if (!this.isInterestedIn(event)) return;

    try {
      const currentState = await this.getState();
      if (!currentState) {
        throw ProjectionError.stateNotFound(this.projection.name);
      }

      // Before hooks
      await this.executeHooks('onBeforeApply', currentState, event);

      // Apply event
      const newState = await Promise.resolve(this.projection.apply(currentState, event));

      // Save state
      await this.store.save(this.projection.name, newState);

      // After hooks
      await this.executeHooks('onAfterApply', newState, event);
    } catch (error) {
      // If it's already a ProjectionError, preserve it
      if (error instanceof ProjectionError) {
        await this.executeHooks('onError', error, event);
        throw error;
      }

      // For regular errors from the projection, preserve the original error
      // if it contains meaningful domain information
      const errorMessage = (error as Error).message || 'Unknown error';
      if (
        errorMessage.includes('Failed to apply event') ||
        errorMessage.includes('Failed to create initial state')
      ) {
        await this.executeHooks('onError', error as Error, event);
        throw error;
      }

      // Otherwise, wrap in ProjectionError
      const projectionError = ProjectionError.processingFailed(
        this.projection.name,
        event.eventType,
        error as Error
      );

      await this.executeHooks('onError', projectionError, event);
      throw projectionError;
    }
  }

  async getState(): Promise<TReadModel | null> {
    let state = await this.store.load(this.projection.name);

    if (!state) {
      state = await this.projection.createInitialState();
      await this.store.save(this.projection.name, state);
    }

    return state;
  }

  async saveState(state: TReadModel): Promise<void> {
    await this.store.save(this.projection.name, state);
  }

  async reset(): Promise<void> {
    const initialState = await this.projection.createInitialState();
    await this.store.save(this.projection.name, initialState);
  }

  async rebuildFromEvents(events: AsyncIterable<IExtendedDomainEvent>): Promise<void> {
    await this.reset();

    for await (const event of events) {
      if (this.isInterestedIn(event)) {
        await this.processEvent(event);
      }
    }
  }

  addCapability<T extends Capability & IProjectionCapability>(capability: T): this {
    const context: ICapabilityContext<TReadModel> = {
      getProjectionName: () => this.projection.name,
      getStore: () => this.store,
      executeHooks: (hookName, ...args) => this.executeHooks(hookName, ...args),
    };

    capability.attach(context);
    this.capabilities.register(capability);
    return this;
  }

  getCapability<T extends Capability & IProjectionCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): T | undefined {
    return this.capabilities.get(CapabilityClass) as T | undefined;
  }

  hasCapability<T extends Capability & IProjectionCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): boolean {
    return this.capabilities.has(CapabilityClass);
  }

  removeCapability<T extends Capability & IProjectionCapability>(
    CapabilityClass: CapabilityConstructor<T>
  ): this {
    const capability = this.capabilities.get(CapabilityClass);
    if (capability && 'detach' in capability && typeof capability.detach === 'function') {
      capability.detach();
    }
    this.capabilities.remove(CapabilityClass);
    return this;
  }

  protected async executeHooks(hookName: string, ...args: unknown[]): Promise<void> {
    const capabilities = this.capabilities.getAll();

    // Execute hooks sequentially for critical operations
    if (hookName === 'onBeforeApply' || hookName === 'onError') {
      for (const capability of capabilities) {
        const lifecycleCapability = capability as IProjectionLifecycleCapability<TReadModel>;
        const hook = (lifecycleCapability as Record<string, unknown>)[hookName];

        if (typeof hook === 'function') {
          await Promise.resolve(hook.apply(lifecycleCapability, args));
        }
      }
      return;
    }

    // For non-critical hooks, execute in parallel
    const promises: Promise<void>[] = [];
    for (const capability of capabilities) {
      const lifecycleCapability = capability as IProjectionLifecycleCapability<TReadModel>;
      const hook = (lifecycleCapability as Record<string, unknown>)[hookName];

      if (typeof hook === 'function') {
        const result = hook.apply(lifecycleCapability, args);
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Rebuild this projection from event history
   */
  async rebuild(
    eventStore: IEventStore,
    filter?: IReplayFilter,
    config?: IProjectionRebuildConfig
  ): Promise<IReplayResult> {
    const rebuilder = new ProjectionRebuilder(eventStore, this, this.store);
    return rebuilder.rebuild(filter, config);
  }

  /**
   * Rebuild this projection from specific stream
   */
  async rebuildFromStream(
    eventStore: IEventStore,
    streamId: string,
    filter?: IReplayFilter,
    config?: IProjectionRebuildConfig
  ): Promise<IReplayResult> {
    const rebuilder = new ProjectionRebuilder(eventStore, this, this.store);
    return rebuilder.rebuildFromStream(streamId, filter, config);
  }
}

export class EnhancedProjectionEngine<TReadModel> extends ProjectionEngine<TReadModel> {
  constructor(
    projection: IProjection<TReadModel>,
    store: IProjectionStore<TReadModel>,
    retryConfigOrCapabilities: IProjectionRetryConfig | (Capability & IProjectionCapability)[],
    private readonly errorStrategy: IProjectionErrorStrategy = new ExponentialBackoffStrategy()
  ) {
    super(projection, store);

    // Handle both constructor signatures for backward compatibility
    if (Array.isArray(retryConfigOrCapabilities)) {
      // Old signature: capabilities array passed as third parameter
      this.retryConfig = {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        backoffMultiplier: 2,
        retryableErrors: [],
        nonRetryableErrors: [],
      };
      retryConfigOrCapabilities.forEach(capability => this.addCapability(capability));
    } else {
      // New signature: retry config passed as third parameter
      this.retryConfig = retryConfigOrCapabilities;
    }
  }

  private readonly retryConfig: IProjectionRetryConfig;

  override async processEvent(event: IExtendedDomainEvent): Promise<void> {
    if (!this.isInterestedIn(event)) return;

    let attempt = 0;
    let lastError: Error = new Error('Unknown error');

    while (attempt < this.retryConfig.maxAttempts) {
      attempt++;

      try {
        const currentState = await this.getState();
        if (!currentState) {
          throw ProjectionError.stateNotFound(this.projection.name);
        }

        // Before hooks
        await this.executeHooks('onBeforeApply', currentState, event);

        // Apply event
        const newState = await Promise.resolve(this.projection.apply(currentState, event));

        // Save state
        await this.store.save(this.projection.name, newState);

        // After hooks
        await this.executeHooks('onAfterApply', newState, event);

        return; // Success!
      } catch (error) {
        lastError = error as Error;

        // Create projection error
        const projectionError =
          error instanceof ProjectionError
            ? error
            : ProjectionError.processingFailed(
                this.projection.name,
                event.eventType,
                error as Error
              );

        // Add attempt count to error data
        if (projectionError.data && typeof projectionError.data === 'object') {
          (projectionError.data as Record<string, any>).attemptCount = attempt;
        }

        // Check if should retry - pass the original error, not the wrapped one
        const shouldRetry = this.errorStrategy.shouldRetry(error as Error, attempt);

        if (!shouldRetry || attempt >= this.retryConfig.maxAttempts) {
          await this.executeHooks('onError', projectionError, event);
          throw projectionError;
        }

        // Wait before retry
        const delay = this.errorStrategy.getRetryDelay(attempt, this.retryConfig);
        await LibUtils.sleep(delay);
      }
    }

    // This should not be reached, but just in case
    const finalError =
      lastError instanceof ProjectionError
        ? lastError
        : ProjectionError.processingFailed(this.projection.name, event.eventType, lastError);

    await this.executeHooks('onError', finalError, event);
    throw finalError;
  }
}
