import { describe, it, expect, vi } from 'vitest';
import { PolicyCachingBehavior, BaseBusinessPolicy, PolicyContextBuilder } from '../../src';
import type { PolicyCacheConfig, PolicyRequest, PolicyViolation, Result } from '../../src';

/**
 * VB-006 AC5: contract coverage for EVERY option in `PolicyCacheConfig`
 * (imported here from the package barrel — `../../src` — per LT1; this is a
 * contract test, not a unit test, so it exercises only the public surface a
 * consumer actually imports).
 *
 * Purpose (per the VB-006 task): the class of regression this file guards
 * against is "an option is documented in JSDoc but is not actually
 * operational" — exactly the `cacheFailures` dead-switch bug fixed
 * elsewhere in VB-006 (see `cached-policy.test.ts`, "VB-006 AC1"). Every
 * option below gets a case proving an EXPLICIT value is respected, and,
 * where the JSDoc documents a fallback, a case proving OMISSION produces
 * that documented default. Explicit `false`/`0` are always asserted as
 * their own, separate case from omission — never collapsed together.
 */

// Local fake policy that counts invocations — mirrors the `TestPolicy`
// pattern already used in `cached-policy.test.ts`. Not a mock of anything
// inside @vytches/ddd-policies: a plain BaseBusinessPolicy subclass.
class TestPolicy extends BaseBusinessPolicy<{ value: number }> {
  public callCount = 0;
  public shouldFail = false;

