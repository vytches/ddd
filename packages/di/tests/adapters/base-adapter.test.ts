import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';

import { BaseContainerAdapter } from '../../src/adapters/base-adapter';
import type {
  Constructor,
  ServiceDescriptor,
  ServiceFactory,
  ServiceRegistrationOptions,
  ServiceToken,
} from '../../src/types';

/**
 * Concrete fixture exposing the protected helpers (`getTokenKey`,
 * `validateToken`) and the default `getServicesByTag` to assert behavior
 * without coupling to a real DI container.
 */
class TestAdapter extends BaseContainerAdapter {
  private readonly registered = new Map<string, ServiceDescriptor>();

  resolve<T>(_token: ServiceToken<T>): T {
    return undefined as unknown as T;
  }
  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void {
    this.validateToken(token);
    this.registered.set(this.getTokenKey(token), {
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
    this.registered.set(this.getTokenKey(token), {
      token,
      factory,
      ...(options?.tags ? { tags: options.tags } : {}),
    } as ServiceDescriptor);
  }
  registerInstance<T>(
    token: ServiceToken<T>,
    _instance: T,
    options?: ServiceRegistrationOptions
  ): void {
    this.validateToken(token);
    this.registered.set(this.getTokenKey(token), {
      token,
      ...(options?.tags ? { tags: options.tags } : {}),
    } as ServiceDescriptor);
  }
  isRegistered<T>(token: ServiceToken<T>): boolean {
    return this.registered.has(this.getTokenKey(token));
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
}

class FooService {}

describe('BaseContainerAdapter — getTokenKey', () => {
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

  it('falls back to toString() for anonymous classes (no name)', () => {
    const Anon = (() => class {})();
    Object.defineProperty(Anon, 'name', { value: '' });
    const key = adapter.exposeGetTokenKey(Anon as Constructor);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
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

  it('throws when token is null', () => {
    const [error] = safeRun(() => adapter.exposeValidateToken(null as unknown as ServiceToken));
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('null');
  });

  it('throws when token is undefined', () => {
    const [error] = safeRun(() =>
      adapter.exposeValidateToken(undefined as unknown as ServiceToken)
    );
    expect(error).toBeInstanceOf(Error);
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
  it('register() rejects null token', () => {
    const adapter = new TestAdapter();
    const [error] = safeRun(() => adapter.register(null as unknown as ServiceToken, FooService));
    expect(error).toBeInstanceOf(Error);
  });

  it('registerFactory() rejects null token', () => {
    const adapter = new TestAdapter();
    const [error] = safeRun(() =>
      adapter.registerFactory(null as unknown as ServiceToken, () => new FooService())
    );
    expect(error).toBeInstanceOf(Error);
  });

  it('registerInstance() rejects null token', () => {
    const adapter = new TestAdapter();
    const [error] = safeRun(() =>
      adapter.registerInstance(null as unknown as ServiceToken, new FooService())
    );
    expect(error).toBeInstanceOf(Error);
  });
});
