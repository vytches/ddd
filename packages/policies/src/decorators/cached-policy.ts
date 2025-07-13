import type { Result } from '@vytches-ddd/utils';
import type {
  IBusinessPolicy,
  PolicyRequest,
  IPolicyComposer,
  IPolicyConditionalBuilder,
  PolicyCondition,
} from '../core/interfaces/business-policy.interface';
import type { PolicyViolation } from '../core/models/policy-violation';

/**
 * Configuration for policy-specific caching
 * Domain-focused - NOT generic abstraction
 */
export interface PolicyCacheConfig {
  /**
   * Time to live in milliseconds for cached policy results
   */
  ttl: number;

  /**
   * Custom key generator for cache entries
   * Generates cache key from entity and context
   */
  keyGenerator?: (request: PolicyRequest<unknown>) => string;

  /**
   * Cache namespace/prefix for this policy
   */
  namespace?: string;

  /**
   * Maximum number of cache entries for this policy
   */
  maxSize?: number;

  /**
   * Whether to cache failure results (violations)
   */
  cacheFailures?: boolean;

  /**
   * Whether to enable cache metrics collection
   */
  enableMetrics?: boolean;
}

/**
 * Simple in-memory cache entry
 */
interface CacheEntry<T> {
  result: Result<T, PolicyViolation>;
  timestamp: Date;
  ttl: number;
}

/**
 * Simple in-memory cache implementation for policies
 * Enterprise-ready with TTL, size limits, and metrics
 */
class PolicyCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    entries: 0,
  };

  /**
   * Get cached result if valid
   */
  public get<T>(key: string): Result<T, PolicyViolation> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    // Check TTL
    const now = new Date();
    const age = now.getTime() - entry.timestamp.getTime();

    if (age > entry.ttl) {
      this.cache.delete(key);
      this.metrics.evictions++;
      this.metrics.entries--;
      this.metrics.misses++;
      return null;
    }

    this.metrics.hits++;
    return entry.result;
  }

  /**
   * Set cache entry with TTL
   */
  public set<T>(
    key: string,
    result: Result<T, PolicyViolation>,
    ttl: number,
    maxSize?: number
  ): void {
    // Enforce max size by removing oldest entries
    if (maxSize && this.cache.size >= maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.metrics.evictions++;
        this.metrics.entries--;
      }
    }

    this.cache.set(key, {
      result,
      timestamp: new Date(),
      ttl,
    });
    this.metrics.entries++;
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.metrics.entries = 0;
  }

  /**
   * Get cache metrics
   */
  public getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.cache.size;
  }
}

/**
 * Cached policy behavior - wraps another policy with caching
 * Policy-specific implementation - NOT generic abstraction
 */
export class PolicyCachingBehavior<T> implements IBusinessPolicy<T> {
  private readonly cache = new PolicyCache();

  public readonly id: string;
  public readonly domain: string;
  public readonly name: string;

  constructor(
    private readonly innerPolicy: IBusinessPolicy<T>,
    private readonly config: PolicyCacheConfig
  ) {
    this.id = `cached_${innerPolicy.id}`;
    this.domain = innerPolicy.domain;
    this.name = `Cached ${innerPolicy.name}`;
  }

  /**
   * Check policy with caching
   */
  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const cacheKey = this.generateCacheKey(request);

    // Try cache first
    const cached = this.cache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Execute actual policy
    const result = await this.innerPolicy.check(request);

    // Cache result if enabled and TTL > 0
    const shouldCache = (this.config.cacheFailures || result.isSuccess) && this.config.ttl > 0;
    if (shouldCache) {
      this.cache.set(cacheKey, result, this.config.ttl, this.config.maxSize);
    }

