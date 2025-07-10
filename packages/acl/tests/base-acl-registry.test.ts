/* eslint-disable @typescript-eslint/no-inferrable-types */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ACLRegistrationMetadata, IACLAdapter, ACLContextInfo } from '../src';
import { BaseACLRegistry } from '../src/base-acl-registry';

// Test models
interface TestDomainModel {
  id: string;
  name: string;
}

interface TestExternalModel {
  external_id: string;
  display_name: string;
}

// Mock adapter implementation
class MockACLAdapter implements IACLAdapter<TestDomainModel, TestExternalModel> {
  constructor(private contextName: string) {}

  execute = vi.fn();
  fetch = vi.fn();
  supportsOperation = vi.fn(() => true);

  getContextInfo = vi.fn(
    (): ACLContextInfo => ({
      contextName: this.contextName,
      externalSystemName: 'TestSystem',
      version: '1.0.0',
      supportedOperations: ['CREATE', 'UPDATE'],
    })
  );
}

// Concrete implementation for testing
class TestACLRegistry extends BaseACLRegistry {
  constructor(private registryName: string = 'TestRegistry') {
    super();
  }

  public getRegistryName(): string {
    return this.registryName;
  }

  // Expose protected methods for testing
  public getAdapters() {
    return this.adapters;
  }

  public getMetadata() {
    return this.metadata;
  }
}

