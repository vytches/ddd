import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ImportOptions } from '../src/acl-registry';
import { ACLRegistry } from '../src/acl-registry';
import { ContextACLRegistry } from '../src/context-acl-registry';
import type { IACLAdapter, ACLContextInfo, IEnhancedACLAdapter } from '../src/acl.interfaces';

// Test models
interface TestDomainModel {
  id: string;
  name: string;
}

interface TestExternalModel {
  external_id: string;
  display_name: string;
}

// Mock adapter implementations
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

class MockEnhancedACLAdapter implements IEnhancedACLAdapter<TestDomainModel, TestExternalModel> {
  constructor(private contextName: string) {}

  execute = vi.fn();
  fetch = vi.fn();
  supportsOperation = vi.fn(() => true);
  executeTyped = vi.fn();
  use = vi.fn().mockReturnThis();

  getContextInfo = vi.fn(
    (): ACLContextInfo => ({
      contextName: this.contextName,
      externalSystemName: 'EnhancedTestSystem',
      version: '2.0.0',
      supportedOperations: ['CREATE', 'UPDATE', 'DELETE'],
    })
  );
}

describe('ACLRegistry', () => {
  let registry: ACLRegistry;

  beforeEach(() => {
    registry = new ACLRegistry();
  });

  describe('construction', () => {
    it('should extend BaseACLRegistry functionality', () => {
      expect(registry.getRegisteredContexts()).toEqual([]);
      expect(registry.hasContext('AnyContext')).toBe(false);
    });

    it('should have correct registry name', () => {
      // Access protected method through type assertion for testing
      expect((registry as any).getRegistryName()).toBe('GlobalACLRegistry');
    });
  });

  describe('registerDirect method', () => {
    it('should register adapter with direct source metadata', () => {
      const adapter = new MockACLAdapter('PaymentContext');

      const result = registry.registerDirect('PaymentContext', adapter);

      expect(result).toBe(registry); // Should return this for chaining
      expect(registry.hasContext('PaymentContext')).toBe(true);
      expect(registry.get('PaymentContext')).toBe(adapter);

      // Check metadata through internal access
      const metadata = (registry as any).metadata.get('PaymentContext');
      expect(metadata.source).toBe('direct');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBeUndefined();
    });

    it('should register adapter with description', () => {
      const adapter = new MockACLAdapter('OrderContext');
      const description = 'Order processing adapter for external system';

      registry.registerDirect('OrderContext', adapter, description);

      expect(registry.hasContext('OrderContext')).toBe(true);

      const metadata = (registry as any).metadata.get('OrderContext');
      expect(metadata.source).toBe('direct');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe(description);
    });

    it('should support method chaining', () => {
      const adapter1 = new MockACLAdapter('Context1');
      const adapter2 = new MockACLAdapter('Context2');

      const result = registry
        .registerDirect('Context1', adapter1, 'First adapter')
        .registerDirect('Context2', adapter2, 'Second adapter');

      expect(result).toBe(registry);
      expect(registry.hasContext('Context1')).toBe(true);
      expect(registry.hasContext('Context2')).toBe(true);
    });
  });

  describe('registerEnhanced method', () => {
    it('should register enhanced adapter with enhanced source metadata', () => {
      const adapter = new MockEnhancedACLAdapter('PaymentContext');

      const result = registry.registerEnhanced('PaymentContext', adapter);

      expect(result).toBe(registry); // Should return this for chaining
      expect(registry.hasContext('PaymentContext')).toBe(true);
      expect(registry.get('PaymentContext')).toBe(adapter);

      const metadata = (registry as any).metadata.get('PaymentContext');
      expect(metadata.source).toBe('enhanced');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBeUndefined();
    });

    it('should register enhanced adapter with description', () => {
      const adapter = new MockEnhancedACLAdapter('AdvancedContext');
      const description = 'Advanced adapter with middleware support';

      registry.registerEnhanced('AdvancedContext', adapter, description);

      expect(registry.hasContext('AdvancedContext')).toBe(true);

      const metadata = (registry as any).metadata.get('AdvancedContext');
      expect(metadata.source).toBe('enhanced');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe(description);
    });

    it('should support method chaining with enhanced adapters', () => {
      const adapter1 = new MockEnhancedACLAdapter('Enhanced1');
      const adapter2 = new MockEnhancedACLAdapter('Enhanced2');

      const result = registry
        .registerEnhanced('Enhanced1', adapter1, 'First enhanced')
        .registerEnhanced('Enhanced2', adapter2, 'Second enhanced');

      expect(result).toBe(registry);
      expect(registry.hasContext('Enhanced1')).toBe(true);
      expect(registry.hasContext('Enhanced2')).toBe(true);
    });
  });

  describe('importFromContext method', () => {
    let sourceRegistry: ContextACLRegistry;

    beforeEach(() => {
      sourceRegistry = new ContextACLRegistry('SourceContext');
    });

    it('should import all adapters from context registry', () => {
      const adapter1 = new MockACLAdapter('Context1');
      const adapter2 = new MockACLAdapter('Context2');

      sourceRegistry.registerLocal('Context1', adapter1);
      sourceRegistry.registerLocal('Context2', adapter2);

      const result = registry.importFromContext(sourceRegistry);

      expect(result.imported).toEqual(['Context1', 'Context2']);
      expect(result.skipped).toEqual([]);
      expect(result.conflicts).toEqual([]);

      expect(registry.hasContext('Context1')).toBe(true);
      expect(registry.hasContext('Context2')).toBe(true);
      expect(registry.get('Context1')).toBe(adapter1);
      expect(registry.get('Context2')).toBe(adapter2);
    });

    it('should handle conflicts when adapter already exists', () => {
      const existingAdapter = new MockACLAdapter('ConflictContext');
      const newAdapter = new MockACLAdapter('ConflictContext');

      // Register in global registry first
      registry.registerDirect('ConflictContext', existingAdapter);

      // Register in source registry
      sourceRegistry.registerLocal('ConflictContext', newAdapter);

      const result = registry.importFromContext(sourceRegistry);

      expect(result.imported).toEqual([]);
      expect(result.skipped).toEqual(['ConflictContext']);
      expect(result.conflicts).toEqual([
        { contextName: 'ConflictContext', reason: 'Already registered' },
      ]);

      // Should keep the original adapter
      expect(registry.get('ConflictContext')).toBe(existingAdapter);
    });

    it('should overwrite conflicts when overwriteConflicts is true', () => {
      const existingAdapter = new MockACLAdapter('ConflictContext');
      const newAdapter = new MockACLAdapter('ConflictContext');

      registry.registerDirect('ConflictContext', existingAdapter);
      sourceRegistry.registerLocal('ConflictContext', newAdapter);

      const options: ImportOptions = { overwriteConflicts: true };
      const result = registry.importFromContext(sourceRegistry, options);

      expect(result.imported).toEqual(['ConflictContext']);
      expect(result.skipped).toEqual([]);
      expect(result.conflicts).toEqual([]);

      // Should have the new adapter
      expect(registry.get('ConflictContext')).toBe(newAdapter);
    });

    it('should import some adapters and skip conflicts', () => {
      const existingAdapter = new MockACLAdapter('ExistingContext');
      const newAdapter1 = new MockACLAdapter('ExistingContext');
      const newAdapter2 = new MockACLAdapter('NewContext');

      registry.registerDirect('ExistingContext', existingAdapter);
      sourceRegistry.registerLocal('ExistingContext', newAdapter1);
      sourceRegistry.registerLocal('NewContext', newAdapter2);

      const result = registry.importFromContext(sourceRegistry);

      expect(result.imported).toEqual(['NewContext']);
      expect(result.skipped).toEqual(['ExistingContext']);
      expect(result.conflicts).toEqual([
        { contextName: 'ExistingContext', reason: 'Already registered' },
      ]);

      expect(registry.get('ExistingContext')).toBe(existingAdapter);
      expect(registry.get('NewContext')).toBe(newAdapter2);
    });

    it('should handle empty source registry', () => {
      const result = registry.importFromContext(sourceRegistry);

      expect(result.imported).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.conflicts).toEqual([]);
    });

    it('should set import source metadata for imported adapters', () => {
      const adapter = new MockACLAdapter('ImportedContext');
      sourceRegistry.registerLocal('ImportedContext', adapter);

      registry.importFromContext(sourceRegistry);

      const metadata = (registry as any).metadata.get('ImportedContext');
      expect(metadata.source).toBe('import');
    });

    it('should handle import options with validateAdapters flag', () => {
      const adapter = new MockACLAdapter('TestContext');
      sourceRegistry.registerLocal('TestContext', adapter);

      const options: ImportOptions = {
        validateAdapters: true,
        overwriteConflicts: false,
      };

      // Should not throw and should import successfully
      const result = registry.importFromContext(sourceRegistry, options);

      expect(result.imported).toEqual(['TestContext']);
      expect(result.skipped).toEqual([]);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe('mixed registration and import scenarios', () => {
    it('should handle direct, enhanced, and imported adapters together', () => {
      const directAdapter = new MockACLAdapter('DirectContext');
      const enhancedAdapter = new MockEnhancedACLAdapter('EnhancedContext');
      const importedAdapter = new MockACLAdapter('ImportedContext');

      const sourceRegistry = new ContextACLRegistry('Source');
      sourceRegistry.registerLocal('ImportedContext', importedAdapter);

      registry
        .registerDirect('DirectContext', directAdapter, 'Direct registration')
        .registerEnhanced('EnhancedContext', enhancedAdapter, 'Enhanced registration');

      registry.importFromContext(sourceRegistry);

      expect(registry.getRegisteredContexts()).toHaveLength(3);
      expect(registry.hasContext('DirectContext')).toBe(true);
      expect(registry.hasContext('EnhancedContext')).toBe(true);
      expect(registry.hasContext('ImportedContext')).toBe(true);

      // Check metadata sources
      const directMetadata = (registry as any).metadata.get('DirectContext');
      const enhancedMetadata = (registry as any).metadata.get('EnhancedContext');
      const importedMetadata = (registry as any).metadata.get('ImportedContext');

      expect(directMetadata.source).toBe('direct');
      expect(enhancedMetadata.source).toBe('enhanced');
      expect(importedMetadata.source).toBe('import');
    });

    it('should maintain independent registrations', () => {
      const adapter1 = new MockACLAdapter('Context1');
      const adapter2 = new MockEnhancedACLAdapter('Context2');

      registry.registerDirect('Context1', adapter1).registerEnhanced('Context2', adapter2);

      // Modifying one registration should not affect the other
      expect(registry.get('Context1')).toBe(adapter1);
      expect(registry.get('Context2')).toBe(adapter2);

      // Re-register one
      const newAdapter1 = new MockACLAdapter('Context1');
      registry.registerDirect('Context1', newAdapter1);

      expect(registry.get('Context1')).toBe(newAdapter1);
      expect(registry.get('Context2')).toBe(adapter2); // Should remain unchanged
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle registration with undefined description', () => {
      const adapter = new MockACLAdapter('TestContext');

      expect(() => {
        registry.registerDirect('TestContext', adapter, undefined);
      }).not.toThrow();

      expect(registry.hasContext('TestContext')).toBe(true);
      const metadata = (registry as any).metadata.get('TestContext');
      expect(metadata.description).toBeUndefined();
    });

    it('should handle registration with empty string description', () => {
      const adapter = new MockACLAdapter('TestContext');

      registry.registerDirect('TestContext', adapter, '');

      expect(registry.hasContext('TestContext')).toBe(true);
      const metadata = (registry as any).metadata.get('TestContext');
      expect(metadata.description).toBe('');
    });

    it('should handle multiple imports from the same source registry', () => {
      const adapter1 = new MockACLAdapter('Context1');
      const adapter2 = new MockACLAdapter('Context2');

      const sourceRegistry = new ContextACLRegistry('Source');
      sourceRegistry.registerLocal('Context1', adapter1);

      // First import
      const result1 = registry.importFromContext(sourceRegistry);
      expect(result1.imported).toEqual(['Context1']);

      // Add another adapter to source
      sourceRegistry.registerLocal('Context2', adapter2);

      // Second import - should import only the new one
      const result2 = registry.importFromContext(sourceRegistry);
      expect(result2.imported).toEqual(['Context2']);
      expect(result2.conflicts).toEqual([
        { contextName: 'Context1', reason: 'Already registered' },
      ]);
    });
  });
});
