import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import type {
  DomainServiceOptions} from './domain-service.decorator';
import {
  DomainService,
  getDomainServiceMetadata,
} from './domain-service.decorator';
import { IBaseDomainService } from './base-domain-service';

describe('DomainService Decorator', () => {
  describe('string parameter', () => {
    it('should add metadata to class with string serviceId', () => {
      // Arrange & Act
      // @ts-expect-error skip
      @DomainService('string-service')
      class TestService extends IBaseDomainService {
        constructor() {
          super('test-service');
        }
      }

      // Assert
      const metadata = getDomainServiceMetadata(TestService);
      expect(metadata).toBeDefined();
      expect(metadata?.serviceId).toBe('string-service');
    });
  });

  describe('options parameter', () => {
    it('should add metadata to class with options object', () => {
      // Arrange
      const options: DomainServiceOptions = {
        serviceId: 'options-service',
        dependencies: ['dep1', 'dep2'],
        transactional: true,
        async: true,
        publishesEvents: true,
        caching: {
          enabled: true,
          ttl: 3600,
        },
      };

      // Act
      @DomainService(options)
      class TestService extends IBaseDomainService {
        constructor() {
          super('test-service');
        }
      }

      // Assert
      const metadata = getDomainServiceMetadata(TestService);
      expect(metadata).toBeDefined();
      expect(metadata?.serviceId).toBe('options-service');
      expect(metadata?.dependencies).toEqual(['dep1', 'dep2']);
      expect(metadata?.transactional).toBe(true);
      expect(metadata?.async).toBe(true);
      expect(metadata?.publishesEvents).toBe(true);
      expect(metadata?.caching?.enabled).toBe(true);
      expect(metadata?.caching?.ttl).toBe(3600);
    });

    it('should support minimal options', () => {
      // Arrange & Act
      @DomainService({ serviceId: 'minimal-options' })
      class TestService extends IBaseDomainService {
        constructor() {
          super('test-service');
        }
      }

      // Assert
      const metadata = getDomainServiceMetadata(TestService);
      expect(metadata).toBeDefined();
      expect(metadata?.serviceId).toBe('minimal-options');
      expect(metadata?.dependencies).toBeUndefined();
      expect(metadata?.transactional).toBeUndefined();
      expect(metadata?.async).toBeUndefined();
      expect(metadata?.publishesEvents).toBeUndefined();
      expect(metadata?.caching).toBeUndefined();
    });
  });

  describe('getDomainServiceMetadata', () => {
    it('should retrieve metadata from class', () => {
      // Arrange
      @DomainService({
        serviceId: 'retrieve-test',
        transactional: true,
      })
      class TestService extends IBaseDomainService {
        constructor() {
          super('test-service');
        }
      }

      // Act
      const metadata = getDomainServiceMetadata(TestService);

      // Assert
      expect(metadata).toBeDefined();
      expect(metadata?.serviceId).toBe('retrieve-test');
      expect(metadata?.transactional).toBe(true);
    });

    it('should return undefined for class without metadata', () => {
      // Arrange
      class NoDecoratorService extends IBaseDomainService {
        constructor() {
          super('no-decorator');
        }
      }

      // Act
      const metadata = getDomainServiceMetadata(NoDecoratorService);

      // Assert
      expect(metadata).toBeUndefined();
    });

    it('should not affect class instances', () => {
      // Arrange
      @DomainService('static-metadata')
      class TestService extends IBaseDomainService {
        constructor() {
          super('instance-id');
        }
      }

      // Act
      const instance = new TestService();
      const metadata = getDomainServiceMetadata(TestService);

      // Assert
      expect(metadata?.serviceId).toBe('static-metadata');
      expect(instance.serviceId).toBe('instance-id');
    });
  });

  describe('multiple decorators', () => {
    it('should work correctly with inheritance', () => {
      // Arrange & Act
      @DomainService('base-service')
      class BaseService extends IBaseDomainService {
        constructor() {
          super('base');
        }
      }

      @DomainService('derived-service')
      class DerivedService extends BaseService {
        constructor() {
          super();
        }
      }

      // Assert
      const baseMetadata = getDomainServiceMetadata(BaseService);
      const derivedMetadata = getDomainServiceMetadata(DerivedService);

      expect(baseMetadata?.serviceId).toBe('base-service');
      expect(derivedMetadata?.serviceId).toBe('derived-service');
    });

    it('should work with other decorators', () => {
      // Define a sample other decorator
      function OtherDecorator(target: any) {
        Reflect.defineMetadata('otherKey', 'otherValue', target);
        return target;
      }

      // Arrange & Act
      @OtherDecorator
      @DomainService('multi-decorator')
      class TestService extends IBaseDomainService {
        constructor() {
          super('test');
        }
      }

      // Assert
      const serviceMetadata = getDomainServiceMetadata(TestService);
      const otherMetadata = Reflect.getMetadata('otherKey', TestService);

      expect(serviceMetadata?.serviceId).toBe('multi-decorator');
      expect(otherMetadata).toBe('otherValue');
    });
  });
});
