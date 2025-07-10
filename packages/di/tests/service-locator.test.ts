import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleContainer, VytchesDDD, ServiceLocator, ServiceNotFoundError,
  ContainerConfigurationError } from '../src';

describe('ServiceLocator', () => {
  let globalContainer: SimpleContainer;
  let contextContainer: SimpleContainer;

  beforeEach(() => {
    globalContainer = new SimpleContainer();
    contextContainer = new SimpleContainer();
    VytchesDDD.reset();
  });

  afterEach(() => {
    VytchesDDD.dispose();
    globalContainer.dispose();
    contextContainer.dispose();
  });

  describe('configure', () => {
    it('should configure global container', () => {
      expect(() => {
        VytchesDDD.configure(globalContainer);
      }).not.toThrow();
    });

    it('should throw error for null container', () => {
      expect(() => {
        VytchesDDD.configure(null as any);
      }).toThrow(ContainerConfigurationError);
    });
  });

  describe('configureContext', () => {
    it('should configure context container', () => {
      VytchesDDD.configure(globalContainer);

      expect(() => {
        VytchesDDD.configureContext('TestContext', contextContainer);
      }).not.toThrow();
    });

    it('should throw error for null context name', () => {
      VytchesDDD.configure(globalContainer);

      expect(() => {
        VytchesDDD.configureContext(null as any, contextContainer);
      }).toThrow(ContainerConfigurationError);
    });

    it('should throw error for null container', async () => {
      await VytchesDDD.configure(globalContainer);

      expect(() => {
        VytchesDDD.configureContext('TestContext', null as any);
      }).toThrow(ContainerConfigurationError);
    });
  });

  describe('resolve', () => {
    it('should resolve from global container', async () => {
      class TestService {}

      globalContainer.register('TestService', TestService);
      await VytchesDDD.configure(globalContainer);

      const instance = VytchesDDD.resolve<TestService>('TestService');

      expect(instance).toBeInstanceOf(TestService);
    });

    it('should resolve from context container when context specified', async () => {
      class TestService {
        constructor(public source: string) {}
      }

      globalContainer.registerFactory('TestService', () => new TestService('global'));
      contextContainer.registerFactory('TestService', () => new TestService('context'));

      await VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('TestContext', contextContainer);

      const globalInstance = VytchesDDD.resolve<TestService>('TestService');
      const contextInstance = VytchesDDD.resolve<TestService>('TestService', 'TestContext');

      expect(globalInstance.source).toBe('global');
      expect(contextInstance.source).toBe('context');
    });

    it('should fallback to global container when service not found in context', async () => {
      class TestService {}

      globalContainer.register('TestService', TestService);
      await VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('TestContext', contextContainer);

      const instance = VytchesDDD.resolve<TestService>('TestService', 'TestContext');

      expect(instance).toBeInstanceOf(TestService);
    });

    it('should throw ServiceNotFoundError when service not found', async () => {
      await VytchesDDD.configure(globalContainer);

      expect(() => {
        VytchesDDD.resolve('UnregisteredService');
      }).toThrow(ServiceNotFoundError);
    });

    it('should throw ContainerConfigurationError when no global container configured', async () => {
      expect(() => {
        VytchesDDD.resolve('TestService');
      }).toThrow(ContainerConfigurationError);
    });
  });

  describe('getGlobalContainer', () => {
    it('should return global container', async () => {
      await VytchesDDD.configure(globalContainer);

      const container = VytchesDDD.getGlobalContainer();

      expect(container).toBe(globalContainer);
    });

    it('should throw error when no global container configured', async () => {
      expect(() => {
        VytchesDDD.getGlobalContainer();
      }).toThrow(ContainerConfigurationError);
    });
  });

  describe('getContext', () => {
    it('should return context container', async () => {
      await VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('TestContext', contextContainer);

      const container = VytchesDDD.getContext('TestContext');

      expect(container).toBe(contextContainer);
    });

    it('should return undefined for unregistered context', async () => {
      await VytchesDDD.configure(globalContainer);

      const container = VytchesDDD.getContext('UnregisteredContext');

      expect(container).toBeUndefined();
    });
  });

  describe('getContexts', () => {
    it('should return all registered contexts', async () => {
      await VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('Context1', contextContainer);
      VytchesDDD.configureContext('Context2', new SimpleContainer());

      const contexts = VytchesDDD.getContexts();

      expect(contexts).toHaveLength(2);
      expect(contexts).toContain('Context1');
      expect(contexts).toContain('Context2');
    });

    it('should return empty array when no contexts registered', async () => {
      await VytchesDDD.configure(globalContainer);

      const contexts = VytchesDDD.getContexts();

      expect(contexts).toHaveLength(0);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered service in global container', async () => {
      class TestService {}

      globalContainer.register('TestService', TestService);
      await VytchesDDD.configure(globalContainer);

      expect(VytchesDDD.isRegistered('TestService')).toBe(true);
    });

    it('should return true for registered service in context container', async () => {
      class TestService {}

      contextContainer.register('TestService', TestService);
      await VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('TestContext', contextContainer);

      expect(VytchesDDD.isRegistered('TestService', 'TestContext')).toBe(true);
    });

    it('should return false for unregistered service', async () => {
      await VytchesDDD.configure(globalContainer);

      expect(VytchesDDD.isRegistered('UnregisteredService')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset service locator', async () => {
      class TestService {}

      globalContainer.register('TestService', TestService);
      await VytchesDDD.configure(globalContainer);

      VytchesDDD.reset();

      expect(() => {
        VytchesDDD.getGlobalContainer();
      }).toThrow(ContainerConfigurationError);
    });
  });

  describe('dispose', () => {
    it('should dispose all containers', async () => {
      let globalDisposed = false;
      let contextDisposed = false;

      const disposableGlobal = {
        ...globalContainer,
        dispose: () => { globalDisposed = true; }
      };

      const disposableContext = {
        ...contextContainer,
        dispose: () => { contextDisposed = true; }
      };

      await VytchesDDD.configure(disposableGlobal as any);
      VytchesDDD.configureContext('TestContext', disposableContext as any);

      VytchesDDD.dispose();

      expect(globalDisposed).toBe(true);
      expect(contextDisposed).toBe(true);
    });
  });

  describe('singleton behavior', () => {
    it('should maintain singleton instance across calls', async () => {
      const instance1 = ServiceLocator.getInstance();
      const instance2 = ServiceLocator.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
