/* eslint-disable @typescript-eslint/no-unsafe-function-type */
// F-C3 (VB-002): type-only import for reflect-metadata's ambient
// Reflect.getMetadata typings — no runtime side effect (see README).
import type {} from 'reflect-metadata';
import type { IDependencyContainer, ServiceToken } from '@vytches/ddd-di';
import type { ResilienceStrategy } from '@vytches/ddd-resilience';
import { internalLogger } from '@vytches/ddd-contracts/internal';
import {
  BulkheadStrategy,
  CircuitBreakerStrategy,
  CompositeResilienceStrategy,
  DefaultResilienceContext,
  RetryStrategy,
  TimeoutStrategy,
} from '@vytches/ddd-resilience';
import { ICommandBus } from '../abstracts';
import { HandlerNotFoundError } from '../errors';
import type { ICommand, ICommandHandler, IDisposableBus, IResettableBus } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext, LoggingMiddleware } from '../middleware';
import type { ICqrsValidatable } from '../validation';
import type { BusRetryOptions } from './bus-retry-options';
import { normalizeBusRetryOptions } from './bus-retry-options';

/**
 * Configuration options for enhanced command bus
 */
export interface EnhancedCommandBusOptions {
  enableMetrics?: boolean;
  /**
   * Install the default {@link LoggingMiddleware}, which logs every
   * command's start/completion/failure via `console` (or a custom logger
   * passed to it directly). **Off by default** (VS-018) — decoupled from
   * `enableMetrics`, which previously implied logging as a side effect and
   * bypassed `configureDiagnostics` entirely. Opt in explicitly for
   * execution tracing during development/debugging.
   */
  enableExecutionLogging?: boolean;
  enableCache?: boolean;
  defaultTimeout?: number;
  defaultRetries?: number;
  enableBatching?: boolean;
  maxBatchSize?: number;
  batchDelayMs?: number;
  resilience?: {
    circuitBreaker?: {
      enabled?: boolean;
      failureThreshold?: number;
      resetTimeout?: number;
    };
    /**
     * `true` is a legacy alias for `{ enabled: true }` (D12). The object form
     * requires `enabled: true` explicitly — `{ maxAttempts: 5 }` alone does
     * NOT enable retry. See {@link BusRetryOptions}.
     */
    retry?: boolean | BusRetryOptions;
    timeout?: {
      enabled?: boolean;
      timeoutMs?: number;
    };
    bulkhead?: {
      enabled?: boolean;
      maxConcurrent?: number;
      maxQueued?: number;
    };
  };
}

/**
 * Handler cache entry
 */
interface CachedHandler<T extends ICommand = ICommand, TResult = void> {
  handler: ICommandHandler<T, TResult>;
  resolvedAt: number;
}

/**
 * Batch command entry
 */
