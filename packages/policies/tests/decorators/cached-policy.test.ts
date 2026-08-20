import { describe, it, expect, beforeEach, vi } from 'vitest';

/** See `waitUntil` — allowance for scheduler starvation, not flaky asserts. */
const RACE_TEST_TIMEOUT_MS = 30000;
import { safeRun, Result } from '@vytches/ddd-utils';
import {
  PolicyCachingBehavior,
  PolicyCachingBehaviorFactory,
} from '../../src/decorators/cached-policy';
import { BaseBusinessPolicy } from '../../src/core/base/base-business-policy';
import type { PolicyViolation } from '../../src/core/models/policy-violation';
import { PolicyContextBuilder } from '../../src/utils/policy-context-builder';
import type { IBusinessPolicy, PolicyContext, PolicyRequest } from '../../src/core/interfaces';

// Test policy that tracks call count
class TestPolicy extends BaseBusinessPolicy<{ value: number }> {
  public callCount = 0;
  public shouldFail = false;

  constructor() {
    super('test-policy', 'test', 'Test Policy');
  }

  public async check(
    request: PolicyRequest<{ value: number }>
  ): Promise<Result<{ value: number }, PolicyViolation>> {
    this.callCount++;

    if (this.shouldFail) {
      const violation = this.createViolation('TEST_FAILURE', 'Test policy failed', 'ERROR', {
        context: request.context,
      });
      return this.failure(violation);
    }

    return this.success(request.entity);
  }

  public reset(): void {
    this.callCount = 0;
    this.shouldFail = false;
  }
}

/**
 * VB-006 AC4 helper: a test policy whose `check()` resolves ONLY when the
 * test explicitly releases it via `resolveNextSuccess()`.
 *
 * `PolicyCache` (the class doing size/LRU/entry-count accounting) is
 * internal and unexported. Its `set()` method is only ever called a SECOND
 * time for a key that is already present ("isUpdate === true", the D1/D2/D3
 * re-write path) when two concurrent `PolicyCachingBehavior.check()` calls
 * race on the SAME not-yet-cached key: both call `get()` and miss before
 * either has written back via `set()`. That race is the only path through
 * the public API that reaches this branch — `DeferredPolicy` makes it fully
 * deterministic (no reliance on implicit microtask ordering) by holding
 * every inner-policy call open until the test releases it in a chosen
 * order, instead of hoping two `Promise.all()` calls interleave a
 * particular way.
 */
class DeferredPolicy extends BaseBusinessPolicy<{ value: number }> {
  public callCount = 0;
  private readonly pending: Array<(result: Result<{ value: number }, PolicyViolation>) => void> =
    [];

  constructor() {
    super('deferred-policy', 'test', 'Deferred Policy');
  }

  public check(
    _request: PolicyRequest<{ value: number }>
  ): Promise<Result<{ value: number }, PolicyViolation>> {
    this.callCount++;
    return new Promise(resolve => {
      this.pending.push(resolve);
    });
  }

  /** Resolve the oldest still-pending `check()` call as a success. */
  public resolveNextSuccess(entity: { value: number }): void {
    const resolve = this.pending.shift();
    if (!resolve) {
      throw new Error('DeferredPolicy: no pending check() call to resolve');
    }
    resolve(Result.ok(entity));
  }
}

/**
 * Poll `getter()` until it returns true, or fail with a clear message.
 *
 * The two AC4 tests below drive a genuine race between two concurrent
 * `check()` calls, so they cannot avoid polling. Under a loaded machine —
 * e.g. the pre-commit hook running four project suites in parallel — a
 * `setTimeout(0)` tick is scheduled far apart, and the polling loop starves
 * long enough to blow Vitest's 10s per-test default. Those tests therefore
 * pass an explicit, generous timeout; it is a starvation allowance, not a
 * hint that the assertions are timing-dependent.
 */
