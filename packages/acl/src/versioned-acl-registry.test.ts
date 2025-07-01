/* eslint-disable @typescript-eslint/no-inferrable-types */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VersionedACLRegistry } from './versioned-acl-registry';
import type { IACLAdapter, ACLContextInfo } from './acl.interfaces';
import { safeRun } from '@vytches-ddd/utils';

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
  constructor(private contextName: string, private version: string = '1.0.0') {}

  execute = vi.fn();
  fetch = vi.fn();
  supportsOperation = vi.fn(() => true);

  getContextInfo = vi.fn((): ACLContextInfo => ({
    contextName: this.contextName,
    externalSystemName: 'TestSystem',
    version: this.version,
    supportedOperations: ['CREATE', 'UPDATE'],
  }));
}

describe('VersionedACLRegistry', () => {
  let registry: VersionedACLRegistry;

  beforeEach(() => {
    registry = new VersionedACLRegistry();
  });

  describe('construction', () => {
    it('should extend BaseACLRegistry functionality', () => {
      expect(registry.getRegisteredContexts()).toEqual([]);
      expect(registry.hasContext('AnyContext')).toBe(false);
    });

    it('should have correct registry name', () => {
      expect((registry as any).getRegistryName()).toBe('VersionedACLRegistry');
    });

    it('should initialize with empty version maps', () => {
      expect((registry as any).versionedAdapters.size).toBe(0);
      expect((registry as any).latestVersions.size).toBe(0);
    });
  });

  describe('registerVersioned method', () => {
    it('should register first version of an adapter', () => {
      const adapter = new MockACLAdapter('PaymentContext', '1.0.0');

      const result = registry.registerVersioned('PaymentContext', '1.0.0', adapter);

      expect(result).toBe(registry); // Should return this for chaining
      expect(registry.hasContext('PaymentContext')).toBe(true);
      expect(registry.getLatestVersion('PaymentContext')).toBe('1.0.0');
      expect(registry.getVersions('PaymentContext')).toEqual(['1.0.0']);
    });

    it('should register multiple versions of same context', () => {
      const adapter1 = new MockACLAdapter('PaymentContext', '1.0.0');
      const adapter2 = new MockACLAdapter('PaymentContext', '1.1.0');
      const adapter3 = new MockACLAdapter('PaymentContext', '2.0.0');

      registry
        .registerVersioned('PaymentContext', '1.0.0', adapter1)
        .registerVersioned('PaymentContext', '1.1.0', adapter2)
        .registerVersioned('PaymentContext', '2.0.0', adapter3);

      expect(registry.getVersions('PaymentContext')).toEqual(['1.0.0', '1.1.0', '2.0.0']);
      expect(registry.getLatestVersion('PaymentContext')).toBe('2.0.0');
      expect(registry.get('PaymentContext')).toBe(adapter3); // Should return latest
    });

    it('should register versions in non-sequential order', () => {
      const adapter1 = new MockACLAdapter('TestContext', '2.0.0');
      const adapter2 = new MockACLAdapter('TestContext', '1.0.0');
      const adapter3 = new MockACLAdapter('TestContext', '1.5.0');

      registry
        .registerVersioned('TestContext', '2.0.0', adapter1)
        .registerVersioned('TestContext', '1.0.0', adapter2)
        .registerVersioned('TestContext', '1.5.0', adapter3);

      const versions = registry.getVersions('TestContext');
      expect(versions).toEqual(['1.0.0', '1.5.0', '2.0.0']); // Should be sorted
      expect(registry.getLatestVersion('TestContext')).toBe('2.0.0');
    });

    it('should handle semantic versioning with pre-release tags', () => {
      const adapter1 = new MockACLAdapter('TestContext', '1.0.0');
      const adapter2 = new MockACLAdapter('TestContext', '1.0.1-alpha');
      const adapter3 = new MockACLAdapter('TestContext', '1.0.1');

      registry
        .registerVersioned('TestContext', '1.0.0', adapter1)
        .registerVersioned('TestContext', '1.0.1-alpha', adapter2)
        .registerVersioned('TestContext', '1.0.1', adapter3);

      const versions = registry.getVersions('TestContext');
      expect(versions).toEqual(['1.0.0', '1.0.1-alpha', '1.0.1']);
      expect(registry.getLatestVersion('TestContext')).toBe('1.0.1');
    });

    it('should overwrite adapter with same version', () => {
      const adapter1 = new MockACLAdapter('TestContext', '1.0.0');
      const adapter2 = new MockACLAdapter('TestContext', '1.0.0');

      registry.registerVersioned('TestContext', '1.0.0', adapter1);
      expect(registry.get('TestContext', '1.0.0')).toBe(adapter1);

      registry.registerVersioned('TestContext', '1.0.0', adapter2);
      expect(registry.get('TestContext', '1.0.0')).toBe(adapter2);
      expect(registry.getVersions('TestContext')).toEqual(['1.0.0']);
    });

    it('should reject invalid version format', async () => {
      const adapter = new MockACLAdapter('TestContext', 'invalid');
      // Act
      const[error] = await safeRun( () => registry.registerVersioned('TestContext', 'invalid', adapter));

      // Assert
      expect(error?.message).toBe('Invalid version format: invalid');
    });

    it('should reject invalid semantic version formats', async () => {
      const adapter = new MockACLAdapter('TestContext', '1.0');

      // Act
      const[error] = await safeRun( () => registry.registerVersioned('TestContext', '1.0', adapter));
      const[error2] = await safeRun( () => registry.registerVersioned('TestContext', 'v1.0.0', adapter));
      const[error3] = await safeRun( () => registry.registerVersioned('TestContext', '1.0.0.0', adapter));

      // Assert
      expect(error?.message).toBe('Invalid version format: 1.0');
      expect(error2?.message).toBe('Invalid version format: v1.0.0');
      expect(error3?.message).toBe('Invalid version format: 1.0.0.0');
  });

  describe('get method', () => {
    beforeEach(() => {
      const adapter1 = new MockACLAdapter('TestContext', '1.0.0');
      const adapter2 = new MockACLAdapter('TestContext', '1.1.0');
      const adapter3 = new MockACLAdapter('TestContext', '2.0.0');

      registry
        .registerVersioned('TestContext', '1.0.0', adapter1)
        .registerVersioned('TestContext', '1.1.0', adapter2)
        .registerVersioned('TestContext', '2.0.0', adapter3);
    });

    it('should return specific version of adapter', () => {
      const adapter1 = registry.get('TestContext', '1.0.0');
      const adapter2 = registry.get('TestContext', '1.1.0');
      const adapter3 = registry.get('TestContext', '2.0.0');

      expect(adapter1).toBeDefined();
      expect(adapter2).toBeDefined();
      expect(adapter3).toBeDefined();
      expect(adapter1).not.toBe(adapter2);
      expect(adapter2).not.toBe(adapter3);
    });

    it('should return undefined for non-existent version', () => {
      const result = registry.get('TestContext', '3.0.0');
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent context', () => {
      const result = registry.get('NonExistentContext', '1.0.0');
      expect(result).toBeUndefined();
    });
  });

  describe('getLatestVersion method', () => {
    it('should return undefined for non-existent context', () => {
      const result = registry.getLatestVersion('NonExistentContext');
      expect(result).toBeUndefined();
    });

    it('should return latest version string', () => {
      const adapter1 = new MockACLAdapter('TestContext', '1.0.0');
      const adapter2 = new MockACLAdapter('TestContext', '2.1.0');
      const adapter3 = new MockACLAdapter('TestContext', '2.0.0');

      registry
        .registerVersioned('TestContext', '1.0.0', adapter1)
        .registerVersioned('TestContext', '2.1.0', adapter2)
        .registerVersioned('TestContext', '2.0.0', adapter3);

      expect(registry.getLatestVersion('TestContext')).toBe('2.1.0');
    });

    it('should update latest version when new version is registered', () => {
      const adapter1 = new MockACLAdapter('TestContext', '1.0.0');
      registry.registerVersioned('TestContext', '1.0.0', adapter1);
      expect(registry.getLatestVersion('TestContext')).toBe('1.0.0');

      const adapter2 = new MockACLAdapter('TestContext', '1.5.0');
      registry.registerVersioned('TestContext', '1.5.0', adapter2);
      expect(registry.getLatestVersion('TestContext')).toBe('1.5.0');

      const adapter3 = new MockACLAdapter('TestContext', '1.2.0');
      registry.registerVersioned('TestContext', '1.2.0', adapter3);
      expect(registry.getLatestVersion('TestContext')).toBe('1.5.0'); // Should remain latest
    });
  });

  describe('getVersions method', () => {
    it('should return empty array for non-existent context', () => {
      const result = registry.getVersions('NonExistentContext');
      expect(result).toEqual([]);
    });

    it('should return sorted versions', () => {
      const adapter1 = new MockACLAdapter('TestContext', '2.0.0');
      const adapter2 = new MockACLAdapter('TestContext', '1.0.0');
      const adapter3 = new MockACLAdapter('TestContext', '1.1.0');
      const adapter4 = new MockACLAdapter('TestContext', '1.0.1');

      registry
        .registerVersioned('TestContext', '2.0.0', adapter1)
        .registerVersioned('TestContext', '1.0.0', adapter2)
        .registerVersioned('TestContext', '1.1.0', adapter3)
        .registerVersioned('TestContext', '1.0.1', adapter4);

      const versions = registry.getVersions('TestContext');
      expect(versions).toEqual(['1.0.0', '1.0.1', '1.1.0', '2.0.0']);
    });

    it('should handle pre-release versions in sorting', () => {
      const versions = [
        '1.0.0-alpha',
        '1.0.0',
        '1.0.0-beta',
        '1.0.1-alpha',
        '1.0.1',
      ];

      versions.forEach((version, index) => {
        const adapter = new MockACLAdapter('TestContext', version);
        registry.registerVersioned('TestContext', version, adapter);
      });

      const sortedVersions = registry.getVersions('TestContext');
      expect(sortedVersions).toEqual([
        '1.0.0-alpha',
        '1.0.0-beta',
        '1.0.0',
        '1.0.1-alpha',
        '1.0.1',
      ]);
    });
  });

  describe('inherited BaseACLRegistry functionality', () => {
    beforeEach(() => {
      const adapter1 = new MockACLAdapter('Context1', '1.0.0');
      const adapter2 = new MockACLAdapter('Context1', '2.0.0');
      const adapter3 = new MockACLAdapter('Context2', '1.0.0');

      registry
        .registerVersioned('Context1', '1.0.0', adapter1)
        .registerVersioned('Context1', '2.0.0', adapter2)
        .registerVersioned('Context2', '1.0.0', adapter3);
    });

    it('should support get method (returns latest version)', () => {
      const latestAdapter = registry.get('Context1');
      const specificAdapter = registry.get('Context1', '2.0.0');
      expect(latestAdapter).toBe(specificAdapter);
    });

    it('should support hasContext method', () => {
      expect(registry.hasContext('Context1')).toBe(true);
      expect(registry.hasContext('Context2')).toBe(true);
      expect(registry.hasContext('NonExistentContext')).toBe(false);
    });

    it('should support getRegisteredContexts method', () => {
      const contexts = registry.getRegisteredContexts();
      expect(contexts).toHaveLength(2);
      expect(contexts).toContain('Context1');
      expect(contexts).toContain('Context2');
    });

    it('should support getRequired method', async () => {
      const adapter = registry.getRequired('Context1');
      expect(adapter).toBeDefined();

            // Act
      const[error] = await safeRun( () => registry.getRequired('NonExistentContext'));

      // Assert
      expect(error?.message).toBe('ACL adapter not found for context: NonExistentContext');
    });

    it('should support exportAdapters method (exports latest versions)', () => {
      const exported = registry.exportAdapters();
      expect(exported.size).toBe(2);
      expect(exported.has('Context1')).toBe(true);
      expect(exported.has('Context2')).toBe(true);

      // Should export latest version
      const context1Adapter = exported.get('Context1');
      const latestContext1 = registry.get('Context1', '2.0.0');
      expect(context1Adapter).toBe(latestContext1);
    });
  });

  describe('version comparison and sorting', () => {
    it('should handle complex version comparisons correctly', () => {
      const versions = [
        '1.0.0',
        '1.0.1',
        '1.0.2',
        '1.0.10',
        '1.1.0',
        '1.2.0',
        '1.10.0',
        '2.0.0',
      ];

      // Register in random order
      const shuffledVersions = [...versions].sort(() => Math.random() - 0.5);

      shuffledVersions.forEach(version => {
        const adapter = new MockACLAdapter('TestContext', version);
        registry.registerVersioned('TestContext', version, adapter);
      });

      const sortedVersions = registry.getVersions('TestContext');
      expect(sortedVersions).toEqual(versions);
    });

    it('should handle major.minor.patch.pre-release correctly', () => {
      const versions = [
        '1.0.0-alpha',
        '1.0.0-alpha.1',
        '1.0.0-beta',
        '1.0.0',
        '1.0.1-alpha',
        '1.0.1',
        '1.1.0-alpha',
        '1.1.0',
        '2.0.0-alpha',
        '2.0.0',
      ];

      versions.forEach(version => {
        const adapter = new MockACLAdapter('TestContext', version);
        registry.registerVersioned('TestContext', version, adapter);
      });

      const sortedVersions = registry.getVersions('TestContext');
      expect(sortedVersions).toEqual(versions);
      expect(registry.getLatestVersion('TestContext')).toBe('2.0.0');
    });
  });

  describe('edge cases and error handling',async  () => {
    it('should handle context with single version', () => {
      const adapter = new MockACLAdapter('SingleVersionContext', '1.0.0');
      registry.registerVersioned('SingleVersionContext', '1.0.0', adapter);

      expect(registry.getVersions('SingleVersionContext')).toEqual(['1.0.0']);
      expect(registry.getLatestVersion('SingleVersionContext')).toBe('1.0.0');
      expect(registry.get('SingleVersionContext')).toBe(adapter);
    });

    it('should handle version with leading zeros', async () => {
      const adapter = new MockACLAdapter('TestContext', '1.01.0');

      // Act
      const[error] = await safeRun( () => registry.registerVersioned('TestContext', '1.01.0', adapter));

      // Assert
      expect(error?.message).toBe('Invalid version format: 1.01.0');
    });

    it('should handle empty pre-release tag', async () => {
      const adapter = new MockACLAdapter('TestContext', '1.0.0-');

      // Act
      const[error] = await safeRun( () => registry.registerVersioned('TestContext', '1.0.0-', adapter));

      // Assert
      expect(error?.message).toBe('Invalid version format: 1.0.0-');
    });

    it('should handle multiple contexts independently', () => {
      const adapter1 = new MockACLAdapter('Context1', '1.0.0');
      const adapter2 = new MockACLAdapter('Context2', '2.0.0');

      registry
        .registerVersioned('Context1', '1.0.0', adapter1)
        .registerVersioned('Context2', '2.0.0', adapter2);

      expect(registry.getLatestVersion('Context1')).toBe('1.0.0');
      expect(registry.getLatestVersion('Context2')).toBe('2.0.0');
      expect(registry.getVersions('Context1')).toEqual(['1.0.0']);
      expect(registry.getVersions('Context2')).toEqual(['2.0.0']);
    });

    it('should maintain version history when adapter is overwritten', () => {
      const adapter1 = new MockACLAdapter('TestContext', '1.0.0');
      const adapter2 = new MockACLAdapter('TestContext', '1.0.0');

      registry.registerVersioned('TestContext', '1.0.0', adapter1);
      registry.registerVersioned('TestContext', '1.0.0', adapter2); // Overwrite

      expect(registry.getVersions('TestContext')).toEqual(['1.0.0']);
      expect(registry.get('TestContext', '1.0.0')).toBe(adapter2);
    });
  });
});

});