interface BatchEntry<T extends ICommand = ICommand, TResult = void> {
  command: T;
  resolve: (value: TResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * Performance-optimized Enhanced Command Bus with resilience patterns
 *
 * @remarks
 * In a NestJS application, provide this through `VytchesDDDModule.forRoot()`
 * (or `forContext()` / `forContexts()` / `forFeature()`) rather than
 * instantiating it in a module of your own. Handler auto-discovery lives in
 * `VytchesExplorerService`, which those factories provide and which resolves
 * the bus via `COMMAND_BUS_TOKEN`. A hand-built module that skips them leaves
 * no explorer, or an explorer with no bus: nothing is registered and every
 * `execute()` throws `No handler registered for ...`.
 *
 * Direct instantiation is the right call outside NestJS, and for tests.
 */
export class EnhancedCommandBus extends ICommandBus implements IResettableBus, IDisposableBus {
  // Core properties
  private middlewares: ICQRSMiddleware[] = [];
  // Registered handlers split by registration kind. Keeping instances and
  // factories in separate, typed maps removes the brittle `'execute' in x`
  // runtime probe (which could misclassify a callable handler or a factory
  // returning a non-handler). A given key lives in exactly one map: register()
  // and registerFactory() evict the other kind, preserving last-write-wins.
  private handlerInstances = new Map<Function | string, ICommandHandler<ICommand, unknown>>();
  private handlerFactories = new Map<Function | string, () => ICommandHandler<ICommand, unknown>>();

  // Performance optimization: Handler cache
  private handlerCache = new Map<Function | string, CachedHandler>();
  private readonly CACHE_TTL = 60000; // 1 minute cache
  private readonly MAX_CACHE_SIZE = 500;
  private cacheCleanupInterval?: NodeJS.Timeout | undefined;

  // Configuration
  private maxRetries: number;
  private cacheEnabled: boolean;
  private batchingEnabled: boolean;
  private maxBatchSize: number;
  private batchDelayMs: number;

  // Resilience strategies - disabled
  private resilienceEnabled = false;

  // Batch processing
  private batchQueue: BatchEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  // Resilience strategy
  private resilienceStrategy?: ResilienceStrategy;

  // Current options for dynamic reconfiguration
  private options: EnhancedCommandBusOptions;

  // Metrics
  private metrics = {
    executionCount: 0,
    totalExecutionTime: 0,
    errors: 0,
    cacheHits: 0,
    cacheMisses: 0,
    timeouts: 0,
    retries: 0,
    batchesProcessed: 0,
  };

  constructor(
    private container: IDependencyContainer,
    options: EnhancedCommandBusOptions = {}
  ) {
    super();

    // Store options for dynamic reconfiguration
    this.options = { ...options };

    // Initialize configuration with defaults
    this.maxRetries = options.defaultRetries ?? 3;
    // Default false matches EnhancedQueryBus (was true, changed for symmetry —
    // see VP-010 #2). Consumers who relied on implicit command-bus cache should
    // opt in: new EnhancedCommandBus(container, { enableCache: true }).
    this.cacheEnabled = options.enableCache ?? false;
    this.batchingEnabled = options.enableBatching ?? false;
    this.maxBatchSize = options.maxBatchSize ?? 10;
    this.batchDelayMs = options.batchDelayMs ?? 100;

    // Setup resilience patterns
    this.setupResilience(options.resilience);

    // VS-018: execution logging is opt-in (default off), decoupled from
    // enableMetrics. LoggingMiddleware defaults to raw console when no
    // custom logger is supplied — that is only reachable when a consumer
    // explicitly requests it here.
    if (options.enableExecutionLogging === true) {
      this.use(new LoggingMiddleware());
    }

    // Clean cache periodically
    if (this.cacheEnabled) {
      this.cacheCleanupInterval = setInterval(() => this.cleanHandlerCache(), this.CACHE_TTL);
      // unref() allows the process / vitest-worker to exit even when this timer
      // is still pending. Guards environments that do not have unref (e.g. some
      // browser runtimes) with an optional-call.
      this.cacheCleanupInterval.unref?.();
    }
  }

  /**
   * Setup resilience patterns using the resilience package
   */
  private setupResilience(config?: EnhancedCommandBusOptions['resilience']): void {
    const strategies: ResilienceStrategy[] = [];

    // REL-009 (2026-05-08, BREAKING): circuitBreaker + retry are now OPT-IN
    // (was opt-out via `enabled !== false`). Retrying domain commands is
    // unsafe by default — most command handlers are NOT idempotent, so
    // automatic retry can cause duplicate orders, double charges, etc.
    // Consumers who want resilience must opt in explicitly:
    //   { resilience: { retry: { enabled: true, maxAttempts: 3 } } }
    //
    // Timeout remains default-on as a safety net — it does NOT affect
    // idempotency and prevents a hung downstream from blocking the bus.

    // Circuit Breaker (opt-in)
    if (config?.circuitBreaker?.enabled === true) {
      strategies.push(
        new CircuitBreakerStrategy({
          name: 'CommandBusCircuitBreaker',
          failureThreshold: config?.circuitBreaker?.failureThreshold ?? 5,
          recoveryTimeout: config?.circuitBreaker?.resetTimeout ?? 60000,
          successThreshold: 3,
          timeout: 30000,
        })
      );
    }

    // Retry Strategy (opt-in — see BREAKING note above)
    const retryOptions = normalizeBusRetryOptions(config?.retry);
    if (retryOptions?.enabled === true) {
      strategies.push(
        new RetryStrategy({
          maxAttempts: retryOptions.maxAttempts ?? this.maxRetries,
          baseDelay: retryOptions.baseDelay ?? 1000,
          maxDelay: retryOptions.maxDelay ?? 30000,
          backoffMultiplier: retryOptions.backoffMultiplier ?? 2,
          // AC1/SA-H3: was hardcoded `false` regardless of caller intent —
          // every retried call backed off on the identical schedule. Now
          // defaults to `true` (RetryPolicy.defaultConfig()) and honors an
          // explicit `jitter: false` override.
          jitter: retryOptions.jitter ?? true,
        })
      );
    }

    // Timeout Strategy (default-on, safety net)
    if (config?.timeout?.enabled !== false) {
      strategies.push(new TimeoutStrategy(config?.timeout?.timeoutMs ?? 30000));
    }

    // Bulkhead Strategy (already opt-in)
    if (config?.bulkhead?.enabled) {
      strategies.push(
        new BulkheadStrategy({
          name: 'CommandBusBulkhead',
          maxConcurrency: config?.bulkhead?.maxConcurrent ?? 10,
          queueCapacity: config?.bulkhead?.maxQueued ?? 50,
        })
      );
    }

    // Create composite strategy if we have any strategies
    if (strategies.length > 0) {
      this.resilienceStrategy = new CompositeResilienceStrategy(strategies);
      this.resilienceEnabled = true;
    }
  }

  /**
   * Set timeout for command execution
   */
  setTimeout(timeoutMs: number): this {
    // Update timeout configuration
    this.options = {
      ...this.options,
      defaultTimeout: timeoutMs,
      resilience: {
        ...this.options?.resilience,
        timeout: {
          ...this.options?.resilience?.timeout,
          enabled: true,
          timeoutMs,
        },
      },
    };

    // Rebuild resilience strategy with new timeout
    this.setupResilience(this.options.resilience);
    return this;
  }

  /**
   * Set maximum retries for failed commands
   */
  setRetries(maxRetries: number): this {
    this.maxRetries = maxRetries;

    // Update retry configuration. Normalize first: this.options.resilience.retry
    // may currently hold the legacy boolean form, which cannot be spread.
    const previousRetry = normalizeBusRetryOptions(this.options?.resilience?.retry);

    this.options = {
      ...this.options,
      defaultRetries: maxRetries,
      resilience: {
        ...this.options?.resilience,
        retry: {
          ...previousRetry,
          enabled: true,
          maxAttempts: maxRetries,
        },
      },
    };

    // Rebuild resilience strategy with new retry settings
    this.setupResilience(this.options.resilience);
    return this;
  }

  /**
   * Enable or configure caching
   */
  enableCache(enable = true): this {
    this.cacheEnabled = enable;
    if (!enable) {
      this.handlerCache.clear();
      if (this.cacheCleanupInterval) {
        clearInterval(this.cacheCleanupInterval);
        this.cacheCleanupInterval = undefined;
      }
    } else if (!this.cacheCleanupInterval) {
      this.cacheCleanupInterval = setInterval(() => this.cleanHandlerCache(), this.CACHE_TTL);
      this.cacheCleanupInterval.unref?.();
    }
    return this;
  }

  /**
   * Enable batch processing
   */
  enableBatching(enable = true, options?: { maxSize?: number; delayMs?: number }): this {
    this.batchingEnabled = enable;
    if (options?.maxSize) this.maxBatchSize = options.maxSize;
    if (options?.delayMs) this.batchDelayMs = options.delayMs;
    return this;
  }

  /**
   * Register command handler
   */
  register<T extends ICommand, TResult = void>(
    commandType: unknown,
    handler: ICommandHandler<T, TResult>
  ): void {
    const key = typeof commandType === 'string' ? commandType : (commandType as Function);
    this.handlerInstances.set(key, handler as ICommandHandler<ICommand, unknown>);
    this.handlerFactories.delete(key); // last write wins across kinds
    this.handlerCache.delete(key);
  }

  /**
   * Register factory for lazy handler initialization
   */
  registerFactory<T extends ICommand, TResult = void>(
    commandType: unknown,
    factory: () => ICommandHandler<T, TResult>
  ): void {
    const key = typeof commandType === 'string' ? commandType : (commandType as Function);
    this.handlerFactories.set(key, factory as () => ICommandHandler<ICommand, unknown>);
    this.handlerInstances.delete(key); // last write wins across kinds
    this.handlerCache.delete(key);
  }

  /**
   * Add middleware to pipeline
   */
  use(middleware: ICQRSMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Legacy discovery method (backward compatibility)
   */
  discoverHandlers(): void {
    // No-op for backward compatibility
  }

  /**
   * Execute command with all optimizations
   */
  async execute<T extends ICommand, TResult = void>(command: T): Promise<TResult> {
    // If batching is enabled, add to batch queue
    if (this.batchingEnabled && this.supportsBatching(command)) {
      return this.addToBatch(command) as Promise<TResult>;
    }

    // Execute with resilience patterns
    return this.executeWithResilience(command);
  }

  /**
   * Execute multiple commands in batch
   */
  async executeMany<T extends ICommand, TResult = void>(commands: T[]): Promise<TResult[]> {
    const startTime = performance.now();

    try {
      // Process all commands in parallel with concurrency limit
      const results = await this.executeInParallel(commands, 5); // Max 5 concurrent

      this.metrics.batchesProcessed++;
      this.metrics.totalExecutionTime += performance.now() - startTime;

      return results as TResult[];
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Execute with resilience patterns
   */
  private async executeWithResilience<T extends ICommand, TResult = void>(
    command: T
  ): Promise<TResult> {
    if (!this.resilienceStrategy) {
      // No resilience patterns configured, execute directly
      return this.executeCore(command);
    }

    // Create resilience context
    const context = DefaultResilienceContext.create({
      metadata: {
        operationKey: `command:${command.constructor.name}`,
        commandType: command.constructor.name,
        timestamp: Date.now(),
      },
    });

    // Execute with resilience patterns
    return this.resilienceStrategy.execute(() => this.executeCore(command), context);
  }

  /**
   * Core execution logic
   */
  private async executeCore<T extends ICommand, TResult = void>(command: T): Promise<TResult> {
    const startTime = performance.now();

    try {
      // Get handler (with caching)
      const handler = await this.resolveHandler<T, TResult>(command.constructor);

      // Validate if needed
      if (this.isValidatable(command)) {
        await command.validate?.();
      }

      // Execute with middleware pipeline
      const context = new CQRSExecutionContext(command, handler, 'command');
      const result = await this.executeWithMiddleware(context, () => handler.execute(command));

      // Update metrics
      this.metrics.executionCount++;
      this.metrics.totalExecutionTime += performance.now() - startTime;

      return result;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Resolve handler with caching. Uses Function reference as primary key to
   * prevent cross-context handler collision when different bounded contexts
   * define classes with the same name.
   */
  private async resolveHandler<T extends ICommand, TResult = void>(
    commandClass: Function
  ): Promise<ICommandHandler<T, TResult>> {
    // Check cache first (keyed by Function ref — no cross-context collision)
    if (this.cacheEnabled) {
      const cached = this.handlerCache.get(commandClass);
      if (cached && Date.now() - cached.resolvedAt < this.CACHE_TTL) {
        this.metrics.cacheHits++;
        return cached.handler as ICommandHandler<T, TResult>;
      }
    }

    this.metrics.cacheMisses++;

    // Function ref first, string-name fallback for handlers registered by name
    // (BC). A directly-registered instance is returned as-is; a factory is
    // invoked lazily. No `'execute' in x` probe — the map a handler lives in is
    // its kind.
    const instance =
      this.handlerInstances.get(commandClass) ?? this.handlerInstances.get(commandClass.name);
    if (instance) {
      if (this.cacheEnabled) {
        this.handlerCache.set(commandClass, {
          handler: instance as ICommandHandler<ICommand, void>,
          resolvedAt: Date.now(),
        });
      }
      return instance as unknown as ICommandHandler<T, TResult>;
    }

    const factory =
      this.handlerFactories.get(commandClass) ?? this.handlerFactories.get(commandClass.name);
    if (factory) {
      try {
        const handler = factory() as ICommandHandler<T, TResult>;

        if (this.cacheEnabled) {
          this.handlerCache.set(commandClass, {
            handler: handler as ICommandHandler<ICommand, void>,
            resolvedAt: Date.now(),
          });
        }

        return handler;
      } catch (factoryError) {
        // The factory threw — almost always a stale closure over a destroyed DI
        // scope (e.g. a NestJS moduleRef from a torn-down test module). Left in
        // place it poisons every future call to this command with an opaque 500.
        // Evict the dead entry so the next call re-resolves cleanly from the
        // container, and fail this call with a diagnosable error instead of
        // leaking the raw factory exception.
        this.handlerFactories.delete(commandClass);
        this.handlerFactories.delete(commandClass.name);
        this.handlerCache.delete(commandClass);
        internalLogger.warn(
          'EnhancedCommandBus: Evicted stale command handler factory; next call re-resolves',
          {
            commandName: commandClass.name,
            error: factoryError instanceof Error ? factoryError.message : String(factoryError),
          }
        );
        // Include stale-bus hint so the consumer can diagnose the root cause.
        // The factory threw — most likely the bus was not recreated after
        // module teardown (use useFactory, not useValue, to tie bus lifetime
        // to module lifecycle — see VP-010).
        throw new HandlerNotFoundError(
          `${commandClass.name} (hint: factory threw — bus may be stale; recreate it via useFactory on each module init)`,
          'command'
        );
      }
    }

    // Resolve from DI container
    try {
      const handlerToken = this.getHandlerToken(commandClass) as ServiceToken<
        ICommandHandler<T, TResult>
      >;
      const handler = this.container.resolve<ICommandHandler<T, TResult>>(handlerToken);

      if (this.cacheEnabled) {
        this.handlerCache.set(commandClass, {
          handler: handler as ICommandHandler<ICommand, void>,
          resolvedAt: Date.now(),
        });
      }

      return handler;
    } catch {
      throw new HandlerNotFoundError(commandClass.name, 'command');
    }
  }

  /**
   * Get handler token from metadata
   */
  private getHandlerToken(commandClass: Function): ServiceToken {
    const handlerMetadata = Reflect.getMetadata('di:command-handler', commandClass);
    if (!handlerMetadata) {
      throw new Error(`No metadata for ${commandClass.name}`);
    }
    // Use handlerType (class constructor) for DI resolution, fallback to serviceId/name
    return (
      handlerMetadata.handlerType || handlerMetadata.serviceId || handlerMetadata.handlerType?.name
    );
  }

  /**
   * Execute with middleware pipeline
   */
  private async executeWithMiddleware<T>(
    context: CQRSExecutionContext,
    handlerExecution: () => Promise<T>
  ): Promise<T> {
    if (this.middlewares.length === 0) {
      return handlerExecution();
    }

    let index = 0;
    const next = async (): Promise<T> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware?.handle(context, next) as Promise<T>;
      }
      return handlerExecution();
    };

    return next();
  }

  /**
   * Add command to batch queue
   */
  private addToBatch<T extends ICommand, TResult = void>(command: T): Promise<TResult> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        command,
        resolve: resolve as (value: void) => void,
        reject,
        timestamp: Date.now(),
      });

      if (this.batchQueue.length >= this.maxBatchSize) {
        this.processBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.processBatch(), this.batchDelayMs);
      }
    }) as Promise<TResult>;
  }

  /**
   * Process batch queue
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batch = this.batchQueue.splice(0, this.maxBatchSize);
    if (batch.length === 0) return;

    const promises = batch.map(async entry => {
      try {
        const result = await this.executeWithResilience(entry.command);
        entry.resolve(result);
      } catch (error) {
        entry.reject(error as Error);
      }
    });

    await Promise.all(promises);
    this.metrics.batchesProcessed++;
  }

  /**
   * Execute commands in parallel with concurrency limit
   */
  private async executeInParallel<T extends ICommand, TResult = void>(
    commands: T[],
    concurrencyLimit: number
  ): Promise<TResult[]> {
    // Pre-sized so results[] preserves input order (indexed by original
    // command position), not completion order — commands can settle out of
    // order once concurrencyLimit forces interleaving.
    const results: TResult[] = new Array(commands.length);
    const executing: Promise<void>[] = [];

    for (let idx = 0; idx < commands.length; idx++) {
      const command = commands[idx] as T;
      const promise = this.executeWithResilience<T, TResult>(command).then(result => {
        results[idx] = result as TResult;
      });

      executing.push(promise);

      if (executing.length >= concurrencyLimit) {
        // Single indexed race replaces the former probe-race + index-race pair:
        // FIFO microtask ordering on an already-settled parent always yields
        // the lowest actually-settled index, so one race is sufficient. Do
        // NOT add a rejection handler here — a rejected command must still
        // abort this race (and executeInParallel) instead of being silently
        // swallowed into an unhandledRejection later.
        const completed = await Promise.race(executing.map((p, i) => p.then(() => i)));
        executing.splice(completed, 1);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Check if command supports batching
   */
  private supportsBatching(command: ICommand): boolean {
    // Can be extended with metadata or interface check
    return !Reflect.getMetadata('cqrs:no-batch', command.constructor);
  }

  /**
   * Check if object is validatable
   */
  private isValidatable(obj: unknown): obj is ICqrsValidatable {
    return (
      obj != null &&
      typeof obj === 'object' &&
      'validate' in obj &&
      typeof (obj as Record<string, unknown>).validate === 'function'
    );
  }

  /**
   * Clean expired cache entries
   */
  private cleanHandlerCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.handlerCache.entries()) {
      if (now - entry.resolvedAt > this.CACHE_TTL) {
        this.handlerCache.delete(key);
      }
    }

    // Enforce max size by removing oldest entries
    if (this.handlerCache.size > this.MAX_CACHE_SIZE) {
      const entries = [...this.handlerCache.entries()].sort(
        (a, b) => a[1].resolvedAt - b[1].resolvedAt
      );
      const toRemove = entries.slice(0, this.handlerCache.size - this.MAX_CACHE_SIZE);
      for (const [key] of toRemove) {
        this.handlerCache.delete(key);
      }
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      averageExecutionTime:
        this.metrics.executionCount > 0
          ? this.metrics.totalExecutionTime / this.metrics.executionCount
          : 0,
      cacheHitRate:
        this.metrics.cacheHits + this.metrics.cacheMisses > 0
          ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
          : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      executionCount: 0,
      totalExecutionTime: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      timeouts: 0,
      retries: 0,
      batchesProcessed: 0,
    };
  }

  /**
   * Evict all registered handlers and the handler cache, returning the bus to
   * a clean state. Use on DI module teardown (e.g. between test modules sharing
   * one bus instance) to drop handler factories bound to a destroyed scope.
   * Does not stop the cache-cleanup timer — use {@link dispose} for that.
   */
  reset(): void {
    this.handlerInstances.clear();
    this.handlerFactories.clear();
    this.handlerCache.clear();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.handlerCache.clear();
    this.batchQueue = [];
  }
}