    return result;
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: PolicyRequest<T>): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(request);
    }

    // Default key generation
    const namespace = this.config.namespace || this.innerPolicy.id;

    // Handle circular references and other serialization issues
    let entityKey: string;
    try {
      entityKey = JSON.stringify(request.entity);
    } catch (_error) {
      // Fallback for circular references or other serialization issues
      entityKey = this.generateFallbackKey(request.entity);
    }

    const contextKey = `${request.context.userId}_${request.context.tenantId || ''}_${request.context.environment}`;

    return `${namespace}:${contextKey}:${this.hashString(entityKey)}`;
  }

  /**
   * Generate fallback key for entities that can't be JSON stringified
   */
  private generateFallbackKey(entity: unknown): string {
    const seen = new WeakSet();

    const stringify = (obj: unknown, depth = 0): string => {
      if (depth > 5) return '[MAX_DEPTH]';

      if (obj === null) return 'null';
      if (obj === undefined) return 'undefined';

      const type = typeof obj;
      if (type === 'string' || type === 'number' || type === 'boolean') {
        return String(obj);
      }

      if (obj instanceof Date) {
        return obj.toISOString();
      }

      if (type === 'object' && obj !== null) {
        if (seen.has(obj)) {
          return '[Circular]';
        }
        seen.add(obj);

        if (Array.isArray(obj)) {
          return `[${obj.map(item => stringify(item, depth + 1)).join(',')}]`;
        }

        const keys = Object.keys(obj).sort();
        const pairs = keys.map(
          key => `${key}:${stringify((obj as Record<string, unknown>)[key], depth + 1)}`
        );
        return `{${pairs.join(',')}}`;
      }

      return String(obj);
    };

    return stringify(entity);
  }

  /**
   * Simple string hash for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Clear cache for this policy
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache metrics
   */
  public getCacheMetrics(): ReturnType<PolicyCache['getMetrics']> {
    return this.cache.getMetrics();
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.cache.size();
  }

  // Implement IBusinessPolicy interface

  public and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return this.innerPolicy.and(other);
  }

  public or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    return this.innerPolicy.or(other);
  }

  public not(): IBusinessPolicy<T> {
    return new PolicyCachingBehavior(this.innerPolicy.not(), this.config);
  }

  public when(condition: PolicyCondition<T>): IPolicyConditionalBuilder<T> {
    return this.innerPolicy.when(condition);
  }

  /**
   * Create cached policy decorator
   */
  public static create<T>(
    policy: IBusinessPolicy<T>,
    config: PolicyCacheConfig
  ): PolicyCachingBehavior<T> {
    return new PolicyCachingBehavior(policy, config);
  }

  /**
   * Create cached policy with default configuration
   */
  public static withDefaults<T>(
    policy: IBusinessPolicy<T>,
    ttl = 300000 // 5 minutes default
  ): PolicyCachingBehavior<T> {
    return new PolicyCachingBehavior(policy, {
      ttl,
      cacheFailures: false,
      enableMetrics: true,
      maxSize: 1000,
    });
  }
}

/**
 * Factory for creating cached policies
 */
export class PolicyCachingBehaviorFactory {
  /**
   * Create cached policy with TTL
   */
  public static withTTL<T>(policy: IBusinessPolicy<T>, ttlMs: number): PolicyCachingBehavior<T> {
    return PolicyCachingBehavior.create(policy, {
      ttl: ttlMs,
      cacheFailures: false,
    });
  }

  /**
   * Create cached policy for expensive operations
   */
  public static forExpensivePolicy<T>(
    policy: IBusinessPolicy<T>,
    options: {
      ttl?: number;
      maxSize?: number;
      cacheFailures?: boolean;
    } = {}
  ): PolicyCachingBehavior<T> {
    const cachedPolicy = PolicyCachingBehavior.create(policy, {
      ttl: options.ttl || 600000, // 10 minutes for expensive operations
      maxSize: options.maxSize || 500,
      cacheFailures: options.cacheFailures || true, // Cache failures for expensive ops
      enableMetrics: true,
      namespace: `expensive_${policy.id}`,
    });
    // Override the ID to include expensive prefix
    // Override the ID to include expensive prefix
    Object.defineProperty(cachedPolicy, 'id', {
      value: `expensive_cached_${policy.id}`,
      writable: false,
      enumerable: true,
      configurable: false,
    });
    return cachedPolicy;
  }

  /**
   * Create cached policy with custom key generation
   */
  public static withCustomKey<T>(
    policy: IBusinessPolicy<T>,
    keyGenerator: (request: PolicyRequest<unknown>) => string,
    ttl = 300000
  ): PolicyCachingBehavior<T> {
    return PolicyCachingBehavior.create(policy, {
      ttl,
      keyGenerator,
      enableMetrics: true,
    });
  }
}
