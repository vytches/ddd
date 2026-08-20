/**
 * VP-006c — `tryResolve` hook and Set-based cycle detection on
 * `BaseContainerAdapter`.
 *
 * Two properties matter here, and the second is the risky one:
 *
 * 1. `resolveDependency()` performs ONE lookup pass, not `isRegistered()`
 *    followed by `resolve()`.
 * 2. A subclass that overrides only `resolve()` — every adapter written against
 *    the previous contract — keeps working unchanged. The protected surface of
 *    this class is public API for adapter authors (see
 *    `packages/di/FRAMEWORK-ADAPTERS.md`), so the default `tryResolve` must
 *    reproduce the old two-pass behaviour exactly.
 */
import { describe, it, expect, vi } from 'vitest';
import { BaseContainerAdapter, NOT_REGISTERED } from '../../src/adapters/base-adapter';
import { CircularDependencyError, ContainerServiceNotFoundError } from '../../src/errors';
import type { ServiceDescriptor, ServiceToken } from '../../src/types';

/** Adapter written against the OLD contract: overrides `resolve()` only. */
class LegacyAdapter extends BaseContainerAdapter {
  readonly registry = new Map<ServiceToken, unknown>();
  isRegisteredCalls = 0;
  resolveCalls = 0;

  resolve<T>(token: ServiceToken<T>): T {
    this.resolveCalls++;
    return this.registry.get(token) as T;
  }

  isRegistered<T>(token: ServiceToken<T>): boolean {
    this.isRegisteredCalls++;
    return this.registry.has(token);
  }

  register(): void {
    // Unused by these tests — resolveDependency() is the subject.
  }
  registerFactory(): void {
    // Unused by these tests.
  }
  registerInstance(): void {
    // Unused by these tests.
  }
  getServices(): ServiceDescriptor[] {
    return [];
  }

  /** Exposes the protected helper for the tests. */
  callResolveDependency<T>(param: ServiceToken<T>, owner: ServiceToken): T {
    return this.resolveDependency(param, owner);
  }
}

/** Adapter written against the NEW contract: single native pass. */
class SinglePassAdapter extends LegacyAdapter {
  tryResolveCalls = 0;

  protected override tryResolve<T>(token: ServiceToken<T>): T | typeof NOT_REGISTERED {
    this.tryResolveCalls++;
    return this.registry.has(token) ? (this.registry.get(token) as T) : NOT_REGISTERED;
  }
}

describe('VP-006c — BaseContainerAdapter.tryResolve', () => {
  it('resolves through the default hook with the historical two-pass behaviour', () => {
    const adapter = new LegacyAdapter();
    adapter.registry.set('dep', 'value');

    expect(adapter.callResolveDependency('dep', 'owner')).toBe('value');
    expect(adapter.isRegisteredCalls).toBe(1);
    expect(adapter.resolveCalls).toBe(1);
  });

  it('lets an override collapse the lookup to a single pass', () => {
    const adapter = new SinglePassAdapter();
    adapter.registry.set('dep', 'value');

    expect(adapter.callResolveDependency('dep', 'owner')).toBe('value');
    expect(adapter.tryResolveCalls).toBe(1);
    // The point of the hook: neither of these runs any more.
    expect(adapter.isRegisteredCalls).toBe(0);
    expect(adapter.resolveCalls).toBe(0);
  });

  it('still raises ContainerServiceNotFoundError for a miss, via either route', () => {
    for (const adapter of [new LegacyAdapter(), new SinglePassAdapter()]) {
      expect(() => adapter.callResolveDependency('absent', 'owner')).toThrow(
        ContainerServiceNotFoundError
      );
    }
  });

  it('treats a registered `undefined` as a hit, not a miss', () => {
    // Why the sentinel exists: `undefined` is a legitimate resolved value, and
    // returning it for a miss would turn a working registration into an error.
    const adapter = new SinglePassAdapter();
    adapter.registry.set('dep', undefined);

    expect(adapter.callResolveDependency('dep', 'owner')).toBeUndefined();
  });
});

describe('VP-006c — Set-based cycle detection', () => {
  it('reports the full resolution chain, ordering preserved', () => {
    class CyclicAdapter extends LegacyAdapter {
      override resolve<T>(token: ServiceToken<T>): T {
        // a → b → c → a
        const next: Record<string, string | undefined> = { a: 'b', b: 'c', c: 'a' };
        const dependency = next[token as string];
        if (dependency) this.resolveDependency(dependency, token);
        return undefined as T;
      }

      override isRegistered(): boolean {
        return true;
      }
    }

    const adapter = new CyclicAdapter();

    try {
      adapter.callResolveDependency('a', 'owner');
      expect.unreachable('expected a circular dependency');
    } catch (error) {
      expect(error).toBeInstanceOf(CircularDependencyError);
      // The Set answers membership; the array still supplies the chain, which
      // is the whole reason both are kept.
      expect((error as Error).message).toContain('a');
      expect((error as Error).message).toContain('b');
      expect((error as Error).message).toContain('c');
    }
  });

  it('unwinds cleanly, so a later resolution of the same token succeeds', () => {
    const adapter = new SinglePassAdapter();
    adapter.registry.set('dep', 'value');

    expect(adapter.callResolveDependency('dep', 'owner')).toBe('value');
    // If the Set were not popped alongside the array, this would be reported as
    // a cycle.
    expect(adapter.callResolveDependency('dep', 'owner')).toBe('value');
  });

  it('does not confuse sibling dependencies with a cycle', () => {
    class SiblingAdapter extends LegacyAdapter {
      override resolve<T>(token: ServiceToken<T>): T {
        if (token === 'root') {
          this.resolveDependency('leaf', 'root');
          this.resolveDependency('leaf', 'root');
        }
        return 'ok' as T;
      }

      override isRegistered(): boolean {
        return true;
      }
    }

    const adapter = new SiblingAdapter();
    expect(() => adapter.callResolveDependency('root', 'owner')).not.toThrow();
  });
});
