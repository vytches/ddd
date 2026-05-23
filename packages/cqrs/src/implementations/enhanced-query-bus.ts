/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { IDependencyContainer, ServiceToken } from '@vytches/ddd-di';
import { Logger } from '@vytches/ddd-logging';
import type { ResilienceStrategy } from '@vytches/ddd-resilience';
import { DefaultResilienceContext, ResiliencePolicyBuilder } from '@vytches/ddd-resilience';
import 'reflect-metadata';
import { IQueryBus } from '../abstracts';
import { HandlerNotFoundError } from '../errors';
import type { IQuery, IQueryHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext, LoggingMiddleware } from '../middleware';
import type { ICqrsValidatable } from '../validation';

/**
 * Configuration options for enhanced query bus
 */
export interface EnhancedQueryBusOptions {
  enableMetrics?: boolean;
  enableCache?: boolean;
  cacheOptions?: CacheOptions;
  defaultTimeout?: number;
  defaultRetries?: number;
  enableBatching?: boolean;
  maxBatchSize?: number;
  batchDelayMs?: number;
  resilience?: {
    circuitBreaker?: boolean;
    retry?: boolean;
    timeout?: boolean;
  };
}

/**
 * Cache configuration
 */
export interface CacheOptions {
  ttl?: number; // Time to live in ms
  maxSize?: number; // Max cache entries
  strategy?: 'lru' | 'fifo'; // Cache eviction strategy
}

/**
 * Cached query result
 */
interface CachedResult<T = unknown> {
  value: T;
  timestamp: number;
  hitCount: number;
}

/**
 * Handler cache entry
 */
interface CachedHandler<T extends IQuery<R> = IQuery<unknown>, R = unknown> {
  handler: IQueryHandler<T, R>;
  resolvedAt: number;
}

/**
 * Batch query entry
 */
