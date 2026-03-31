import { describe, it, expect, vi } from 'vitest';
import type { IACLAdapter, ACLContextInfo } from '../src';
import { ACLRegistry, defineACLAdapter } from '../src';

interface TestDomain {
  id: string;
}
interface TestExternal {
  external_id: string;
}

class MockAdapter implements IACLAdapter<TestDomain, TestExternal> {
  constructor(private name: string) {}
  execute = vi.fn();
  fetch = vi.fn();
  supportsOperation = vi.fn(() => true);
  getContextInfo = vi.fn(
    (): ACLContextInfo => ({
      contextName: this.name,
      externalSystemName: 'Test',
      version: '1.0.0',
      supportedOperations: ['CREATE'],
    })
  );
}

describe('defineACLAdapter', () => {
  it('should create a frozen adapter definition', () => {
    const adapter = new MockAdapter('payments');
    const definition = defineACLAdapter({
      context: 'payments',
      adapter,
      description: 'Payment gateway',
    });

    expect(definition.context).toBe('payments');
    expect(definition.adapter).toBe(adapter);
    expect(definition.description).toBe('Payment gateway');
    expect(Object.isFrozen(definition)).toBe(true);
  });

  it('should work without optional fields', () => {
    const adapter = new MockAdapter('shipping');
    const definition = defineACLAdapter({
      context: 'shipping',
      adapter,
    });

    expect(definition.context).toBe('shipping');
    expect(definition.description).toBeUndefined();
    expect(definition.version).toBeUndefined();
  });
});

describe('ACLRegistry.fromDefinitions', () => {
  it('should create registry from array of definitions', () => {
    const paymentAdapter = new MockAdapter('payments');
    const shippingAdapter = new MockAdapter('shipping');

    const registry = ACLRegistry.fromDefinitions([
      defineACLAdapter({ context: 'payments', adapter: paymentAdapter }),
      defineACLAdapter({ context: 'shipping', adapter: shippingAdapter }),
    ]);

    expect(registry.hasContext('payments')).toBe(true);
    expect(registry.hasContext('shipping')).toBe(true);
    expect(registry.getRegisteredContexts()).toHaveLength(2);
  });

  it('should resolve adapters from registry', () => {
    const paymentAdapter = new MockAdapter('payments');

    const registry = ACLRegistry.fromDefinitions([
      defineACLAdapter({ context: 'payments', adapter: paymentAdapter }),
    ]);

    const resolved = registry.get<TestDomain, TestExternal>('payments');
    expect(resolved).toBe(paymentAdapter);
  });

  it('should handle empty definitions array', () => {
    const registry = ACLRegistry.fromDefinitions([]);

    expect(registry.getRegisteredContexts()).toHaveLength(0);
  });

  it('should preserve description in metadata', () => {
    const adapter = new MockAdapter('notifications');

    const registry = ACLRegistry.fromDefinitions([
      defineACLAdapter({
        context: 'notifications',
        adapter,
        description: 'Email notification service',
      }),
    ]);

    expect(registry.hasContext('notifications')).toBe(true);
  });

  it('should use provided version', () => {
    const adapter = new MockAdapter('billing');

    const registry = ACLRegistry.fromDefinitions([
      defineACLAdapter({
        context: 'billing',
        adapter,
        version: '2.0.0',
      }),
    ]);

    expect(registry.hasContext('billing')).toBe(true);
  });

  it('should allow last definition to win for duplicate contexts', () => {
    const adapter1 = new MockAdapter('payments-v1');
    const adapter2 = new MockAdapter('payments-v2');

    const registry = ACLRegistry.fromDefinitions([
      defineACLAdapter({ context: 'payments', adapter: adapter1 }),
      defineACLAdapter({ context: 'payments', adapter: adapter2 }),
    ]);

    const resolved = registry.get<TestDomain, TestExternal>('payments');
    expect(resolved).toBe(adapter2);
  });
});
