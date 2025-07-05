import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { DefaultDomainServiceRegistry } from './domain-service-registry';
import { IBaseDomainService } from './base-domain-service';
import { ServiceDuplicateError, ServiceNotFoundError } from './service.errors';

class DomainService extends IBaseDomainService {
  constructor(serviceId: string) {
    super(serviceId);
  }
}

describe('DefaultDomainServiceRegistry', () => {
  describe('register', () => {
    it('should register a service with explicit ID', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service = new DomainService('test-service');

      // Act
      registry.register(service, 'explicit-id');

      // Assert
      expect(registry.has('explicit-id')).toBe(true);
      expect(registry.get('explicit-id')).toBe(service);
    });

    it('should register a service with implicit ID', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service = new DomainService('implicit-id');

      // Act
      registry.register(service);

      // Assert
      expect(registry.has('implicit-id')).toBe(true);
      expect(registry.get('implicit-id')).toBe(service);
    });

    it('should throw error when registering without ID', async () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service = {} as IBaseDomainService; // Service without ID

      // Act
      const [error] = await safeRun(() => registry.register(service));

      // Assert
      expect(error).toBeInstanceOf(ServiceNotFoundError);
      expect(error?.message).toContain(ServiceNotFoundError.withServiceId('undefined').message);
    });

    it('should throw error when registering duplicate ID', async () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service1 = new DomainService('duplicate-id');
      const service2 = new DomainService('different-id');
      registry.register(service1, 'duplicate-id');

      // Act
      const [error] = await safeRun(() => registry.register(service2, 'duplicate-id'));

      // Assert
      expect(error).toBeInstanceOf(ServiceDuplicateError);
      expect(error?.message).toContain(ServiceDuplicateError.withServiceId('duplicate-id').message);
    });
  });

  describe('get', () => {
    it('should return service when exists', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service = new DomainService('test-service');
      registry.register(service, 'test-id');

      // Act
      const result = registry.get('test-id');

      // Assert
      expect(result).toBe(service);
    });

    it('should return undefined when service does not exist', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();

      // Act
      const result = registry.get('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return service with correct type', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service = new DomainService('typed-service');
      registry.register(service, 'typed-id');

      // Act
      const result = registry.get<IBaseDomainService>('typed-id');

      // Assert
      expect(result).toBeInstanceOf(IBaseDomainService);
      expect(result?.serviceId).toBe('typed-service');
    });
  });

  describe('has', () => {
    it('should return true for existing service', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service = new DomainService('test-service');
      registry.register(service, 'test-id');

      // Act
      const result = registry.has('test-id');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-existing service', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();

      // Act
      const result = registry.has('non-existent');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove existing service and return true', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service = new DomainService('test-service');
      registry.register(service, 'test-id');

      // Act
      const result = registry.remove('test-id');

      // Assert
      expect(result).toBe(true);
      expect(registry.has('test-id')).toBe(false);
    });

    it('should return false for non-existing service', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();

      // Act
      const result = registry.remove('non-existent');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return map of all services', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service1 = new DomainService('service-1');
      const service2 = new DomainService('service-2');
      registry.register(service1, 'id-1');
      registry.register(service2, 'id-2');

      // Act
      const result = registry.getAll();

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('id-1')).toBe(service1);
      expect(result.get('id-2')).toBe(service2);
    });

    it('should return empty map when no services registered', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();

      // Act
      const result = registry.getAll();

      // Assert
      expect(result.size).toBe(0);
    });

    it('should return a copy of the internal map', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service = new DomainService('test-service');
      registry.register(service, 'test-id');

      // Act
      const result = registry.getAll();
      result.delete('test-id'); // This should not affect the registry

      // Assert
      expect(registry.has('test-id')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all services', () => {
      // Arrange
      const registry = new DefaultDomainServiceRegistry();
      const service1 = new DomainService('service-1');
      const service2 = new DomainService('service-2');
      registry.register(service1, 'id-1');
      registry.register(service2, 'id-2');

      // Act
      registry.clear();

      // Assert
      expect(registry.getAll().size).toBe(0);
      expect(registry.has('id-1')).toBe(false);
      expect(registry.has('id-2')).toBe(false);
    });
  });
});
