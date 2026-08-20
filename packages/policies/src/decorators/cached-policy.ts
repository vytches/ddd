import type { Result } from '@vytches/ddd-utils';
import type {
  IBusinessPolicy,
  IPolicyComposer,
  IPolicyConditionalBuilder,
  PolicyCondition,
  PolicyRequest,
} from '../core/interfaces/business-policy.interface';
import type { PolicyViolation } from '../core/models/policy-violation';

export interface PolicyCacheConfig {
  /**
   * Time to live in milliseconds for cached policy results
   */
  ttl: number;

  /**
   * Custom key generator for cache entries.
   *
   * This is the preferred way to cache by aggregate identity (e.g.
   * `request => \`${aggregateId}:${version}\``). It gives full control
   * over the cache key and avoids the cost of serialising the entire entity.
   *
   * The default serialisation (`JSON.stringify(entity)`) is a fallback that
   * works for plain objects but may be unstable for aggregates with value
   * objects, transient fields, or circular references. Provide `keyGenerator`
   * whenever your entity has a natural identity.
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
   * Whether to cache failure results (violations).
   *
   * WARNING: Caching negative (deny) results in authorisation policies is
   * dangerous. A revocation decision (e.g. blacklisting a user or revoking a
   * role) will not take effect until the cached entry expires. This means an
   * entity that should receive `deny` continues to receive a stale `allow`
   * for up to `ttl` milliseconds after the policy is updated. Only enable
   * this for non-security policies or when staleness is explicitly acceptable.
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
 * Node in the doubly-linked list used for O(1) LRU tracking.
 */
interface LruNode {
  key: string;
  prev: LruNode | null;
  next: LruNode | null;
}

/**
 * Simple in-memory cache implementation for policies.
 * Enterprise-ready with TTL, size limits, and metrics.
 *
 * LRU eviction is O(1) — implemented as a Map + doubly-linked list so that
 * both insertion and access update the MRU position in constant time.
 */
class PolicyCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  // Doubly-linked list for O(1) LRU tracking.
  // `lruHead` = least recently used (eviction candidate)
  // `lruTail` = most recently used
  private lruNodes = new Map<string, LruNode>();
  private lruHead: LruNode | null = null;
  private lruTail: LruNode | null = null;

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
    const now = Date.now();
    const age = now - entry.timestamp.getTime();

    if (age > entry.ttl) {
      this.removeNode(key);
      this.cache.delete(key);
      this.metrics.evictions++;
      this.metrics.entries--;
      this.metrics.misses++;
      return null;
    }

    // Move to MRU position (O(1) LRU refresh on hit)
    this.touchNode(key);

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
    // Enforce max size by evicting the least recently used entry (O(1))
    if (maxSize && this.cache.size >= maxSize) {
      const lruKey = this.lruHead?.key;
      if (lruKey !== undefined) {
        this.removeNode(lruKey);
        this.cache.delete(lruKey);
        this.metrics.evictions++;
        this.metrics.entries--;
      }
    }

