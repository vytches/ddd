import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';

import { BaseContainerAdapter } from '../../src/adapters/base-adapter';
import {
  CircularDependencyError,
  ContainerServiceNotFoundError,
  DIError,
  InvalidRegistrationError,
} from '../../src/errors';
import type {
  Constructor,
  ServiceDescriptor,
  ServiceFactory,
  ServiceRegistrationOptions,
  ServiceToken,
} from '../../src/types';

/**
 * Concrete fixture exposing the protected helpers (`getTokenKey`,
 * `validateToken`, `resolveDependency`) and the default `getServicesByTag`
 * to assert behavior without coupling to a real DI container.
 *
 * Storage is keyed by the token REFERENCE itself (strings by value),
 * mirroring the reference-identity semantics of the real containers.
 */
class TestAdapter extends BaseContainerAdapter {
  private readonly registered = new Map<ServiceToken, ServiceDescriptor>();

  resolve<T>(token: ServiceToken<T>): T {
    const descriptor = this.registered.get(token);
    if (!descriptor) {
      throw new ContainerServiceNotFoundError(token);
    }
    if (descriptor.instance !== undefined) {
      return descriptor.instance as T;
    }
    if (descriptor.factory) {
      return descriptor.factory(this) as T;
    }
    return new (descriptor.implementation as Constructor<T>)();
  }
  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void {
    this.validateToken(token);
    this.registered.set(token, {
      token,
      implementation,
      ...(options?.tags ? { tags: options.tags } : {}),
    } as ServiceDescriptor);
  }
  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): void {
    this.validateToken(token);
    this.registered.set(token, {
      token,
      factory,
      ...(options?.tags ? { tags: options.tags } : {}),
    } as ServiceDescriptor);
  }
  registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): void {
    this.validateToken(token);
    this.registered.set(token, {
      token,
      instance,
      ...(options?.tags ? { tags: options.tags } : {}),
    } as ServiceDescriptor);
  }
  isRegistered<T>(token: ServiceToken<T>): boolean {
    return this.registered.has(token);
  }
  getServices(): ServiceDescriptor[] {
    return Array.from(this.registered.values());
  }

  // Expose protected helpers for direct testing
  exposeGetTokenKey(token: ServiceToken): string {
    return this.getTokenKey(token);
  }
  exposeValidateToken(token: ServiceToken): void {
    this.validateToken(token);
  }
  exposeResolveDependency<T>(param: ServiceToken<T>, ownerToken: ServiceToken): T {
    return this.resolveDependency(param, ownerToken);
  }
}

class FooService {}