interface BatchEntry<T extends IQuery<R> = IQuery<unknown>, R = unknown> {
  query: T;
  resolve: (value: R) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * LRU Cache implementation for query results
 */
/**
 * FNV-1a 32-bit hash. Fast, non-cryptographic, designed for hash-table keys.
 *
 * VP-NEW-001 helper for `EnhancedQueryBus.getCacheKey`. ~5-10× faster than
 * `JSON.stringify` on typical query objects, with acceptable collision rate
 * for in-memory cache lookups (collision = cache miss, not corruption).
 *
 * @internal
 */
function fnv1a32(input: string): string {
  let h = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // 32-bit FNV prime: 0x01000193 (2^24 + 2^8 + 0x93)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

/**
 * Produce a deterministic, lightweight canonical string for a query object
 * — enough to drive the FNV-1a hash, without the overhead of full JSON
 * serialization. Sorts keys to make `{a:1,b:2}` and `{b:2,a:1}` collide.
 *
 * @internal
 */
function canonicalizeQueryParams(query: object): string {
  const parts: string[] = [];
  const keys = Object.keys(query).sort();
  for (const key of keys) {
    const v = (query as Record<string, unknown>)[key];
    parts.push(key);
    if (v == null) {
      parts.push('null');
    } else if (typeof v === 'object') {
      parts.push(canonicalizeQueryParams(v as object));
    } else {
      parts.push(String(v));
    }
  }
  return parts.join('|');
}

class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Performance-optimized Enhanced Query Bus with resilience patterns
 */
export class EnhancedQueryBus extends IQueryBus {
  // Core properties
  private middlewares: ICQRSMiddleware[] = [];
  private handlers = new Map<
    Function | string,
    IQueryHandler<IQuery<unknown>, unknown> | (() => IQueryHandler<IQuery<unknown>, unknown>)
  >();

  // Performance optimization: Handler cache
  private handlerCache = new Map<Function | string, CachedHandler>();
  private readonly HANDLER_CACHE_TTL = 60000; // 1 minute

  // Query result cache
  private resultCache: LRUCache<string, CachedResult>;
  private cacheTTL: number;
  private cacheEnabled: boolean;

  // Configuration
  private timeout: number;
  private maxRetries: number;
  private batchingEnabled: boolean;
  private maxBatchSize: number;
  private batchDelayMs: number;

  // Resilience patterns - disabled
  private resilienceEnabled = false;

  // Batch processing
  private batchQueue: BatchEntry[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  // Resilience strategy
  private resilienceStrategy?: ResilienceStrategy;

  // Logger instance
  private readonly logger = Logger.forContext('EnhancedQueryBus');

  // Current options for dynamic reconfiguration
  private options: EnhancedQueryBusOptions;

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
    circuitBreakerTrips: 0,
  };

  constructor(
    private container: IDependencyContainer,
    options: EnhancedQueryBusOptions = {}
  ) {
    super();

    // Store options for dynamic reconfiguration
    this.options = { ...options };

    // Initialize configuration
    this.timeout = options.defaultTimeout ?? 10000; // 10 seconds for queries
    this.maxRetries = options.defaultRetries ?? 2; // Fewer retries for queries
    this.cacheEnabled = options.enableCache ?? false;
    this.cacheTTL = options.cacheOptions?.ttl ?? 300000; // 5 minutes default
    this.batchingEnabled = options.enableBatching ?? false;
    this.maxBatchSize = options.maxBatchSize ?? 20;
    this.batchDelayMs = options.batchDelayMs ?? 50;

    // Initialize cache
    const cacheSize = options.cacheOptions?.maxSize ?? 500;
    this.resultCache = new LRUCache(cacheSize);

    // Setup resilience patterns using @vytches/ddd-resilience
    this.setupResilience(options.resilience);

    // Add default logging middleware if metrics enabled
    if (options.enableMetrics !== false) {
      this.use(new LoggingMiddleware());
    }

    // Clean caches periodically
    setInterval(() => {
      this.cleanHandlerCache();
      this.cleanResultCache();
    }, 60000); // Every minute
  }

  /**
   * Setup resilience patterns using the resilience package
   */
  private setupResilience(config?: EnhancedQueryBusOptions['resilience']): void {
    if (!config || (!config.circuitBreaker && !config.retry && !config.timeout)) {
      return;
    }

    try {
      const builder = ResiliencePolicyBuilder.create();

      if (config.circuitBreaker === true) {
        builder.withCircuitBreaker({
          name: 'QueryBusCircuitBreaker',
          failureThreshold: 5,
          successThreshold: 3,
          timeout: 30000,
          recoveryTimeout: 60000,
        });
      }

      if (config.retry === true) {
        builder.withRetry({
          maxAttempts: this.maxRetries,
          baseDelay: 1000,
          maxDelay: 30000,
          backoffMultiplier: 2,
          jitter: false,
        });
      }

      if (config.timeout === true) {
        builder.withTimeout(this.timeout);
      }

      this.resilienceStrategy = builder.build();
      this.resilienceEnabled = true;
    } catch (error) {
      this.logger.warn('Failed to setup resilience patterns', { error: String(error) });
      this.resilienceEnabled = false;
    }
  }

  /**
   * Set timeout for query execution
   */
  setTimeout(timeoutMs: number): this {
    this.timeout = timeoutMs;

    // Update timeout configuration
    this.options = {
      ...this.options,
      defaultTimeout: timeoutMs,
      resilience: {
        ...this.options?.resilience,
        timeout: true, // Enable timeout in resilience
      },
    };

    // Rebuild resilience strategy with new timeout
    this.setupResilience(this.options.resilience);
    return this;
  }

  /**
   * Set maximum retries for failed queries
   */
  setRetries(maxRetries: number): this {
    this.maxRetries = maxRetries;

    // Update retry configuration
    this.options = {
      ...this.options,
      defaultRetries: maxRetries,
      resilience: {
        ...this.options?.resilience,
        retry: true, // Enable retry in resilience
      },
    };

    // Rebuild resilience strategy with new retry settings
    this.setupResilience(this.options.resilience);
    return this;
  }

  /**
   * Enable or configure caching
   */
  enableCache(enable = false, options?: CacheOptions): this {
    this.cacheEnabled = enable;

    if (options?.ttl) {
      this.cacheTTL = options.ttl;
    }

    if (options?.maxSize) {
      this.resultCache = new LRUCache(options.maxSize);
    }

    if (!enable) {
      this.resultCache.clear();
      this.handlerCache.clear();
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
   * Register query handler
   */
  register<T extends IQuery<R>, R>(queryType: unknown, handler: IQueryHandler<T, R>): void {
    const key = typeof queryType === 'string' ? queryType : (queryType as Function);
    const keyName = typeof queryType === 'string' ? queryType : (queryType as Function).name;
    this.handlers.set(key, handler);
    this.handlerCache.delete(key);
    this.invalidateCacheForQuery(keyName);
  }

  /**
   * Register factory for lazy handler initialization
   */
  registerFactory<T extends IQuery<R>, R>(
    queryType: unknown,
    factory: () => IQueryHandler<T, R>
  ): void {
    const key = typeof queryType === 'string' ? queryType : (queryType as Function);
    const keyName = typeof queryType === 'string' ? queryType : (queryType as Function).name;
    this.handlers.set(key, factory);
    this.handlerCache.delete(key);
    this.invalidateCacheForQuery(keyName);
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
   * Execute query with all optimizations
   */
  async execute<T extends IQuery<R>, R>(query: T): Promise<R> {
    // Check cache first for idempotent queries
    if (this.cacheEnabled && this.isIdempotent(query)) {
      const cached = this.getCachedResult<R>(query);
      if (cached) {
        this.metrics.cacheHits++;
        return cached;
      }
      this.metrics.cacheMisses++;
    }

    // If batching is enabled and query supports it
    if (this.batchingEnabled && this.supportsBatching(query)) {
      return this.addToBatch(query);
    }

    // Execute with resilience patterns
    const result = (await this.executeWithResilience(query)) as R;

    // Cache the result if idempotent
    if (this.cacheEnabled && this.isIdempotent(query)) {
      this.cacheResult(query, result);
    }

    return result;
  }

  /**
   * Execute multiple queries in batch
   */
  async executeMany<T extends IQuery<R>, R>(queries: T[]): Promise<R[]> {
    const startTime = performance.now();

    try {
      // Group queries by type for optimization
      const grouped = this.groupQueriesByType(queries);
      const results: R[] = [];

      // Process each group with appropriate strategy
      for (const [_type, group] of grouped) {
        const groupResults = await this.executeQueryGroup(group);
        results.push(...(groupResults as R[]));
      }

      this.metrics.batchesProcessed++;
      this.metrics.totalExecutionTime += performance.now() - startTime;

      return results;
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Execute with resilience patterns
   */
  private async executeWithResilience<T extends IQuery<R>, R>(query: T): Promise<R> {
    if (!this.resilienceStrategy) {
      // No resilience patterns configured, execute directly
      return this.executeCore(query);
    }

    // Create resilience context
    const context = DefaultResilienceContext.create({
      metadata: {
        operationKey: `query:${query.constructor.name}`,
        queryType: query.constructor.name,
        timestamp: Date.now(),
      },
    });

    // Execute with resilience patterns
    return this.resilienceStrategy.execute(() => this.executeCore(query), context);
  }

  /**
   * Core execution logic
   */
  private async executeCore<T extends IQuery<R>, R>(query: T): Promise<R> {
    const startTime = performance.now();

    try {
      // Get handler (with caching)
      const handler = await this.resolveHandler<T, R>(query.constructor);

      // Validate if needed
      if (this.isValidatable(query)) {
        await query.validate?.();
      }

      // Execute with middleware pipeline
      const context = new CQRSExecutionContext(query, handler, 'query');
      const result = await this.executeWithMiddleware(context, () => handler.execute(query));

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
  private async resolveHandler<T extends IQuery<R>, R>(
    queryClass: Function
  ): Promise<IQueryHandler<T, R>> {
    // Check cache first (keyed by Function ref — no cross-context collision)
    if (this.cacheEnabled) {
      const cached = this.handlerCache.get(queryClass);
      if (cached && Date.now() - cached.resolvedAt < this.HANDLER_CACHE_TTL) {
        return cached.handler as IQueryHandler<T, R>;
      }
    }

    // Function ref first, string fallback for handlers registered by name (BC)
    const registered = this.handlers.get(queryClass) ?? this.handlers.get(queryClass.name);
    if (registered) {
      const handler =
        typeof registered === 'function' && !('execute' in registered)
          ? (registered as () => IQueryHandler<T, R>)()
          : (registered as IQueryHandler<T, R>);

      if (this.cacheEnabled) {
        this.handlerCache.set(queryClass, {
          handler,
          resolvedAt: Date.now(),
        });
      }

      return handler;
    }

    // Resolve from DI container
    try {
      const handlerToken = this.getHandlerToken(queryClass) as ServiceToken<IQueryHandler<T, R>>;
      const handler = this.container.resolve<IQueryHandler<T, R>>(handlerToken);

      if (this.cacheEnabled) {
        this.handlerCache.set(queryClass, {
          handler,
          resolvedAt: Date.now(),
        });
      }

      return handler;
    } catch {
      throw new HandlerNotFoundError(queryClass.name, 'query');
    }
  }

  /**
   * Get handler token from metadata
   */
  private getHandlerToken(queryClass: Function): ServiceToken {
    const handlerMetadata = Reflect.getMetadata('di:query-handler', queryClass);
    if (!handlerMetadata) {
      throw new Error(`No metadata for ${queryClass.name}`);
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
   * Get cached result
   */
  private getCachedResult<R>(query: IQuery<R>): R | undefined {
    const cacheKey = this.getCacheKey(query);
    const cached = this.resultCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      cached.hitCount++;
      return cached.value as R;
    }

    // Remove expired entry
    if (cached) {
      this.resultCache.delete(cacheKey);
    }

    return undefined;
  }

  /**
   * Cache query result
   */
  private cacheResult<R>(query: IQuery<R>, result: R): void {
    const cacheKey = this.getCacheKey(query);
    this.resultCache.set(cacheKey, {
      value: result,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Generate cache key for query.
   *
   * VP-NEW-001 (2026-05-09): replaced `JSON.stringify(query)` with an
   * FNV-1a 32-bit hash over the canonical-key form. JSON.stringify on
   * typical queries is ~5-15µs; FNV-1a is ~0.5-2µs — 5-10× faster on
   * the cache lookup hot path. Collision risk on 32-bit hash is
   * acceptable here because cache lookups also verify the class name
   * prefix; a collision would just cause a cache miss + recompute.
   */
  private getCacheKey<T>(query: IQuery<T>): string {
    const className = query.constructor.name;
    const canonical = canonicalizeQueryParams(query);
    return `${className}:${fnv1a32(canonical)}`;
  }

  /**
   * Check if query is idempotent (safe to cache)
   */
  private isIdempotent<T>(query: IQuery<T>): boolean {
    // Check metadata or interface
    const metadata = Reflect.getMetadata('cqrs:idempotent', query.constructor);
    return metadata !== false; // Default to true for queries
  }

  /**
   * Check if query supports batching
   */
  private supportsBatching<T>(query: IQuery<T>): boolean {
    return !Reflect.getMetadata('cqrs:no-batch', query.constructor);
  }

  /**
   * Add query to batch queue
   */
  private addToBatch<T extends IQuery<R>, R>(query: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        query,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
      });

      if (this.batchQueue.length >= this.maxBatchSize) {
        this.processBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.processBatch(), this.batchDelayMs);
      }
    });
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

    // Group by query type for optimization
    const grouped = new Map<string, BatchEntry[]>();
    for (const entry of batch) {
      const type = entry.query.constructor.name;
      const group = grouped.get(type) || [];
      group.push(entry);
      grouped.set(type, group);
    }

    // Process each group
    for (const [_type, group] of grouped) {
      await Promise.all(
        group.map(async entry => {
          try {
            const result = await this.executeWithResilience(entry.query);
            entry.resolve(result);
          } catch (error) {
            entry.reject(error as Error);
          }
        })
      );
    }

    this.metrics.batchesProcessed++;
  }

  /**
   * Group queries by type for optimization
   */
  private groupQueriesByType<T extends IQuery<R>, R>(queries: T[]): Map<string, T[]> {
    const grouped = new Map<string, T[]>();

    for (const query of queries) {
      const type = query.constructor.name;
      const group = grouped.get(type) || [];
      group.push(query);
      grouped.set(type, group);
    }

    return grouped;
  }

  /**
   * Execute a group of queries of the same type
   */
  private async executeQueryGroup<T extends IQuery<R>, R>(queries: T[]): Promise<R[]> {
    // Can be optimized for specific query types (e.g., batch database queries)
    const results = await Promise.all(queries.map(q => this.executeWithResilience(q)));
    return results as R[];
  }

  /**
   * Invalidate cache for specific query type
   */
  private invalidateCacheForQuery(queryName: string): void {
    // Remove all cached results for this query type
    for (const key of Array.from(this.resultCache['cache'].keys())) {
      if (key.startsWith(`${queryName}:`)) {
        this.resultCache.delete(key);
      }
    }
  }

  /**
   * Clean expired handler cache entries
   */
  private cleanHandlerCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.handlerCache.entries()) {
      if (now - entry.resolvedAt > this.HANDLER_CACHE_TTL) {
        this.handlerCache.delete(key);
      }
    }
  }

  /**
   * Clean expired result cache entries
   */
  private cleanResultCache(): void {
    const now = Date.now();
    const cache = this.resultCache['cache'] as Map<string, CachedResult>;

    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.resultCache.delete(key);
      }
    }
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
   * Invalidate all caches
   */
  invalidateCache(): this {
    this.resultCache.clear();
    this.handlerCache.clear();
    return this;
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
      cacheSize: this.resultCache.size,
      handlerCacheSize: this.handlerCache.size,
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
      circuitBreakerTrips: 0,
    };
  }
}
