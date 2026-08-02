import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import type { Result } from '@vytches/ddd-utils';
import {
  PolicyCachingBehavior,
  PolicyCachingBehaviorFactory,
} from '../../src/decorators/cached-policy';
import { BaseBusinessPolicy } from '../../src/core/base/base-business-policy';
import type { PolicyViolation } from '../../src/core/models/policy-violation';
import { PolicyContextBuilder } from '../../src/utils/policy-context-builder';
import type { IBusinessPolicy, PolicyRequest } from '../../src/core/interfaces';

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
});
