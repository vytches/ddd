/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { IDependencyContainer, ServiceToken } from '@vytches/ddd-di';
import type { ResilienceStrategy } from '@vytches/ddd-resilience';
import {
  BulkheadStrategy,
  CircuitBreakerStrategy,
  CompositeResilienceStrategy,
  DefaultResilienceContext,
  RetryStrategy,
  TimeoutStrategy,
} from '@vytches/ddd-resilience';
import 'reflect-metadata';
import { ICommandBus } from '../abstracts';
import { HandlerNotFoundError } from '../errors';
import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext, LoggingMiddleware } from '../middleware';
import type { ICqrsValidatable } from '../validation';

/**
 * Configuration options for enhanced command bus
 */
export interface EnhancedCommandBusOptions {
  enableMetrics?: boolean;
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
      halfOpenMaxAttempts?: number;
    };
    retry?: {
      enabled?: boolean;
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
      backoffMultiplier?: number;
    };
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
 */
export class EnhancedCommandBus extends ICommandBus {
  // Core properties
  private middlewares: ICQRSMiddleware[] = [];
  private handlers = new Map<
    string,
    ICommandHandler<ICommand, unknown> | (() => ICommandHandler<ICommand, unknown>)
  >();

  // Performance optimization: Handler cache
  private handlerCache = new Map<string, CachedHandler>();
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
    this.cacheEnabled = options.enableCache ?? true;
    this.batchingEnabled = options.enableBatching ?? false;
    this.maxBatchSize = options.maxBatchSize ?? 10;
    this.batchDelayMs = options.batchDelayMs ?? 100;

    // Setup resilience patterns
    this.setupResilience(options.resilience);

    // Add default logging middleware if metrics enabled
    if (options.enableMetrics !== false) {
      this.use(new LoggingMiddleware());
    }

    // Clean cache periodically
    if (this.cacheEnabled) {
      this.cacheCleanupInterval = setInterval(() => this.cleanHandlerCache(), this.CACHE_TTL);
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
    if (config?.retry?.enabled === true) {
      strategies.push(
        new RetryStrategy({
          maxAttempts: config?.retry?.maxAttempts ?? this.maxRetries,
          baseDelay: config?.retry?.baseDelay ?? 1000,
          maxDelay: config?.retry?.maxDelay ?? 30000,
          backoffMultiplier: config?.retry?.backoffMultiplier ?? 2,
          jitter: false,
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

    // Update retry configuration
    this.options = {
      ...this.options,
      defaultRetries: maxRetries,
      resilience: {
        ...this.options?.resilience,
        retry: {
          ...this.options?.resilience?.retry,
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
    const commandName =
      typeof commandType === 'string' ? commandType : (commandType as Function).name;

    this.handlers.set(commandName, handler as ICommandHandler<ICommand, unknown>);
    // Clear cache for this command type
    this.handlerCache.delete(commandName);
  }

  /**
   * Register factory for lazy handler initialization
   */
  registerFactory<T extends ICommand, TResult = void>(
    commandType: unknown,
    factory: () => ICommandHandler<T, TResult>
  ): void {
    const commandName =
      typeof commandType === 'string' ? commandType : (commandType as Function).name;

    this.handlers.set(commandName, factory as () => ICommandHandler<ICommand, unknown>);
    this.handlerCache.delete(commandName);
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
    const commandName = command.constructor.name;

    try {
      // Get handler (with caching)
      const handler = await this.resolveHandler<T, TResult>(commandName, command.constructor);

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
   * Resolve handler with caching
   */
  private async resolveHandler<T extends ICommand, TResult = void>(
    commandName: string,
    commandClass: Function
  ): Promise<ICommandHandler<T, TResult>> {
    // Check cache first
    if (this.cacheEnabled) {
      const cached = this.handlerCache.get(commandName);
      if (cached && Date.now() - cached.resolvedAt < this.CACHE_TTL) {
        this.metrics.cacheHits++;
        return cached.handler as ICommandHandler<T, TResult>;
      }
    }

    this.metrics.cacheMisses++;

    // Check manual registrations
    const registered = this.handlers.get(commandName);
    if (registered) {
      const handler =
        typeof registered === 'function' && !('execute' in registered)
          ? (registered as () => ICommandHandler<T, TResult>)()
          : (registered as ICommandHandler<T, TResult>);

      // Cache the resolved handler
      if (this.cacheEnabled) {
        this.handlerCache.set(commandName, {
          handler: handler as ICommandHandler<ICommand, void>,
          resolvedAt: Date.now(),
        });
      }

      return handler;
    }

    // Resolve from DI container
    try {
      const handlerToken = this.getHandlerToken(commandClass) as ServiceToken<
        ICommandHandler<T, TResult>
      >;
      const handler = this.container.resolve<ICommandHandler<T, TResult>>(handlerToken);

      // Cache the resolved handler
      if (this.cacheEnabled) {
        this.handlerCache.set(commandName, {
          handler: handler as ICommandHandler<ICommand, void>,
          resolvedAt: Date.now(),
        });
      }

      return handler;
    } catch {
      throw new HandlerNotFoundError(commandName, 'command');
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
    const results: TResult[] = [] as TResult[];
    const executing: Promise<void>[] = [];

    for (const command of commands) {
      const promise = this.executeWithResilience<T, TResult>(command).then(result => {
        results.push(result as TResult);
      });

      executing.push(promise);

      if (executing.length >= concurrencyLimit) {
        await Promise.race(executing);
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