describe('BaseACLRegistry', () => {
  let registry: TestACLRegistry;

  beforeEach(() => {
    registry = new TestACLRegistry('TestRegistry');
  });

  describe('construction', () => {
    it('should initialize with empty adapters and metadata maps', () => {
      expect(registry.getAdapters().size).toBe(0);
      expect(registry.getMetadata().size).toBe(0);
    });

    it('should use provided registry name', () => {
      const customRegistry = new TestACLRegistry('CustomRegistryName');
      expect(customRegistry.getRegistryName()).toBe('CustomRegistryName');
    });
  });

  describe('register method', () => {
    it('should register adapter with minimal metadata', () => {
      const adapter = new MockACLAdapter('PaymentContext');

      const result = registry.register('PaymentContext', adapter);

      expect(result).toBe(registry); // Should return this for chaining
      expect(registry.hasContext('PaymentContext')).toBe(true);
      expect(registry.get('PaymentContext')).toBe(adapter);

      const metadata = registry.getMetadata().get('PaymentContext');
      expect(metadata).toBeDefined();
      expect(metadata!.contextName).toBe('PaymentContext');
      expect(metadata!.registeredBy).toBe('TestRegistry');
      expect(metadata!.registeredAt).toBeInstanceOf(Date);
    });

    it('should register adapter with full metadata', () => {
      const adapter = new MockACLAdapter('OrderContext');
      const customMetadata: Partial<ACLRegistrationMetadata> = {
        description: 'Order processing adapter',
        version: '2.1.0',
        source: 'module',
      };

      registry.register('OrderContext', adapter, customMetadata);

      const metadata = registry.getMetadata().get('OrderContext');
      expect(metadata).toBeDefined();
      expect(metadata!.contextName).toBe('OrderContext');
      expect(metadata!.description).toBe('Order processing adapter');
      expect(metadata!.version).toBe('2.1.0');
      expect(metadata!.source).toBe('module');
      expect(metadata!.registeredBy).toBe('TestRegistry');
      expect(metadata!.registeredAt).toBeInstanceOf(Date);
    });

    it('should overwrite existing adapter registration', () => {
      const adapter1 = new MockACLAdapter('TestContext');
      const adapter2 = new MockACLAdapter('TestContext');

      registry.register('TestContext', adapter1);
      expect(registry.get('TestContext')).toBe(adapter1);

      registry.register('TestContext', adapter2, { description: 'Updated adapter' });
      expect(registry.get('TestContext')).toBe(adapter2);

      const metadata = registry.getMetadata().get('TestContext');
      expect(metadata!.description).toBe('Updated adapter');
    });

    it('should support method chaining', () => {
      const adapter1 = new MockACLAdapter('Context1');
      const adapter2 = new MockACLAdapter('Context2');

      const result = registry.register('Context1', adapter1).register('Context2', adapter2);

      expect(result).toBe(registry);
      expect(registry.hasContext('Context1')).toBe(true);
      expect(registry.hasContext('Context2')).toBe(true);
    });
  });

  describe('get method', () => {
    it('should return registered adapter', () => {
      const adapter = new MockACLAdapter('TestContext');
      registry.register('TestContext', adapter);

      const retrieved = registry.get<TestDomainModel, TestExternalModel>('TestContext');
      expect(retrieved).toBe(adapter);
    });

    it('should return undefined for non-existent context', () => {
      const retrieved = registry.get('NonExistentContext');
      expect(retrieved).toBeUndefined();
    });

    it('should maintain type safety with generics', () => {
      const adapter = new MockACLAdapter('TypedContext');
      registry.register('TypedContext', adapter);

      // TypeScript should infer the correct types
      const retrieved = registry.get<TestDomainModel, TestExternalModel>('TypedContext');
      expect(retrieved).toBe(adapter);
    });
  });

  describe('getRequired method', () => {
    it('should return registered adapter', () => {
      const adapter = new MockACLAdapter('TestContext');
      registry.register('TestContext', adapter);

      const retrieved = registry.getRequired<TestDomainModel, TestExternalModel>('TestContext');
      expect(retrieved).toBe(adapter);
    });

    it('should throw error for non-existent context', () => {
      expect(() => {
        registry.getRequired('NonExistentContext');
      }).toThrow('ACL adapter not found for context: NonExistentContext');
    });

    it('should maintain type safety with generics', () => {
      const adapter = new MockACLAdapter('TypedContext');
      registry.register('TypedContext', adapter);

      // Should not throw and return the correct type
      expect(() => {
        const retrieved = registry.getRequired<TestDomainModel, TestExternalModel>('TypedContext');
        expect(retrieved).toBe(adapter);
      }).not.toThrow();
    });
  });

  describe('hasContext method', () => {
    it('should return true for registered context', () => {
      const adapter = new MockACLAdapter('TestContext');
      registry.register('TestContext', adapter);

      expect(registry.hasContext('TestContext')).toBe(true);
    });

    it('should return false for non-registered context', () => {
      expect(registry.hasContext('NonExistentContext')).toBe(false);
    });

    it('should return true after registration', () => {
      expect(registry.hasContext('NewContext')).toBe(false);

      const adapter = new MockACLAdapter('NewContext');
      registry.register('NewContext', adapter);

      expect(registry.hasContext('NewContext')).toBe(true);
    });
  });

  describe('getRegisteredContexts method', () => {
    it('should return empty array when no contexts registered', () => {
      const contexts = registry.getRegisteredContexts();
      expect(contexts).toEqual([]);
    });

    it('should return all registered context names', () => {
      const adapter1 = new MockACLAdapter('Context1');
      const adapter2 = new MockACLAdapter('Context2');
      const adapter3 = new MockACLAdapter('Context3');

      registry
        .register('Context1', adapter1)
        .register('Context2', adapter2)
        .register('Context3', adapter3);

      const contexts = registry.getRegisteredContexts();
      expect(contexts).toHaveLength(3);
      expect(contexts).toContain('Context1');
      expect(contexts).toContain('Context2');
      expect(contexts).toContain('Context3');
    });

    it('should not include duplicates when context is re-registered', () => {
      const adapter1 = new MockACLAdapter('TestContext');
      const adapter2 = new MockACLAdapter('TestContext');

      registry.register('TestContext', adapter1);
      registry.register('TestContext', adapter2); // Re-register

      const contexts = registry.getRegisteredContexts();
      expect(contexts).toEqual(['TestContext']);
    });
  });

  describe('exportAdapters method', () => {
    it('should return copy of adapters map', () => {
      const adapter1 = new MockACLAdapter('Context1');
      const adapter2 = new MockACLAdapter('Context2');

      registry.register('Context1', adapter1).register('Context2', adapter2);

      const exported = registry.exportAdapters();

      expect(exported.size).toBe(2);
      expect(exported.get('Context1')).toBe(adapter1);
      expect(exported.get('Context2')).toBe(adapter2);

      // Should be a copy, not the same instance
      expect(exported).not.toBe(registry.getAdapters());
    });

    it('should return empty map when no adapters registered', () => {
      const exported = registry.exportAdapters();
      expect(exported.size).toBe(0);
    });

    it('should not affect original when exported map is modified', () => {
      const adapter = new MockACLAdapter('TestContext');
      registry.register('TestContext', adapter);

      const exported = registry.exportAdapters();
      exported.delete('TestContext');

      // Original should remain unchanged
      expect(registry.hasContext('TestContext')).toBe(true);
      expect(exported.has('TestContext')).toBe(false);
    });
  });

  describe('metadata management', () => {
    it('should automatically set registration timestamp', () => {
      const beforeRegistration = new Date();
      const adapter = new MockACLAdapter('TestContext');

      registry.register('TestContext', adapter);

      const afterRegistration = new Date();
      const metadata = registry.getMetadata().get('TestContext');

      expect(metadata!.registeredAt).toBeInstanceOf(Date);
      expect(metadata!.registeredAt.getTime()).toBeGreaterThanOrEqual(beforeRegistration.getTime());
      expect(metadata!.registeredAt.getTime()).toBeLessThanOrEqual(afterRegistration.getTime());
    });

    it('should preserve custom metadata while adding required fields', () => {
      const adapter = new MockACLAdapter('TestContext');
      const customMetadata: Partial<ACLRegistrationMetadata> = {
        description: 'Custom description',
        version: '3.0.0',
      };

      registry.register('TestContext', adapter, customMetadata);

      const metadata = registry.getMetadata().get('TestContext');
      expect(metadata!.description).toBe('Custom description');
      expect(metadata!.version).toBe('3.0.0');
      expect(metadata!.contextName).toBe('TestContext'); // Auto-added
      expect(metadata!.registeredBy).toBe('TestRegistry'); // Auto-added
      expect(metadata!.registeredAt).toBeInstanceOf(Date); // Auto-added
    });

    it('should update metadata when adapter is re-registered', () => {
      vi.useFakeTimers();

      const adapter = new MockACLAdapter('TestContext');

      registry.register('TestContext', adapter, { description: 'Initial description' });
      const initialMetadata = registry.getMetadata().get('TestContext');

      // Small delay to ensure different timestamps
      vi.advanceTimersByTime(10);

      registry.register('TestContext', adapter, { description: 'Updated description' });
      const updatedMetadata = registry.getMetadata().get('TestContext');

      expect(updatedMetadata!.description).toBe('Updated description');
      expect(updatedMetadata!.registeredAt.getTime()).toBeGreaterThan(
        initialMetadata!.registeredAt.getTime()
      );

      vi.useRealTimers();
    });
  });

  describe('abstract method implementation', () => {
    it('should require concrete implementation of getRegistryName', () => {
      // This is tested through the constructor and usage
      expect(registry.getRegistryName()).toBe('TestRegistry');
    });

    it('should allow different registry names for different instances', () => {
      const registry1 = new TestACLRegistry('Registry1');
      const registry2 = new TestACLRegistry('Registry2');

      expect(registry1.getRegistryName()).toBe('Registry1');
      expect(registry2.getRegistryName()).toBe('Registry2');
    });
  });
});