describe('BaseContainerAdapter — getTokenKey (deprecated display helper)', () => {
  const adapter = new TestAdapter();

  it('returns the string itself when token is a string', () => {
    expect(adapter.exposeGetTokenKey('AUTH_SERVICE')).toBe('AUTH_SERVICE');
  });

  it('returns toString() when token is a symbol', () => {
    const sym = Symbol('AUTH');
    expect(adapter.exposeGetTokenKey(sym)).toContain('AUTH');
  });

  it('returns the constructor name when token is a class', () => {
    expect(adapter.exposeGetTokenKey(FooService)).toBe('FooService');
  });

  it('returns a stable readable placeholder for anonymous classes (no name)', () => {
    const Anon = (() => class {})();
    Object.defineProperty(Anon, 'name', { value: '' });
    const key = adapter.exposeGetTokenKey(Anon as Constructor);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  it('is NOT an identity key: two same-named classes get the same display string', () => {
    const makeService = (): Constructor => {
      class Service {}
      return Service as Constructor;
    };
    const A = makeService();
    const B = makeService();
    // Display strings collide (lossy by design) ...
    expect(adapter.exposeGetTokenKey(A)).toBe(adapter.exposeGetTokenKey(B));
    // ... but container identity is the reference, so both coexist.
    adapter.register(A, A);
    adapter.register(B, B);
    expect(adapter.isRegistered(A)).toBe(true);
    expect(adapter.isRegistered(B)).toBe(true);
    expect(adapter.resolve(A)).toBeInstanceOf(A);
    expect(adapter.resolve(B)).toBeInstanceOf(B);
  });

  it('a subclass overriding getTokenKey still compiles and works (deprecated but supported)', () => {
    class CustomKeyAdapter extends TestAdapter {
      protected override getTokenKey(token: ServiceToken): string {
        return `custom:${super.getTokenKey(token)}`;
      }
    }
    const custom = new CustomKeyAdapter();
    expect(custom.exposeGetTokenKey('X')).toBe('custom:X');
    expect(custom.exposeGetTokenKey(FooService)).toBe('custom:FooService');
  });
});

describe('BaseContainerAdapter — validateToken', () => {
  const adapter = new TestAdapter();

  it('does not throw for valid tokens', () => {
    const [errString] = safeRun(() => adapter.exposeValidateToken('OK'));
    const [errClass] = safeRun(() => adapter.exposeValidateToken(FooService));
    const [errSymbol] = safeRun(() => adapter.exposeValidateToken(Symbol('s')));
    expect(errString).toBeUndefined();
    expect(errClass).toBeUndefined();
    expect(errSymbol).toBeUndefined();
  });

  it('throws InvalidRegistrationError when token is null', () => {
    const [error] = safeRun(() => adapter.exposeValidateToken(null as unknown as ServiceToken));
    expect(error).toBeInstanceOf(InvalidRegistrationError);
    expect(error).toBeInstanceOf(DIError);
  });

  it('throws InvalidRegistrationError when token is undefined', () => {
    const [error] = safeRun(() =>
      adapter.exposeValidateToken(undefined as unknown as ServiceToken)
    );
    expect(error).toBeInstanceOf(InvalidRegistrationError);
    expect(error).toBeInstanceOf(DIError);
  });
});

describe('BaseContainerAdapter — resolveDependency', () => {
  it('resolves a registered dependency', () => {
    const adapter = new TestAdapter();
    class Owner {}
    adapter.register(FooService, FooService);
    const resolved = adapter.exposeResolveDependency(FooService, Owner);
    expect(resolved).toBeInstanceOf(FooService);
  });

  it('resolves string and symbol dependency tokens', () => {
    const adapter = new TestAdapter();
    class Owner {}
    const sym = Symbol('DEP');
    adapter.registerInstance('CONFIG', { url: 'x' });
    adapter.registerInstance(sym, 42);
    expect(adapter.exposeResolveDependency('CONFIG', Owner)).toEqual({ url: 'x' });
    expect(adapter.exposeResolveDependency(sym, Owner)).toBe(42);
  });

  it('throws ContainerServiceNotFoundError for an unregistered dependency (never silently constructs)', () => {
    const adapter = new TestAdapter();
    class Owner {}
    class Unregistered {}
    const [error] = safeRun(() => adapter.exposeResolveDependency(Unregistered, Owner));
    expect(error).toBeInstanceOf(ContainerServiceNotFoundError);
    expect(error).toBeInstanceOf(DIError);
  });

  it('throws CircularDependencyError when a resolution cycle is detected', () => {
    const adapter = new TestAdapter();
    class A {}
    class B {}
    adapter.registerFactory(A, () => {
      adapter.exposeResolveDependency(B, A);
      return new A();
    });
    adapter.registerFactory(B, () => {
      adapter.exposeResolveDependency(A, B);
      return new B();
    });

    const [error] = safeRun(() => adapter.exposeResolveDependency(B, A));
    expect(error).toBeInstanceOf(CircularDependencyError);
    expect(error).toBeInstanceOf(DIError);
  });

  it('cleans up the resolution stack after a failed resolution', () => {
    const adapter = new TestAdapter();
    class A {}
    class B {}
    adapter.registerFactory(A, () => {
      adapter.exposeResolveDependency(B, A);
      return new A();
    });
    adapter.registerFactory(B, () => {
      adapter.exposeResolveDependency(A, B);
      return new B();
    });
    const [cycleError] = safeRun(() => adapter.exposeResolveDependency(A, B));
    expect(cycleError).toBeInstanceOf(CircularDependencyError);

    // After the cycle failure, non-cyclic resolution still works (no stale stack entries).
    adapter.register(FooService, FooService);
    expect(adapter.exposeResolveDependency(FooService, A)).toBeInstanceOf(FooService);
  });

  it('allows repeated non-cyclic resolution of the same dependency', () => {
    const adapter = new TestAdapter();
    class Owner {}
    adapter.register(FooService, FooService);
    expect(adapter.exposeResolveDependency(FooService, Owner)).toBeInstanceOf(FooService);
    expect(adapter.exposeResolveDependency(FooService, Owner)).toBeInstanceOf(FooService);
  });
});

describe('BaseContainerAdapter — getServicesByTag (default)', () => {
  it('returns [] when no service has the tag', () => {
    const adapter = new TestAdapter();
    adapter.register(FooService, FooService);
    expect(adapter.getServicesByTag('background')).toEqual([]);
  });

  it('returns all services that include the tag', () => {
    const adapter = new TestAdapter();
    class A {}
    class B {}
    class C {}
    adapter.register(A, A, { tags: ['background', 'cron'] });
    adapter.register(B, B, { tags: ['cron'] });
    adapter.register(C, C, { tags: ['background'] });

    const background = adapter.getServicesByTag('background');
    expect(background).toHaveLength(2);
    const cron = adapter.getServicesByTag('cron');
    expect(cron).toHaveLength(2);
  });

  it('handles services with no tags array gracefully', () => {
    const adapter = new TestAdapter();
    adapter.register(FooService, FooService); // no tags
    expect(adapter.getServicesByTag('any')).toEqual([]);
  });
});

describe('BaseContainerAdapter — abstract registration paths exercise validateToken', () => {
  it('register() rejects null token with InvalidRegistrationError', () => {
    const adapter = new TestAdapter();
    const [error] = safeRun(() => adapter.register(null as unknown as ServiceToken, FooService));
    expect(error).toBeInstanceOf(InvalidRegistrationError);
  });

  it('registerFactory() rejects null token with InvalidRegistrationError', () => {
    const adapter = new TestAdapter();
    const [error] = safeRun(() =>
      adapter.registerFactory(null as unknown as ServiceToken, () => new FooService())
    );
    expect(error).toBeInstanceOf(InvalidRegistrationError);
  });

  it('registerInstance() rejects null token with InvalidRegistrationError', () => {
    const adapter = new TestAdapter();
    const [error] = safeRun(() =>
      adapter.registerInstance(null as unknown as ServiceToken, new FooService())
    );
    expect(error).toBeInstanceOf(InvalidRegistrationError);
  });
});
