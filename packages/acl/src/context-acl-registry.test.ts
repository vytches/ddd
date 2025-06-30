import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextACLRegistry } from './context-acl-registry';
import type { IACLAdapter, ACLContextInfo } from './acl.interfaces';

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
  
  getContextInfo = vi.fn((): ACLContextInfo => ({
    contextName: this.contextName,
    externalSystemName: 'TestSystem',
    version: '1.0.0',
    supportedOperations: ['CREATE', 'UPDATE'],
  }));
}

describe('ContextACLRegistry', () => {
  let registry: ContextACLRegistry;
  const contextName = 'OrderManagement';

  beforeEach(() => {
    registry = new ContextACLRegistry(contextName);
  });

  describe('construction', () => {
    it('should initialize with provided context name', () => {
      expect(registry.getRegistryName()).toBe(`ContextACLRegistry(${contextName})`);
    });

    it('should inherit BaseACLRegistry functionality', () => {
      expect(registry.getRegisteredContexts()).toEqual([]);
      expect(registry.hasContext('AnyContext')).toBe(false);
    });

    it('should allow different context names for different instances', () => {
      const registry1 = new ContextACLRegistry('Context1');
      const registry2 = new ContextACLRegistry('Context2');

      expect(registry1.getRegistryName()).toBe('ContextACLRegistry(Context1)');
      expect(registry2.getRegistryName()).toBe('ContextACLRegistry(Context2)');
    });
  });

  describe('registerLocal method', () => {
    it('should register adapter with module source metadata', () => {
      const adapter = new MockACLAdapter('PaymentService');

      const result = registry.registerLocal('PaymentService', adapter);

      expect(result).toBe(registry); // Should return this for chaining
      expect(registry.hasContext('PaymentService')).toBe(true);
      expect(registry.get('PaymentService')).toBe(adapter);

      // Check metadata through internal access
      const metadata = (registry as any).metadata.get('PaymentService');
      expect(metadata.source).toBe('module');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.contextName).toBe('PaymentService');
      expect(metadata.registeredBy).toBe(`ContextACLRegistry(${contextName})`);
      expect(metadata.description).toBeUndefined();
    });

    it('should register adapter with description', () => {
      const adapter = new MockACLAdapter('InventoryService');
      const description = 'Inventory management adapter for local context';

      registry.registerLocal('InventoryService', adapter, description);

      expect(registry.hasContext('InventoryService')).toBe(true);
      
      const metadata = (registry as any).metadata.get('InventoryService');
      expect(metadata.source).toBe('module');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe(description);
      expect(metadata.registeredBy).toBe(`ContextACLRegistry(${contextName})`);
    });

    it('should support method chaining', () => {
      const adapter1 = new MockACLAdapter('Service1');
      const adapter2 = new MockACLAdapter('Service2');

      const result = registry
        .registerLocal('Service1', adapter1, 'First service')
        .registerLocal('Service2', adapter2, 'Second service');

      expect(result).toBe(registry);
      expect(registry.hasContext('Service1')).toBe(true);
      expect(registry.hasContext('Service2')).toBe(true);
    });

    it('should allow registering adapters with same name as context', () => {
      const adapter = new MockACLAdapter(contextName);

      registry.registerLocal(contextName, adapter);

      expect(registry.hasContext(contextName)).toBe(true);
      expect(registry.get(contextName)).toBe(adapter);
    });

    it('should overwrite existing registration', () => {
      const adapter1 = new MockACLAdapter('TestService');
      const adapter2 = new MockACLAdapter('TestService');

      registry.registerLocal('TestService', adapter1, 'First registration');
      expect(registry.get('TestService')).toBe(adapter1);

      registry.registerLocal('TestService', adapter2, 'Second registration');
      expect(registry.get('TestService')).toBe(adapter2);

      const metadata = (registry as any).metadata.get('TestService');
      expect(metadata.description).toBe('Second registration');
    });
  });

  describe('inherited BaseACLRegistry functionality', () => {
    it('should support get method', () => {
      const adapter = new MockACLAdapter('TestService');
      registry.registerLocal('TestService', adapter);

      const retrieved = registry.get<TestDomainModel, TestExternalModel>('TestService');
      expect(retrieved).toBe(adapter);
    });

    it('should support getRequired method', () => {
      const adapter = new MockACLAdapter('TestService');
      registry.registerLocal('TestService', adapter);

      const retrieved = registry.getRequired<TestDomainModel, TestExternalModel>('TestService');
      expect(retrieved).toBe(adapter);
    });

    it('should throw error for non-existent adapter in getRequired', () => {
      expect(() => {
        registry.getRequired('NonExistentService');
      }).toThrow('ACL adapter not found for context: NonExistentService');
    });

    it('should support hasContext method', () => {
      expect(registry.hasContext('TestService')).toBe(false);

      const adapter = new MockACLAdapter('TestService');
      registry.registerLocal('TestService', adapter);

      expect(registry.hasContext('TestService')).toBe(true);
    });

    it('should support getRegisteredContexts method', () => {
      expect(registry.getRegisteredContexts()).toEqual([]);

      const adapter1 = new MockACLAdapter('Service1');
      const adapter2 = new MockACLAdapter('Service2');

      registry
        .registerLocal('Service1', adapter1)
        .registerLocal('Service2', adapter2);

      const contexts = registry.getRegisteredContexts();
      expect(contexts).toHaveLength(2);
      expect(contexts).toContain('Service1');
      expect(contexts).toContain('Service2');
    });

    it('should support exportAdapters method', () => {
      const adapter1 = new MockACLAdapter('Service1');
      const adapter2 = new MockACLAdapter('Service2');

      registry
        .registerLocal('Service1', adapter1)
        .registerLocal('Service2', adapter2);

      const exported = registry.exportAdapters();
      expect(exported.size).toBe(2);
      expect(exported.get('Service1')).toBe(adapter1);
      expect(exported.get('Service2')).toBe(adapter2);

      // Should be a copy
      expect(exported).not.toBe((registry as any).adapters);
    });
  });

  describe('context-specific behavior', () => {
    it('should maintain separate registrations for different context registries', () => {
      const registry1 = new ContextACLRegistry('Context1');
      const registry2 = new ContextACLRegistry('Context2');

      const adapter1 = new MockACLAdapter('SharedService');
      const adapter2 = new MockACLAdapter('SharedService');

      registry1.registerLocal('SharedService', adapter1);
      registry2.registerLocal('SharedService', adapter2);

      expect(registry1.get('SharedService')).toBe(adapter1);
      expect(registry2.get('SharedService')).toBe(adapter2);
      expect(registry1.get('SharedService')).not.toBe(registry2.get('SharedService'));
    });

    it('should track registration metadata with context-specific registry name', () => {
      const registry1 = new ContextACLRegistry('OrderContext');
      const registry2 = new ContextACLRegistry('PaymentContext');

      const adapter1 = new MockACLAdapter('TestService');
      const adapter2 = new MockACLAdapter('TestService');

      registry1.registerLocal('TestService', adapter1);
      registry2.registerLocal('TestService', adapter2);

      const metadata1 = (registry1 as any).metadata.get('TestService');
      const metadata2 = (registry2 as any).metadata.get('TestService');

      expect(metadata1.registeredBy).toBe('ContextACLRegistry(OrderContext)');
      expect(metadata2.registeredBy).toBe('ContextACLRegistry(PaymentContext)');
    });

    it('should handle empty context name gracefully', () => {
      const emptyRegistry = new ContextACLRegistry('');
      expect(emptyRegistry.getRegistryName()).toBe('ContextACLRegistry()');

      const adapter = new MockACLAdapter('TestService');
      emptyRegistry.registerLocal('TestService', adapter);

      expect(emptyRegistry.hasContext('TestService')).toBe(true);
    });

    it('should handle special characters in context name', () => {
      const specialRegistry = new ContextACLRegistry('Context/With-Special_Characters.123');
      expect(specialRegistry.getRegistryName()).toBe('ContextACLRegistry(Context/With-Special_Characters.123)');

      const adapter = new MockACLAdapter('TestService');
      specialRegistry.registerLocal('TestService', adapter);

      expect(specialRegistry.hasContext('TestService')).toBe(true);
    });
  });

  describe('integration with other registry types', () => {
    it('should export adapters for import by global registry', () => {
      const adapter1 = new MockACLAdapter('Service1');
      const adapter2 = new MockACLAdapter('Service2');

      registry
        .registerLocal('Service1', adapter1, 'First service')
        .registerLocal('Service2', adapter2, 'Second service');

      const exported = registry.exportAdapters();

      // This would typically be used by ACLRegistry.importFromContext
      expect(exported.size).toBe(2);
      expect(exported.has('Service1')).toBe(true);
      expect(exported.has('Service2')).toBe(true);

      // Verify that exported adapters maintain their identity
      expect(exported.get('Service1')).toBe(adapter1);
      expect(exported.get('Service2')).toBe(adapter2);
    });

    it('should maintain metadata consistency for export/import scenarios', () => {
      const adapter = new MockACLAdapter('ExportableService');
      registry.registerLocal('ExportableService', adapter, 'Service for export');

      const exported = registry.exportAdapters();
      const exportedAdapter = exported.get('ExportableService');

      expect(exportedAdapter).toBe(adapter);

      // Metadata should still be accessible through original registry
      const metadata = (registry as any).metadata.get('ExportableService');
      expect(metadata.description).toBe('Service for export');
      expect(metadata.source).toBe('module');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle registration with undefined description', () => {
      const adapter = new MockACLAdapter('TestService');

      expect(() => {
        registry.registerLocal('TestService', adapter, undefined);
      }).not.toThrow();

      expect(registry.hasContext('TestService')).toBe(true);
      const metadata = (registry as any).metadata.get('TestService');
      expect(metadata.description).toBeUndefined();
    });

    it('should handle registration with empty string description', () => {
      const adapter = new MockACLAdapter('TestService');

      registry.registerLocal('TestService', adapter, '');

      expect(registry.hasContext('TestService')).toBe(true);
      const metadata = (registry as any).metadata.get('TestService');
      expect(metadata.description).toBe('');
    });

    it('should handle multiple registrations with same target context name', () => {
      vi.useFakeTimers();
      
      const adapter1 = new MockACLAdapter('SameService');
      const adapter2 = new MockACLAdapter('SameService');

      registry.registerLocal('SameService', adapter1, 'First registration');
      
      // Verify first registration
      expect(registry.get('SameService')).toBe(adapter1);
      const firstMetadata = (registry as any).metadata.get('SameService');
      const firstTimestamp = firstMetadata.registeredAt;

      // Wait a bit to ensure different timestamp
      vi.advanceTimersByTime(10);

      registry.registerLocal('SameService', adapter2, 'Second registration');

      // Verify overwrite
      expect(registry.get('SameService')).toBe(adapter2);
      const secondMetadata = (registry as any).metadata.get('SameService');
      
      expect(secondMetadata.description).toBe('Second registration');
      expect(secondMetadata.registeredAt.getTime()).toBeGreaterThan(firstTimestamp.getTime());
      
      vi.useRealTimers();
    });

    it('should handle very long context and target names', () => {
      const longContextName = 'A'.repeat(1000);
      const longTargetName = 'B'.repeat(1000);
      
      const longContextRegistry = new ContextACLRegistry(longContextName);
      const adapter = new MockACLAdapter(longTargetName);

      expect(() => {
        longContextRegistry.registerLocal(longTargetName, adapter);
      }).not.toThrow();

      expect(longContextRegistry.hasContext(longTargetName)).toBe(true);
      expect(longContextRegistry.getRegistryName()).toBe(`ContextACLRegistry(${longContextName})`);
    });
  });
});