  constructor(id = 'contract-test-policy') {
    super(id, 'test', 'Contract Test Policy');
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
}

describe('PolicyCacheConfig contract (public barrel import)', () => {
  describe('ttl — lazy expiry ("checked only on get(), no background sweeper")', () => {
    it('a value read before ttl elapses is served from cache (explicit ttl respected)', async () => {
      vi.useFakeTimers();
      try {
        const policy = new TestPolicy();
        const context = PolicyContextBuilder.forUser('ttl-user-a').withEnvironment('test').build();
        const cached = PolicyCachingBehavior.create(policy, { ttl: 1000 });
        const entity = { value: 1 };

        await cached.check({ entity, context });
        vi.advanceTimersByTime(500); // well within the 1000ms ttl
        await cached.check({ entity, context });

        expect(policy.callCount).toBe(1); // second call served from cache
      } finally {
        vi.useRealTimers();
      }
    });

    it('a value read after ttl elapses is a miss and the inner policy runs again (explicit ttl respected)', async () => {
      vi.useFakeTimers();
      try {
        const policy = new TestPolicy();
        const context = PolicyContextBuilder.forUser('ttl-user-b').withEnvironment('test').build();
        const cached = PolicyCachingBehavior.create(policy, { ttl: 1000 });
        const entity = { value: 1 };

        await cached.check({ entity, context });
        vi.advanceTimersByTime(1500); // past the 1000ms ttl
        await cached.check({ entity, context });

        expect(policy.callCount).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('an entry written and never read again is NOT removed by a timer (expiry is lazy — no background sweeper)', async () => {
      vi.useFakeTimers();
      try {
        const policy = new TestPolicy();
        const context = PolicyContextBuilder.forUser('ttl-user-c').withEnvironment('test').build();
        const cached = PolicyCachingBehavior.create(policy, { ttl: 50 });

        await cached.check({ entity: { value: 1 }, context });
        expect(cached.getCacheSize()).toBe(1);

        // Advance far past ttl without ever reading the entry back.
        vi.advanceTimersByTime(1_000_000);

        // No background sweeper: the entry is still physically present, and
        // no eviction was ever recorded for it.
        expect(cached.getCacheSize()).toBe(1);
        expect(cached.getCacheMetrics().evictions).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('keyGenerator (optional)', () => {
    it('explicit keyGenerator is used instead of the default (two different entities mapped to the same key collide)', async () => {
      const policy = new TestPolicy();
      const context = PolicyContextBuilder.forUser('kg-user').withEnvironment('test').build();
      const cached = PolicyCachingBehavior.create(policy, {
        ttl: 60000,
        keyGenerator: () => 'fixed-key', // ignores the request entirely
      });

      await cached.check({ entity: { value: 1 }, context });
      await cached.check({ entity: { value: 999 }, context }); // different entity, same generated key

      expect(policy.callCount).toBe(1); // second call served from cache despite differing entity
    });

    it('omitting keyGenerator falls back to the documented default (hash of context + entity: same input hits, different input misses)', async () => {
      const policy = new TestPolicy();
      const context = PolicyContextBuilder.forUser('kg-default-user')
        .withEnvironment('test')
        .build();
      const cached = PolicyCachingBehavior.create(policy, { ttl: 60000 }); // keyGenerator omitted

      await cached.check({ entity: { value: 1 }, context });
      await cached.check({ entity: { value: 1 }, context }); // same entity+context -> hit
      expect(policy.callCount).toBe(1);

      await cached.check({ entity: { value: 2 }, context }); // different entity -> miss
      expect(policy.callCount).toBe(2);
    });
  });

  describe('maxSize (optional)', () => {
    it('explicit maxSize is enforced: eviction happens once the cache exceeds that many entries', async () => {
      const policy = new TestPolicy();
      const context = PolicyContextBuilder.forUser('maxsize-user').withEnvironment('test').build();
      const cached = PolicyCachingBehavior.create(policy, { ttl: 60000, maxSize: 3 });

      for (let i = 0; i < 3; i++) {
        await cached.check({ entity: { value: i }, context });
      }
      expect(cached.getCacheSize()).toBe(3);
      expect(cached.getCacheMetrics().evictions).toBe(0);

      await cached.check({ entity: { value: 999 }, context }); // 4th distinct key
      expect(cached.getCacheSize()).toBe(3); // still capped at the explicit maxSize
      expect(cached.getCacheMetrics().evictions).toBe(1);
    });

    it('omitting maxSize does NOT leave the cache unbounded — it falls back to a bounded internal default (VB-006 F6/F7 regression)', async () => {
      const policy = new TestPolicy();
      const context = PolicyContextBuilder.forUser('maxsize-omitted-user')
        .withEnvironment('test')
        .build();
      const cached = PolicyCachingBehavior.create(policy, { ttl: 60000 }); // maxSize omitted

      // Comfortably above any sane bound this library would ever pick, and
      // well above the documented internal default. We deliberately do NOT
      // assert an exact number here — that constant is an implementation
      // detail, not part of the public contract — only that it stays
      // bounded, which is the actual documented promise.
      const entryCount = 1200;
      for (let i = 0; i < entryCount; i++) {
        await cached.check({ entity: { value: i }, context });
      }

      expect(cached.getCacheSize()).toBeLessThan(entryCount);
      expect(cached.getCacheMetrics().evictions).toBeGreaterThan(0);
    });
  });

  describe('cacheFailures (optional)', () => {
    it('explicit true is respected: a denial is cached and the inner policy is not re-invoked', async () => {
      const policy = new TestPolicy();
      policy.shouldFail = true;
      const context = PolicyContextBuilder.forUser('cf-true-user').withEnvironment('test').build();
      const cached = PolicyCachingBehavior.create(policy, { ttl: 60000, cacheFailures: true });
      const request = { entity: { value: 1 }, context };

      const r1 = await cached.check(request);
      expect(r1.isFailure).toBe(true);
      const r2 = await cached.check(request);
      expect(r2.isFailure).toBe(true);
      expect(policy.callCount).toBe(1); // second denial served from cache
    });

    it('explicit false is respected: a denial is NOT cached and the inner policy re-runs on every call', async () => {
      const policy = new TestPolicy();
      policy.shouldFail = true;
      const context = PolicyContextBuilder.forUser('cf-false-user').withEnvironment('test').build();
      const cached = PolicyCachingBehavior.create(policy, { ttl: 60000, cacheFailures: false });
      const request = { entity: { value: 1 }, context };

      await cached.check(request);
      await cached.check(request);
      expect(policy.callCount).toBe(2);
      expect(cached.getCacheSize()).toBe(0);
    });

    it('omitting cacheFailures behaves like explicit false (denials not cached) via a separate, distinguishable code path', async () => {
      const policy = new TestPolicy();
      policy.shouldFail = true;
      const context = PolicyContextBuilder.forUser('cf-omitted-user')
        .withEnvironment('test')
        .build();
      const cached = PolicyCachingBehavior.create(policy, { ttl: 60000 }); // cacheFailures omitted
      const request = { entity: { value: 1 }, context };

      await cached.check(request);
      await cached.check(request);
      expect(policy.callCount).toBe(2);
      expect(cached.getCacheSize()).toBe(0);
    });
  });

  describe('enableMetrics (optional)', () => {
    it('explicit true is respected: metrics are collected', async () => {
      const policy = new TestPolicy();
      const context = PolicyContextBuilder.forUser('em-true-user').withEnvironment('test').build();
      const cached = PolicyCachingBehavior.create(policy, { ttl: 60000, enableMetrics: true });

      await cached.check({ entity: { value: 1 }, context }); // miss
      await cached.check({ entity: { value: 1 }, context }); // hit

      const metrics = cached.getCacheMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
    });

    // VB-006: `enableMetrics` used to be declared and documented in
    // `PolicyCacheConfig` but never read — metrics were collected
    // unconditionally, exactly the dead-switch defect class this file
    // exists to guard against (the same one AC1 fixed for `cacheFailures`).
    // It is now honoured, so this is a normal test, not an inverted one.
    it('explicit false is respected: metrics are NOT collected', async () => {
      const policy = new TestPolicy();
      const context = PolicyContextBuilder.forUser('em-false-user').withEnvironment('test').build();
      const cached = PolicyCachingBehavior.create(policy, { ttl: 60000, enableMetrics: false });

      await cached.check({ entity: { value: 1 }, context }); // miss
      await cached.check({ entity: { value: 1 }, context }); // hit

      const metrics = cached.getCacheMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.entries).toBe(0);
    });

    it('disabling metrics does not disable caching: the inner policy still runs only once', async () => {
      const policy = new TestPolicy();
      const context = PolicyContextBuilder.forUser('em-behaviour-user')
        .withEnvironment('test')
        .build();
      const cached = PolicyCachingBehavior.create(policy, { ttl: 60000, enableMetrics: false });

      await cached.check({ entity: { value: 1 }, context });
      await cached.check({ entity: { value: 1 }, context });

      // Counters are observational only — suppressing them must not change
      // what is cached, otherwise the switch would be a behavioural change
      // in disguise.
      expect(policy.callCount).toBe(1);
    });

    it('omitting enableMetrics falls back to the documented default (collection ON)', async () => {
      const policy = new TestPolicy();
      const context = PolicyContextBuilder.forUser('em-omitted-user')
        .withEnvironment('test')
        .build();
      const cached = PolicyCachingBehavior.create(policy, { ttl: 60000 });

      await cached.check({ entity: { value: 1 }, context }); // miss
      await cached.check({ entity: { value: 1 }, context }); // hit

      const metrics = cached.getCacheMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
    });
  });

  describe('namespace (optional)', () => {
    // JSDoc: "Cache namespace/prefix for this policy". The internal key
    // format is `${namespace}:${combinedHash}` (see cached-policy.ts,
    // generateCacheKey) — namespace defaults to `innerPolicy.id` when
    // omitted. `PolicyCache` itself is internal/unexported and never
    // shared across `PolicyCachingBehavior` instances, so two SEPARATE
    // instances are always isolated regardless of what namespace value
    // (or none) they're given — asserting isolation across two instances
    // would be true even if `namespace` were silently ignored, i.e. it is
    // vacuous with respect to this option specifically (it doesn't
    // distinguish "namespace is read and used" from "namespace is dead").
    //
    // To get a REAL assertion on the option's own effect without reaching
    // into any private field (no `as any`, no touching `PolicyCache`), we
    // exploit the one legitimate public channel available: `namespace`
    // lives on the plain `PolicyCacheConfig` object the caller supplies to
    // `PolicyCachingBehavior.create()`, that object is stored by reference
    // (not cloned or frozen), and `generateCacheKey()` re-reads
    // `this.config.namespace` on every single `check()` call rather than
    // capturing it once at construction. So on ONE instance (one private
    // cache, one inner-policy call counter) we can mutate the config
    // object's `namespace` field between calls and observe whether that
    // changes cache hit/miss behaviour for the identical entity+context —
    // which is possible if and only if `namespace` actually flows into the
    // generated key on each call.
    it('explicit namespace is respected: changing it on the same instance turns a would-be cache HIT into a MISS', async () => {
      const policy = new TestPolicy('ns-policy');
      const context = PolicyContextBuilder.forUser('ns-user').withEnvironment('test').build();
      const entity = { value: 42 };

      const config: PolicyCacheConfig = { ttl: 60000, namespace: 'namespace-one' };
      const cached = PolicyCachingBehavior.create(policy, config);

      await cached.check({ entity, context }); // miss: inner policy runs
      expect(policy.callCount).toBe(1);
      await cached.check({ entity, context }); // same namespace -> hit
      expect(policy.callCount).toBe(1);

      // Mutate the SAME config object's namespace. If `namespace` were
      // dead (never read from config on each call), this would still hit
      // and callCount would stay at 1.
      config.namespace = 'namespace-two';
      await cached.check({ entity, context }); // new namespace -> different key -> miss
      expect(policy.callCount).toBe(2);

      // Both keys (one per namespace value) now coexist in the same
      // instance's cache — direct evidence the namespace is part of the
      // stored key, not merely consulted and discarded.
      expect(cached.getCacheSize()).toBe(2);

      // Reverting back to the original namespace value hits the
      // still-present first entry again — confirms it's a real key
      // component, not a one-way invalidation side effect.
      config.namespace = 'namespace-one';
      await cached.check({ entity, context });
      expect(policy.callCount).toBe(2);
    });

    it('omitting namespace falls back to the documented default (innerPolicy.id), not an empty/constant prefix', async () => {
      const policy = new TestPolicy('ns-omit-fallback-id');
      const context = PolicyContextBuilder.forUser('ns-omit-user').withEnvironment('test').build();
      const entity = { value: 7 };

      const config: PolicyCacheConfig = { ttl: 60000 }; // namespace omitted entirely
      const cached = PolicyCachingBehavior.create(policy, config);

      await cached.check({ entity, context }); // miss, default namespace applied
      expect(policy.callCount).toBe(1);
      await cached.check({ entity, context }); // same (omitted) default -> hit
      expect(policy.callCount).toBe(1);

      // Now set namespace EXPLICITLY to exactly the policy's own id — the
      // documented fallback value. If the default truly is
      // `innerPolicy.id`, this must generate the SAME key as before, so
      // this stays a hit (no new entry, callCount unchanged).
      config.namespace = 'ns-omit-fallback-id';
      await cached.check({ entity, context });
      expect(policy.callCount).toBe(1);
      expect(cached.getCacheSize()).toBe(1);

      // A namespace that does NOT match the fallback value must produce a
      // genuinely different key -> miss, second entry.
      config.namespace = 'some-other-namespace';
      await cached.check({ entity, context });
      expect(policy.callCount).toBe(2);
      expect(cached.getCacheSize()).toBe(2);
    });
  });
});