async function waitUntil(getter: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 2000; i++) {
    if (getter()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error(`waitUntil timed out: ${label}`);
}

/**
 * Drive a single, ordinary (non-racing) `DeferredPolicy`-backed check to
 * completion: wait for it to register as pending, then release it.
 */
async function checkAndResolve(
  cached: InstanceType<typeof PolicyCachingBehavior<{ value: number }>>,
  policy: DeferredPolicy,
  entity: { value: number },
  context: PolicyContext
): Promise<Result<{ value: number }, PolicyViolation>> {
  const before = policy.callCount;
  const promise = cached.check({ entity, context });
  await waitUntil(() => policy.callCount === before + 1, `check for value ${entity.value}`);
  policy.resolveNextSuccess(entity);
  return promise;
}

describe('CachedPolicy', () => {
  let testPolicy: TestPolicy;
  let cachedPolicy: InstanceType<typeof PolicyCachingBehavior<{ value: number }>>;
  let testEntity: { value: number };
  let policyContext: any;
  let request: PolicyRequest<{ value: number }>;

  beforeEach(() => {
    testPolicy = new TestPolicy();
    testEntity = { value: 42 };
    policyContext = PolicyContextBuilder.forUser('test-user')
      .withTenantId('test-tenant')
      .withEnvironment('test')
      .build();

    request = { entity: testEntity, context: policyContext };
  });

  describe('Basic Caching', () => {
    beforeEach(() => {
      cachedPolicy = PolicyCachingBehavior.withDefaults(testPolicy, 5000); // 5 second TTL
    });

    it('should cache successful policy results', async () => {
      // First call
      const result1 = await cachedPolicy.check(request);
      expect(result1.isSuccess).toBe(true);
      expect(testPolicy.callCount).toBe(1);

      // Second call should use cache
      const result2 = await cachedPolicy.check(request);
      expect(result2.isSuccess).toBe(true);
      expect(testPolicy.callCount).toBe(1); // No additional call
      expect(result2.value).toBe(testEntity);

      // Verify cache metrics
      const metrics = cachedPolicy.getCacheMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.entries).toBe(1);
    });

    it('should not cache failure results by default', async () => {
      testPolicy.shouldFail = true;

      // First call
      const result1 = await cachedPolicy.check(request);
      expect(result1.isFailure).toBe(true);
      expect(testPolicy.callCount).toBe(1);

      // Second call should execute again (not cached)
      const result2 = await cachedPolicy.check(request);
      expect(result2.isFailure).toBe(true);
      expect(testPolicy.callCount).toBe(2);

      // Cache should be empty
      expect(cachedPolicy.getCacheSize()).toBe(0);
    });

    it('should cache failure results when configured', async () => {
      const cachedPolicyWithFailures = PolicyCachingBehavior.create(testPolicy, {
        ttl: 5000,
        cacheFailures: true,
      });

      testPolicy.shouldFail = true;

      // First call
      const result1 = await cachedPolicyWithFailures.check(request);
      expect(result1.isFailure).toBe(true);
      expect(testPolicy.callCount).toBe(1);

      // Second call should use cache
      const result2 = await cachedPolicyWithFailures.check(request);
      expect(result2.isFailure).toBe(true);
      expect(testPolicy.callCount).toBe(1); // No additional call
    });

    it('should respect TTL expiration', async () => {
      // VT-001 (2026-05-09): replaced 150ms real sleep with fake-timer
      // advance — deterministic, ~150× faster, eliminates flakiness on slow CI.
      vi.useFakeTimers();
      try {
        const shortCachedPolicy = PolicyCachingBehavior.create(testPolicy, {
          ttl: 100, // 100ms TTL
        });

        // First call
        await shortCachedPolicy.check(request);
        expect(testPolicy.callCount).toBe(1);

        // Wait for TTL to expire (150ms > 100ms TTL)
        vi.advanceTimersByTime(150);

        // Second call should execute again
        await shortCachedPolicy.check(request);
        expect(testPolicy.callCount).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should enforce max cache size', async () => {
      const limitedCachedPolicy = PolicyCachingBehavior.create(testPolicy, {
        ttl: 60000,
        maxSize: 2,
      });

      // Fill cache to limit
      await limitedCachedPolicy.check({ entity: { value: 1 }, context: policyContext });
      await limitedCachedPolicy.check({ entity: { value: 2 }, context: policyContext });
      expect(limitedCachedPolicy.getCacheSize()).toBe(2);

      // Add third entry - should evict oldest
      await limitedCachedPolicy.check({ entity: { value: 3 }, context: policyContext });
      expect(limitedCachedPolicy.getCacheSize()).toBe(2);

      const metrics = limitedCachedPolicy.getCacheMetrics();
      expect(metrics.evictions).toBe(1);
    });
  });

  describe('Custom Key Generation', () => {
    beforeEach(() => {
      cachedPolicy = PolicyCachingBehavior.withDefaults(testPolicy, 5000); // 5 second TTL
    });

    it('should use custom key generator', async () => {
      const customCachedPolicy = PolicyCachingBehavior.create(testPolicy, {
        ttl: 5000,
        keyGenerator: request => `custom_${(request.entity as { value: number }).value}`,
      });

      // Same entity value should hit cache
      await customCachedPolicy.check({ entity: { value: 42 }, context: policyContext });
      await customCachedPolicy.check({ entity: { value: 42 }, context: policyContext });

      expect(testPolicy.callCount).toBe(1);

      // Different entity value should miss cache
      await customCachedPolicy.check({ entity: { value: 43 }, context: policyContext });
      expect(testPolicy.callCount).toBe(2);
    });

    it('should handle different contexts with default key generator', async () => {
      const otherContext = PolicyContextBuilder.forUser('other-user')
        .withEnvironment('test')
        .build();

      // Same entity, different context
      await cachedPolicy.check({ entity: testEntity, context: policyContext });
      await cachedPolicy.check({ entity: testEntity, context: otherContext });

      expect(testPolicy.callCount).toBe(2); // Different cache keys
    });
  });

  describe('Factory Methods', () => {
    it('should create cached policy with TTL factory', async () => {
      const ttlCachedPolicy = PolicyCachingBehaviorFactory.withTTL(testPolicy, 3000);

      await ttlCachedPolicy.check(request);
      await ttlCachedPolicy.check(request);

      expect(testPolicy.callCount).toBe(1);
    });

    it('should create cached policy for expensive operations', async () => {
      const expensiveCachedPolicy = PolicyCachingBehaviorFactory.forExpensivePolicy(testPolicy, {
        ttl: 10000,
        maxSize: 100,
        cacheFailures: true,
      });

      expect(expensiveCachedPolicy.id).toContain('expensive_');

      // Test failure caching
      testPolicy.shouldFail = true;
      await expensiveCachedPolicy.check(request);
      await expensiveCachedPolicy.check(request);

      expect(testPolicy.callCount).toBe(1); // Failures cached
    });

    it('should create cached policy with custom key', async () => {
      const customKeyCachedPolicy = PolicyCachingBehaviorFactory.withCustomKey(
        testPolicy,
        request => `entity_${(request.entity as { value: number }).value}`,
        2000
      );

      await customKeyCachedPolicy.check(request);
      await customKeyCachedPolicy.check(request);

      expect(testPolicy.callCount).toBe(1);
    });
  });

  describe('Policy Interface Implementation', () => {
    beforeEach(() => {
      cachedPolicy = PolicyCachingBehavior.withDefaults(testPolicy);
    });

    it('should preserve policy identity', () => {
      expect(cachedPolicy.id).toBe('cached_test-policy');
      expect(cachedPolicy.domain).toBe('test');
      expect(cachedPolicy.name).toBe('Cached Test Policy');
    });

    it('should support policy composition', async () => {
      const otherPolicy = new TestPolicy();
      Object.defineProperty(otherPolicy, 'id', { value: 'other-policy', configurable: true });

      // Composition should work but won't be tested deeply here
      expect(() => cachedPolicy.and(otherPolicy)).not.toThrow();
      expect(() => cachedPolicy.or(otherPolicy)).not.toThrow();
    });

    it('should support negation with cache preservation', () => {
      const negatedPolicy = cachedPolicy.not();

      expect(negatedPolicy).toBeInstanceOf(PolicyCachingBehavior);
      expect(negatedPolicy.id).toContain('NOT_');
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      cachedPolicy = PolicyCachingBehavior.withDefaults(testPolicy);
    });

    it('should clear cache manually', async () => {
      await cachedPolicy.check(request);
      expect(cachedPolicy.getCacheSize()).toBe(1);

      cachedPolicy.clearCache();
      expect(cachedPolicy.getCacheSize()).toBe(0);

      // Next call should execute policy
      await cachedPolicy.check(request);
      expect(testPolicy.callCount).toBe(2);
    });

    it('should provide accurate cache metrics', async () => {
      // Generate some cache activity
      await cachedPolicy.check(request); // miss
      await cachedPolicy.check(request); // hit
      await cachedPolicy.check({ entity: { value: 99 }, context: policyContext }); // miss

      const metrics = cachedPolicy.getCacheMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(2);
      expect(metrics.entries).toBe(2);
      expect(metrics.evictions).toBe(0);
    });

    it('should handle namespace correctly', async () => {
      const namespacedPolicy = PolicyCachingBehavior.create(testPolicy, {
        ttl: 5000,
        namespace: 'custom-namespace',
      });

      await namespacedPolicy.check(request);
      expect(namespacedPolicy.getCacheSize()).toBe(1);

      // Different namespace should be isolated
      const otherNamespacedPolicy = PolicyCachingBehavior.create(testPolicy, {
        ttl: 5000,
        namespace: 'other-namespace',
      });

      await otherNamespacedPolicy.check(request);
      expect(otherNamespacedPolicy.getCacheSize()).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle policy exceptions gracefully', async () => {
      const throwingPolicy = new (class extends BaseBusinessPolicy<{ value: number }> {
        constructor() {
          super('throwing-policy', 'test', 'Throwing Policy');
        }

        public async check(): Promise<Result<{ value: number }, PolicyViolation>> {
          throw new Error('Policy execution failed');
        }
      })();

      const cachedThrowingPolicy = PolicyCachingBehavior.withDefaults(throwingPolicy);

      const [error] = await safeRun(() => cachedThrowingPolicy.check(request));
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Policy execution failed');

      // Should not cache exceptions
      expect(cachedThrowingPolicy.getCacheSize()).toBe(0);
    });

    it('should handle malformed entities in key generation', async () => {
      const circularEntity = { value: 1 } as { value: number; [key: string]: unknown };
      circularEntity.self = circularEntity; // Circular reference

      const circularRequest = { entity: circularEntity, context: policyContext };

      // Should handle circular references gracefully
      const result = await cachedPolicy.check(circularRequest);
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      cachedPolicy = PolicyCachingBehavior.withDefaults(testPolicy, 5000); // 5 second TTL
    });

    it('should handle zero TTL', async () => {
      const zeroTTLPolicy = PolicyCachingBehavior.create(testPolicy, {
        ttl: 0, // Immediate expiration
      });

      await zeroTTLPolicy.check(request);
      await zeroTTLPolicy.check(request);

      // Should execute twice due to immediate expiration
      expect(testPolicy.callCount).toBe(2);
    });

    it('should handle maxSize of 1', async () => {
      const singleEntryPolicy = PolicyCachingBehavior.create(testPolicy, {
        ttl: 60000,
        maxSize: 1,
      });

      await singleEntryPolicy.check({ entity: { value: 1 }, context: policyContext });
      await singleEntryPolicy.check({ entity: { value: 2 }, context: policyContext });

      expect(singleEntryPolicy.getCacheSize()).toBe(1);

      const metrics = singleEntryPolicy.getCacheMetrics();
      expect(metrics.evictions).toBe(1);
    });

    it('should handle concurrent access gracefully', async () => {
      // First request should execute the policy
      const result1 = await cachedPolicy.check(request);
      expect(result1.isSuccess).toBe(true);
      expect(testPolicy.callCount).toBe(1);

      // Multiple subsequent requests should use cache
      const promises = Array.from({ length: 9 }, () => cachedPolicy.check(request));
      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => expect(result.isSuccess).toBe(true));

      // Should still be only one execution due to caching
      expect(testPolicy.callCount).toBe(1);
    });
  });

  // VS-005: SHA-256 hash, PII masking, LRU O(1)
  // Use a separate policy typed to `unknown` so test entities are not
  // constrained to `{ value: number }`.
  describe('VS-005: SHA-256 cache key hash', () => {
    let vs005Policy: TestPolicy;
    let vs005Cached: PolicyCachingBehavior<unknown>;

    beforeEach(() => {
      vs005Policy = new TestPolicy();
      // Cast to unknown so arbitrary entity shapes are accepted
      vs005Cached = PolicyCachingBehavior.create(
        vs005Policy as unknown as IBusinessPolicy<unknown>,
        { ttl: 60000, maxSize: 1200 }
      );
    });

    // 1000 unique entities -> 1000 unique keys (zero collisions)
    it('should produce zero collisions for 1000 distinct entities', async () => {
      const entities = Array.from({ length: 1000 }, (_, i) => ({
        id: `entity-${i}`,
        value: i,
        name: `Entity number ${i}`,
      }));

      for (const entity of entities) {
        await vs005Cached.check({ entity, context: policyContext });
      }

      // If there were any collisions, some cache misses would reuse slots
      // and getCacheSize() would be < 1000
      expect(vs005Cached.getCacheSize()).toBe(1000);
    });

    // Determinism: same entity -> same key
    it('should produce deterministic keys (same entity = same key, no re-execution)', async () => {
      const policy = PolicyCachingBehavior.create(
        vs005Policy as unknown as IBusinessPolicy<unknown>,
        { ttl: 60000 }
      );
      const entity = { id: 'abc', payload: 'hello world' };

      await policy.check({ entity, context: policyContext });
      await policy.check({ entity, context: policyContext });
      await policy.check({ entity, context: policyContext });

      // Deterministic key means all three hits resolve to same slot
      expect(vs005Policy.callCount).toBe(1);
      expect(policy.getCacheSize()).toBe(1);
    });

    // F4: default key must NOT expose raw userId/tenantId; context isolation verified behaviourally
    it('should NOT share cache across different users (F4 PII context isolation)', async () => {
      const policy = PolicyCachingBehavior.create(
        vs005Policy as unknown as IBusinessPolicy<unknown>,
        { ttl: 60000 }
      );

      const sensitiveContext = PolicyContextBuilder.forUser('user-SENSITIVE-PII-12345')
        .withTenantId('tenant-SENSITIVE-PII-67890')
        .withEnvironment('production')
        .build();

      await policy.check({ entity: { value: 1 }, context: sensitiveContext });

      // Same user, same entity — must be a cache hit
      const hitResult = await policy.check({ entity: { value: 1 }, context: sensitiveContext });
      expect(vs005Policy.callCount).toBe(1);
      expect(hitResult.isSuccess).toBe(true);

      // Different user, same entity — must be a cache miss (different context hash)
      const otherContext = PolicyContextBuilder.forUser('user-OTHER-99999')
        .withTenantId('tenant-SENSITIVE-PII-67890')
        .withEnvironment('production')
        .build();
      await policy.check({ entity: { value: 1 }, context: otherContext });
      expect(vs005Policy.callCount).toBe(2);
    });

    // keyGenerator override still works (regression for AR-2 / R5)
    it('should use keyGenerator override instead of SHA-256 default (regression R5)', async () => {
      const generatorCalls: string[] = [];

      const policy = PolicyCachingBehavior.create(
        vs005Policy as unknown as IBusinessPolicy<unknown>,
        {
          ttl: 60000,
          keyGenerator: req => {
            const key = `override:${(req.entity as { value: number }).value}`;
            generatorCalls.push(key);
            return key;
          },
        }
      );

      await policy.check({ entity: { value: 7 }, context: policyContext });
      await policy.check({ entity: { value: 7 }, context: policyContext }); // cache hit

      expect(generatorCalls.length).toBe(2); // called on every check()
      expect(generatorCalls[0]).toBe('override:7');
      expect(vs005Policy.callCount).toBe(1); // but inner policy called only once
    });
  });

  // VP-012c / R1: two hashString() calls (contextHash + entityHash) merged
  // into one hashString() call over a length-prefixed combined buffer.
  // Digest primitive (SHA-256, 128-bit prefix) is unchanged — these tests
  // cover only the merge's boundary-safety, not the hash algorithm itself
  // (algorithm-level collision resistance is already covered by the
  // "VS-005: SHA-256 cache key hash" suite above).
  describe('VP-012c R1: merged single-hashString cache key generation', () => {
    let r1Policy: TestPolicy;

    beforeEach(() => {
      r1Policy = new TestPolicy();
    });

    it('should not falsely collide when context length varies but a naive (unprefixed) concatenation of context+entity would coincide', async () => {
      // Regression for the length-prefix format: without a length prefix,
      // two different (contextRaw, entityKey) splits can concatenate to an
      // identical combined string (e.g. contextRaw="ab"+entityKey="cd" vs
      // contextRaw="a"+entityKey="bcd" both yield "abcd"). The length prefix
      // makes the split point part of the hashed input, so this can never
      // happen. We approximate the adversarial split here via two contexts
      // whose userId differs only in where a shared substring sits relative
      // to the context/entity boundary, paired with entities chosen so the
      // *tail* of one contextRaw + its entityKey textually matches the
      // *tail* of the other pairing once concatenated naively.
      const policy = PolicyCachingBehavior.create(r1Policy as unknown as IBusinessPolicy<unknown>, {
        ttl: 60000,
      });

      const contextA = PolicyContextBuilder.forUser('shared-prefix-X')
        .withEnvironment('env')
        .build();
      const contextB = PolicyContextBuilder.forUser('shared-prefix-')
        .withEnvironment('Xenv')
        .build();

      // entity chosen so naive contextRaw+entityKey concatenation for A and
      // B would be textually close; only the length-prefixed encoding
      // guarantees they hash to different combined strings.
      await policy.check({ entity: { value: 'tail' }, context: contextA });
      await policy.check({ entity: { value: 'tail' }, context: contextB });

      // Two distinct cache entries (misses), never a false hit collapsing
      // both requests into one slot.
      expect(policy.getCacheSize()).toBe(2);
      expect(r1Policy.callCount).toBe(2);
    });

    it('should keep entity content containing NUL bytes and colon characters from crossing the context/entity boundary', async () => {
      const policy = PolicyCachingBehavior.create(r1Policy as unknown as IBusinessPolicy<unknown>, {
        ttl: 60000,
      });

      const context = PolicyContextBuilder.forUser('user-boundary')
        .withTenantId('tenant-boundary')
        .withEnvironment('test')
        .build();

      // Entity payloads that echo the internal NUL field-separator and the
      // "length:" prefix separator used by the merged encoding.
      const entityWithNul = { note: 'a\x00b\x00c' };
      const entityWithColon = { note: '4:injected' };

      await policy.check({ entity: entityWithNul, context });
      await policy.check({ entity: entityWithColon, context });

      // Different entity payloads under the same context must still be two
      // independent cache entries — no boundary confusion.
      expect(policy.getCacheSize()).toBe(2);
      expect(r1Policy.callCount).toBe(2);

      // Repeating the first request must still be a clean cache hit
      // (determinism preserved after the merge).
      const callsBefore = r1Policy.callCount;
      await policy.check({ entity: entityWithNul, context });
      expect(r1Policy.callCount).toBe(callsBefore);
    });

    it('should still produce exactly one namespace segment and one hash segment in the cache key shape (single hashString call)', async () => {
      // Behavioural proxy for "one hashString() call, not two": the public
      // surface for this is cache size/determinism (already covered above);
      // this test locks in that a bare `namespace` config still isolates
      // correctly now that the key is namespace + ONE hash rather than
      // namespace + contextHash + entityHash.
      const namespacedA = PolicyCachingBehavior.create(
        r1Policy as unknown as IBusinessPolicy<unknown>,
        { ttl: 60000, namespace: 'r1-namespace-a' }
      );
      const namespacedB = PolicyCachingBehavior.create(
        r1Policy as unknown as IBusinessPolicy<unknown>,
        { ttl: 60000, namespace: 'r1-namespace-b' }
      );

      const context = PolicyContextBuilder.forUser('user-ns').withEnvironment('test').build();
      const entity = { value: 'same' };

      await namespacedA.check({ entity, context });
      await namespacedB.check({ entity, context });

      // Same context+entity, different namespace → isolated caches, each a
      // miss (namespace is still the un-hashed prefix of the key).
      expect(namespacedA.getCacheSize()).toBe(1);
      expect(namespacedB.getCacheSize()).toBe(1);
      expect(r1Policy.callCount).toBe(2);
    });
  });

  // VP-012c testing layer: dedicated key-collision-resistance coverage for
  // the default (non-keyGenerator) cache key, proving the three properties
  // the R1 length-prefix framing is supposed to guarantee:
  //   (a) same context + same entity  -> same key (stable, deterministic)
  //   (b) different context OR entity -> different key (no false collision)
  //   (c) boundary-shift edge case: a context/entity split that WOULD
  //       naively concatenate to the same raw bytes at a different split
  //       point (e.g. context="ab"+entity="c" vs context="a"+entity="bc")
  //       must still resolve to different keys — this is exactly what the
  //       decimal length-prefix in `generateCacheKey` (see its doc comment,
  //       R1) is designed to prevent.
  describe('VP-012c testing layer: default cache key collision resistance', () => {
    let collisionPolicy: TestPolicy;

    beforeEach(() => {
      collisionPolicy = new TestPolicy();
    });

    it('(a) same context + same entity produces the same key (stable across repeated checks)', async () => {
      const policy = PolicyCachingBehavior.create(
        collisionPolicy as unknown as IBusinessPolicy<unknown>,
        { ttl: 60000 }
      );

      const context = PolicyContextBuilder.forUser('stable-user')
        .withTenantId('stable-tenant')
        .withEnvironment('stable-env')
        .build();
      const entity = { id: 'same-entity', payload: { nested: true, count: 3 } };

      // Three checks of the identical (context, entity) pair: only the
      // first is a miss, the other two must land on the same cache slot.
      await policy.check({ entity, context });
      await policy.check({ entity, context });
      await policy.check({ entity, context });

      expect(collisionPolicy.callCount).toBe(1);
      expect(policy.getCacheSize()).toBe(1);
    });

    it('(b) different context OR different entity produces a different key (no false collision)', async () => {
      const policy = PolicyCachingBehavior.create(
        collisionPolicy as unknown as IBusinessPolicy<unknown>,
        { ttl: 60000 }
      );

      const baseContext = PolicyContextBuilder.forUser('base-user')
        .withTenantId('base-tenant')
        .withEnvironment('base-env')
        .build();
      const otherContext = PolicyContextBuilder.forUser('other-user') // only userId differs
        .withTenantId('base-tenant')
        .withEnvironment('base-env')
        .build();
      const entity = { id: 'shared-entity' };
      const otherEntity = { id: 'different-entity' };

      // Baseline
      await policy.check({ entity, context: baseContext });
      expect(policy.getCacheSize()).toBe(1);

      // Different context, same entity -> new key
      await policy.check({ entity, context: otherContext });
      expect(policy.getCacheSize()).toBe(2);

      // Same context (base), different entity -> new key
      await policy.check({ entity: otherEntity, context: baseContext });
      expect(policy.getCacheSize()).toBe(3);

      // All three were distinct misses; nothing was ever reused.
      expect(collisionPolicy.callCount).toBe(3);
    });

    it('(c) boundary-shift split (context/entity byte-shift that would naively coincide) still yields different keys', async () => {
      const policy = PolicyCachingBehavior.create(
        collisionPolicy as unknown as IBusinessPolicy<unknown>,
        { ttl: 60000 }
      );

      // Fixed userId/tenantId so the ONLY moving parts are `environment`
      // (the last field folded into contextRaw, directly adjacent to
      // entityKey with zero separator between them) and the entity value.
      //
      // Entities are top-level BigInts: JSON.stringify() throws on BigInt,
      // so generateCacheKey() falls back to generateFallbackKey(), whose
      // stringify() renders a bare primitive as `String(obj)` with NO
      // quoting/escaping (unlike JSON.stringify). That gives us exact,
      // unescaped control over the raw entityKey bytes, which is required
      // to construct a genuine naive-concatenation coincidence.
      //
      // Case A: environment = "12", entity = 3n  -> entityKey "3"
      //         naive tail = "12" + "3"  = "123"
      // Case B: environment = "1",  entity = 23n -> entityKey "23"
      //         naive tail = "1"  + "23" = "123"   <- same naive tail as A
      //
      // contextRaw.length differs (ends in "...12" vs "...1"), so the real
      // length-prefixed key (`${contextRaw.length}:${contextRaw}${entityKey}`)
      // MUST diverge even though the unprefixed concatenation would not.
      // This is the direct analogue of context="ab"+entity="c" vs
      // context="a"+entity="bc".
      const contextA = PolicyContextBuilder.forUser('boundary-user')
        .withTenantId('boundary-tenant')
        .withEnvironment('12')
        .build();
      const contextB = PolicyContextBuilder.forUser('boundary-user')
        .withTenantId('boundary-tenant')
        .withEnvironment('1')
        .build();

      const entityA = 3n as unknown;
      const entityB = 23n as unknown;

      // Sanity check on the construction itself: the naive (unprefixed)
      // concatenation really would coincide for A and B, which is exactly
      // the ambiguity the length prefix must resolve.
      const contextRawA = `boundary-user\x00boundary-tenant\x0012`;
      const contextRawB = `boundary-user\x00boundary-tenant\x001`;
      expect(`${contextRawA}3`).toBe(`${contextRawB}23`);
      expect(contextRawA.length).not.toBe(contextRawB.length);

      await policy.check({ entity: entityA, context: contextA });
      await policy.check({ entity: entityB, context: contextB });

      // Two genuinely distinct cache entries — never collapsed into one
      // slot despite the naive-concatenation coincidence above.
      expect(policy.getCacheSize()).toBe(2);
      expect(collisionPolicy.callCount).toBe(2);

      // Determinism control: re-running case A must still be a clean hit
      // on its own slot (proves the divergence isn't just "always misses").
      const callsBefore = collisionPolicy.callCount;
      await policy.check({ entity: entityA, context: contextA });
      expect(collisionPolicy.callCount).toBe(callsBefore);
    });
  });

  describe('VS-005: LRU O(1) eviction (F3)', () => {
    it('should evict the least recently used entry on overflow', async () => {
      const policy = PolicyCachingBehavior.create(testPolicy, {
        ttl: 60000,
        maxSize: 3,
      });

      // Insert A, B, C
      await policy.check({ entity: { value: 1 }, context: policyContext }); // A
      await policy.check({ entity: { value: 2 }, context: policyContext }); // B
      await policy.check({ entity: { value: 3 }, context: policyContext }); // C
      expect(policy.getCacheSize()).toBe(3);

      // Access A again to make it recently used (B is now LRU)
      await policy.check({ entity: { value: 1 }, context: policyContext }); // hit A
      expect(testPolicy.callCount).toBe(3); // no new call

      // Insert D — should evict B (LRU), not A (recently hit)
      await policy.check({ entity: { value: 4 }, context: policyContext }); // D
      expect(policy.getCacheSize()).toBe(3);

      const metrics = policy.getCacheMetrics();
      expect(metrics.evictions).toBe(1);

      // B was evicted — re-check triggers inner policy again
      const callsBefore = testPolicy.callCount;
      await policy.check({ entity: { value: 2 }, context: policyContext });
      expect(testPolicy.callCount).toBe(callsBefore + 1);
    });

    it('should refresh LRU position on cache hit', async () => {
      const policy = PolicyCachingBehavior.create(testPolicy, {
        ttl: 60000,
        maxSize: 2,
      });

      await policy.check({ entity: { value: 10 }, context: policyContext }); // A (LRU)
      await policy.check({ entity: { value: 20 }, context: policyContext }); // B (MRU)

      // Hit A — now A is MRU, B is LRU
      await policy.check({ entity: { value: 10 }, context: policyContext });

      // Insert C — should evict B, not A
      await policy.check({ entity: { value: 30 }, context: policyContext }); // C

      // A should still be cached (not evicted)
      const callsBefore = testPolicy.callCount;
      await policy.check({ entity: { value: 10 }, context: policyContext });
      expect(testPolicy.callCount).toBe(callsBefore); // A hit — not evicted

      // B should be evicted (miss -> new call)
      await policy.check({ entity: { value: 20 }, context: policyContext });
      expect(testPolicy.callCount).toBe(callsBefore + 1);
    });

    it('should maintain correct metrics through LRU evictions', async () => {
      const policy = PolicyCachingBehavior.create(testPolicy, {
        ttl: 60000,
        maxSize: 2,
      });

      await policy.check({ entity: { value: 1 }, context: policyContext }); // miss
      await policy.check({ entity: { value: 2 }, context: policyContext }); // miss
      await policy.check({ entity: { value: 1 }, context: policyContext }); // hit
      await policy.check({ entity: { value: 3 }, context: policyContext }); // miss + evict value:2

      const metrics = policy.getCacheMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(3);
      expect(metrics.evictions).toBe(1);
      expect(metrics.entries).toBe(2);
    });
  });

  // VB-006 AC1: regression for the "dead switch" bug where an explicit
  // `cacheFailures: false` passed to `forExpensivePolicy()` was silently
  // ignored (the factory's own `?? true` default effectively won regardless
  // of what the caller passed). Before the VB-006 fix this test would be
  // RED: the second identical denial would be served from cache and
  // `callCount` would stay at 1.
  describe('VB-006 AC1: forExpensivePolicy() explicit cacheFailures:false is respected', () => {
    it('does NOT cache a denial when cacheFailures is explicitly false, and re-runs the inner policy on the next identical check', async () => {
      const policy = new TestPolicy();
      policy.shouldFail = true;

      const expensiveCachedPolicy = PolicyCachingBehaviorFactory.forExpensivePolicy(policy, {
        cacheFailures: false, // explicit false must override the factory's own default
      });

      const context = PolicyContextBuilder.forUser('ac1-user')
        .withTenantId('ac1-tenant')
        .withEnvironment('test')
        .build();
      const denialRequest = { entity: { value: 1 }, context };

      const result1 = await expensiveCachedPolicy.check(denialRequest);
      expect(result1.isFailure).toBe(true);
      expect(policy.callCount).toBe(1);

      // An identical second denial MUST hit the inner policy again — the
      // switch must actually gate caching, not just exist in the type.
      const result2 = await expensiveCachedPolicy.check(denialRequest);
      expect(result2.isFailure).toBe(true);
      expect(policy.callCount).toBe(2);

      // Nothing should have been written to the cache at all.
      expect(expensiveCachedPolicy.getCacheSize()).toBe(0);
    });
  });

  // VB-006 AC4: regression for the D1/D2/D3 fixes in `PolicyCache.set()`
  // (re-writing an already-cached key must not double-count as a new
  // insertion, must not orphan its LRU node, and must not trigger a
  // spurious extra eviction). `PolicyCache` itself is internal/unexported,
  // so both scenarios below are driven entirely through the public
  // `PolicyCachingBehavior` surface, using `DeferredPolicy` (see above) to
  // deterministically force the ONLY public trigger for a same-key re-write:
  // two `check()` calls racing on a key that is not yet cached.
  describe('VB-006 AC4: PolicyCache re-write-of-existing-key invariants (D1-D3)', () => {
    let policy: DeferredPolicy;

    beforeEach(() => {
      policy = new DeferredPolicy();
    });

    it(
      're-writing an existing key at a full cache does not change size, evict an unrelated entry, or inflate the entry count',
      async () => {
        const cached = PolicyCachingBehavior.create(policy, {
          ttl: 60000,
          maxSize: 2,
        });
        const context = PolicyContextBuilder.forUser('ac4a-user').withEnvironment('test').build();

        // Fill the cache to capacity with two ordinary entries.
        await checkAndResolve(cached, policy, { value: 1 }, context);
        await checkAndResolve(cached, policy, { value: 2 }, context);
        expect(cached.getCacheSize()).toBe(2);
        expect(cached.getCacheMetrics().entries).toBe(2);
        expect(cached.getCacheMetrics().evictions).toBe(0);

        // Race two concurrent checks for a THIRD, not-yet-cached key while the
        // cache is already full.
        const request3 = { entity: { value: 3 }, context };
        const before = policy.callCount;
        const p1 = cached.check(request3);
        const p2 = cached.check(request3);

        // Wait until BOTH have missed the cache and registered as pending
        // before releasing either — this is what guarantees the race.
        await waitUntil(() => policy.callCount === before + 2, 'both racing checks pending');

        // Release the first: a genuine fresh insert of key 3. The cache is
        // already at maxSize, so this evicts the true LRU head (value 1).
        policy.resolveNextSuccess({ value: 3 });
        await p1;
        expect(cached.getCacheSize()).toBe(2);
        expect(cached.getCacheMetrics().evictions).toBe(1);
        expect(cached.getCacheMetrics().entries).toBe(2);

        // Release the second: this is the re-write of an EXISTING key (3 is
        // already cached from p1) while the cache is at capacity. Per D1/D3
        // this must be a no-op with respect to size/eviction/entry counting.
        policy.resolveNextSuccess({ value: 3 });
        await p2;

        expect(cached.getCacheSize()).toBe(2); // unchanged by the re-write
        const metrics = cached.getCacheMetrics();
        expect(metrics.evictions).toBe(1); // no NEW eviction from the re-write
        expect(metrics.entries).toBe(2); // not inflated to 3

        // Entity 2 (untouched by the race) must still be the surviving,
        // unrelated entry — not collaterally evicted by the re-write.
        const callsBeforeHit = policy.callCount;
        const hit = await cached.check({ entity: { value: 2 }, context });
        expect(policy.callCount).toBe(callsBeforeHit); // served from cache, no pending call
        expect(hit.isSuccess).toBe(true);
      },
      RACE_TEST_TIMEOUT_MS
    );

    it(
      're-writing the entry that is currently the LRU-oldest key does not corrupt LRU ordering for later evictions (oldest-first preserved)',
      async () => {
        const cached = PolicyCachingBehavior.create(policy, {
          ttl: 60000,
          maxSize: 2,
        });
        const context = PolicyContextBuilder.forUser('ac4b-user').withEnvironment('test').build();

        // Race key A's FIRST-EVER population: the only public trigger for
        // `PolicyCache.set()`'s re-write branch while A is (trivially) the
        // sole, oldest entry — this is exactly the D2 orphaned-LRU-node case.
        const requestA = { entity: { value: 100 }, context };
        const before = policy.callCount;
        const pA1 = cached.check(requestA);
        const pA2 = cached.check(requestA);
        await waitUntil(() => policy.callCount === before + 2, 'race on key A pending');
        policy.resolveNextSuccess({ value: 100 }); // fresh insert (isUpdate=false)
        await pA1;
        policy.resolveNextSuccess({ value: 100 }); // re-write (isUpdate=true) — D2 case
        await pA2;
        expect(cached.getCacheSize()).toBe(1);

        // Ordinary inserts: B fills the cache, C evicts the true oldest (A),
        // D evicts the next true oldest (B). maxSize=2 throughout.
        await checkAndResolve(cached, policy, { value: 200 }, context); // {A,B}, full
        await checkAndResolve(cached, policy, { value: 300 }, context); // should evict A -> {B,C}
        await checkAndResolve(cached, policy, { value: 400 }, context); // should evict B -> {C,D}

        // Bounded: the cache must never exceed maxSize, even across the
        // earlier re-write. Under the D2 bug, `lruHead` gets stuck pointing at
        // an orphaned node and a later eviction becomes a silent no-op,
        // letting the cache grow past maxSize.
        expect(cached.getCacheSize()).toBe(2);

        // The correct members survive in oldest-first order: C and D are
        // hits, A and B are genuine misses again.
        const callsBeforeHits = policy.callCount;
        const hitC = await cached.check({ entity: { value: 300 }, context });
        const hitD = await cached.check({ entity: { value: 400 }, context });
        expect(policy.callCount).toBe(callsBeforeHits); // both hits, no new pending calls
        expect(hitC.isSuccess).toBe(true);
        expect(hitD.isSuccess).toBe(true);

        // A and B were genuinely evicted (in that order) — re-checking them
        // must go back through the inner policy.
        const callsBeforeA = policy.callCount;
        await checkAndResolve(cached, policy, { value: 100 }, context);
        expect(policy.callCount).toBe(callsBeforeA + 1);

        const callsBeforeB = policy.callCount;
        await checkAndResolve(cached, policy, { value: 200 }, context);
        expect(policy.callCount).toBe(callsBeforeB + 1);
      },
      RACE_TEST_TIMEOUT_MS
    );
  });
});
