import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DefaultDomainServiceRegistry } from './domain-service-registry';
import { GlobalServiceRegistry } from './global-service-registry';
import { IBaseDomainService } from './base-domain-service';
import type { IDomainServiceRegistry } from './domain-service-registry.interface';

class DomainService extends IBaseDomainService {
  constructor(serviceId: string) {
    super(serviceId);
  }
}

describe('GlobalServiceRegistry', () => {
  // Reset the singleton instance before each test
  beforeEach(() => {
    // Accessing private static instance using type assertion
    (GlobalServiceRegistry as any).instance = undefined;
  });

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      // Act
      const instance1 = GlobalServiceRegistry.getInstance();
      const instance2 = GlobalServiceRegistry.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });

    it('should return a DefaultDomainServiceRegistry instance by default', () => {
      // Act
      const instance = GlobalServiceRegistry.getInstance();

      // Assert
      expect(instance).toBeInstanceOf(DefaultDomainServiceRegistry);
    });

    it('should maintain services between calls', () => {
      // Arrange
      const registry = GlobalServiceRegistry.getInstance();
      const service = new DomainService('test-service');
      registry.register(service, 'test-id');

      // Act
      const secondRegistry = GlobalServiceRegistry.getInstance();

      // Assert
      expect(secondRegistry.has('test-id')).toBe(true);
      expect(secondRegistry.get('test-id')).toBe(service);
    });
  });

  describe('setInstance', () => {
    it('should replace the default registry', () => {
      // Arrange
      const customRegistry: IDomainServiceRegistry = {
        register: vi.fn(),
        get: vi.fn(),
        has: vi.fn().mockReturnValue(true),
        remove: vi.fn(),
        getAll: vi.fn(),
        clear: vi.fn(),
      };

      // Act
      GlobalServiceRegistry.setInstance(customRegistry);
      const instance = GlobalServiceRegistry.getInstance();

      // Assert
      expect(instance).toBe(customRegistry);
      expect(instance.has('any-id')).toBe(true); // Using the mock implementation
    });

    it('should affect subsequent getInstance calls', () => {
      // Arrange
      const customRegistry = new DefaultDomainServiceRegistry();
      const service = new DomainService('custom-service');
      customRegistry.register(service, 'custom-id');

      // Act
      GlobalServiceRegistry.setInstance(customRegistry);
      const instance = GlobalServiceRegistry.getInstance();

      // Assert
      expect(instance.has('custom-id')).toBe(true);
      expect(instance.get('custom-id')).toBe(service);
    });
  });
});