    this.cache.set(key, {
      result,
      timestamp: new Date(),
      ttl,
    });
    this.addNode(key);
    this.metrics.entries++;
  }

  /**
   * Clear all cache entries
   */
  public clear(): void {
    this.cache.clear();
    this.lruNodes.clear();
    this.lruHead = null;
    this.lruTail = null;
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

  // --- LRU linked-list helpers ---

  /** Append a new node for `key` at the MRU tail. */
  private addNode(key: string): void {
    const node: LruNode = { key, prev: this.lruTail, next: null };
    if (this.lruTail) {
      this.lruTail.next = node;
    } else {
      this.lruHead = node;
    }
    this.lruTail = node;
    this.lruNodes.set(key, node);
  }

  /** Move existing node for `key` to MRU tail. */
  private touchNode(key: string): void {
    const node = this.lruNodes.get(key);
    if (!node || node === this.lruTail) return; // already MRU

    // Detach from current position
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (this.lruHead === node) this.lruHead = node.next;

    // Append at tail
    node.prev = this.lruTail;
    node.next = null;
    if (this.lruTail) this.lruTail.next = node;
    this.lruTail = node;
  }

  /** Remove node for `key` from the linked list. */
  private removeNode(key: string): void {
    const node = this.lruNodes.get(key);
    if (!node) return;

    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (this.lruHead === node) this.lruHead = node.next;
    if (this.lruTail === node) this.lruTail = node.prev;

    this.lruNodes.delete(key);
  }
}

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
    const cacheKey = await this.generateCacheKey(request);

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
   * Generate cache key for request.
   *
   * When `keyGenerator` is provided it is used as-is (consumer override).
   * Otherwise the default key hashes the full context (userId + tenantId +
   * environment) and entity serialisation through SHA-256 so that no raw PII
   * is materialised as a plain-text Map key.
   *
   * Uses `globalThis.crypto.subtle` (Web Crypto) instead of `node:crypto` to
   * remain compatible with platform-agnostic bundles (Vite externalises
   * `node:` builtins for browser-compat builds).
   *
   * R1 (VP-012c): context and entity are hashed through a single `hashString`
   * call over a combined, length-prefixed buffer instead of two separate
   * `hashString` calls. This is a mechanical reduction of digest invocations
   * only (2 → 1) — the digest primitive itself is unchanged (still SHA-256,
   * still the 128-bit prefix from `hashString`, see its doc comment). A
   * cross-user collision on the same cached entity requires colliding only
   * `contextHash` under the previous two-call scheme (F7); merging into one
   * digest over both fields removes that narrower collision surface without
   * weakening the hash itself.
   */
  private async generateCacheKey(request: PolicyRequest<T>): Promise<string> {
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

    // F4: hash the full context string so that raw userId/tenantId are not
    // materialised as plain text in the in-memory Map keys.
    // Use NUL (\x00) as the field separator — it cannot appear in normal
    // identifiers, so it removes the delimiter ambiguity a printable separator
    // would allow (e.g. userId "a_b" + tenant "c" vs "a" + "b_c").
    const contextRaw = `${request.context.userId}\x00${request.context.tenantId || ''}\x00${request.context.environment}`;

    // R1 (VP-012c): single hashString() call over a length-prefixed combined
    // buffer, replacing the former two separate calls (contextHash +
    // entityHash). NUL cannot be reused as the context/entity boundary here —
    // it is already the internal field separator *inside* contextRaw (line
    // above), so a bare NUL boundary would let an attacker shift bytes across
    // the context/entity split (e.g. move a trailing NUL-delimited context
    // field into the entity portion, or vice versa) while still landing on
    // the same combined buffer and colliding the cache key. A decimal
    // length-prefix of contextRaw is unambiguous regardless of which bytes
    // (including NUL) appear inside contextRaw or entityKey: the parser reads
    // digits up to the ':' separator, consumes exactly that many bytes as the
    // context, and treats everything after as the entity — there is no value
    // of contextRaw that can be crafted to produce the same combined buffer
    // as a different (context, entity) pair.
    const combined = `${contextRaw.length}:${contextRaw}${entityKey}`;
    const combinedHash = await this.hashString(combined);

    return `${namespace}:${combinedHash}`;
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
   * Hash a string using SHA-256 (Web Crypto) and return the first 32 hex
   * characters (128-bit prefix). This replaces the former djb2 implementation
   * which had a 32-bit effective space (~2³¹ after Math.abs) causing
   * birthday collisions at ~65k entries per namespace/context.
   *
   * `globalThis.crypto.subtle` is used rather than `node:crypto` to avoid
   * Vite externalization issues in browser-compat builds. Available on
   * Node.js >= 19 (standard, no import needed); `engines.node >= 22.19.0`
   * guarantees availability.
   *
   * Async because `subtle.digest` returns a Promise.
   *
   * NON-GOAL (VP-012c / D3, binding): do NOT replace this primitive with
   * FNV-1a, djb2, or any other non-cryptographic hash in the name of "hot
   * path optimisation". That substitution was evaluated and rejected — a
   * 32-bit non-cryptographic hash collides cheaply (birthday bound ~2^16
   * entries), and because this hash forms authorization cache keys
   * (`CachedPolicy`/`PolicyCachingBehavior.generateCacheKey`), a collision
   * is not a performance footnote: it lets one tenant's cached policy
   * `allow` result be served to a different tenant/entity — cross-tenant
   * data disclosure. Collision resistance here is a security property of
   * the cache key, not an implementation detail open to swapping for
   * throughput. Any future change to this digest must go through a
   * threat-model update (see `docs/security/threat-models/TM-VP-012c.md`)
   * and `security-privacy-architect` review, not a standalone perf PR.
   */
  private async hashString(str: string): Promise<string> {
    const encoded = new TextEncoder().encode(str);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
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
