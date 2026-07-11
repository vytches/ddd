import { safeRun } from '@vytches/ddd-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CircularDependencyError,
  ContainerConfigurationError,
  ServiceLocator,
  ContainerServiceNotFoundError,
  SimpleContainer,
  VytchesDDD,
} from '../src';

describe('ServiceLocator', () => {
  // Mock container helper for testing
  const createMockContainer = () => new SimpleContainer();
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
      const [configureError] = safeRun(() => {
        VytchesDDD.configure(globalContainer);
      });
      expect(configureError).toBeUndefined();
    });

    it('should throw error for null container', () => {
      const [nullContainerError] = safeRun(() => {
        VytchesDDD.configure(null as any);
      });
      expect(nullContainerError).toBeInstanceOf(ContainerConfigurationError);
    });
  });

  describe('configureContext', () => {
    it('should configure context container', () => {
      VytchesDDD.configure(globalContainer);

      const [contextError] = safeRun(() => {
        VytchesDDD.configureContext('TestContext', contextContainer);
      });
      expect(contextError).toBeUndefined();
    });

    it('should throw error for null context name', () => {
      VytchesDDD.configure(globalContainer);

      const [nullContextError] = safeRun(() => {
        VytchesDDD.configureContext(null as any, contextContainer);
      });
      expect(nullContextError).toBeInstanceOf(ContainerConfigurationError);
    });

    it('should throw error for null container', () => {
      VytchesDDD.configure(globalContainer);

      const [nullContainerContextError] = safeRun(() => {
        VytchesDDD.configureContext('TestContext', null as any);
      });
      expect(nullContainerContextError).toBeInstanceOf(ContainerConfigurationError);
    });
  });

  describe('resolve', () => {
    it('should resolve from global container', () => {
      class TestService {}

      globalContainer.register('TestService', TestService);
      VytchesDDD.configure(globalContainer);

      const instance = VytchesDDD.resolve<TestService>('TestService');

      expect(instance).toBeInstanceOf(TestService);
    });

    it('should resolve from context container when context specified', () => {
      class TestService {
        constructor(public source: string) {}
      }

      globalContainer.registerFactory('TestService', () => new TestService('global'));
      contextContainer.registerFactory('TestService', () => new TestService('context'));

      VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('TestContext', contextContainer);

      const globalInstance = VytchesDDD.resolve<TestService>('TestService');
      const contextInstance = VytchesDDD.resolve<TestService>('TestService', 'TestContext');

      expect(globalInstance.source).toBe('global');
      expect(contextInstance.source).toBe('context');
    });

    it('should fallback to global container when service not found in context', () => {
      class TestService {}

      globalContainer.register('TestService', TestService);
      VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('TestContext', contextContainer);

      const instance = VytchesDDD.resolve<TestService>('TestService', 'TestContext');

      expect(instance).toBeInstanceOf(TestService);
    });

    it('should throw ContainerServiceNotFoundError when service not found', () => {
      VytchesDDD.configure(globalContainer);

      const [serviceNotFoundError] = safeRun(() => {
        VytchesDDD.resolve('UnregisteredService');
      });
      expect(serviceNotFoundError).toBeInstanceOf(ContainerServiceNotFoundError);
    });

    it('should throw ContainerConfigurationError when no global container configured', () => {
      const [noContainerError] = safeRun(() => {
        VytchesDDD.resolve('TestService');
      });
      expect(noContainerError).toBeInstanceOf(ContainerConfigurationError);
    });
  });

  describe('getGlobalContainer', () => {
    it('should return global container', () => {
      VytchesDDD.configure(globalContainer);

      const container = VytchesDDD.getGlobalContainer();

      expect(container).toBe(globalContainer);
    });

    it('should throw error when no global container configured', () => {
      const [getContainerError] = safeRun(() => {
        VytchesDDD.getGlobalContainer();
      });
      expect(getContainerError).toBeInstanceOf(ContainerConfigurationError);
    });
  });

  describe('getContext', () => {
    it('should return context container', () => {
      VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('TestContext', contextContainer);

      const container = VytchesDDD.getContext('TestContext');

      expect(container).toBe(contextContainer);
    });

    it('should return undefined for unregistered context', () => {
      VytchesDDD.configure(globalContainer);

      const container = VytchesDDD.getContext('UnregisteredContext');

      expect(container).toBeUndefined();
    });
  });

  describe('getContexts', () => {
    it('should return all registered contexts', () => {
      VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('Context1', contextContainer);
      VytchesDDD.configureContext('Context2', new SimpleContainer());

      const contexts = VytchesDDD.getContexts();

      expect(contexts).toHaveLength(2);
      expect(contexts).toContain('Context1');
      expect(contexts).toContain('Context2');
    });

    it('should return empty array when no contexts registered', () => {
      VytchesDDD.configure(globalContainer);

      const contexts = VytchesDDD.getContexts();

      expect(contexts).toHaveLength(0);
    });
  });

  describe('isRegistered', () => {
    it('should return true for registered service in global container', () => {
      class TestService {}

      globalContainer.register('TestService', TestService);
      VytchesDDD.configure(globalContainer);

      expect(VytchesDDD.isRegistered('TestService')).toBe(true);
    });

    it('should return true for registered service in context container', () => {
      class TestService {}

      contextContainer.register('TestService', TestService);
      VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('TestContext', contextContainer);

      expect(VytchesDDD.isRegistered('TestService', 'TestContext')).toBe(true);
    });

    it('should return false for unregistered service', () => {
      VytchesDDD.configure(globalContainer);

      expect(VytchesDDD.isRegistered('UnregisteredService')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset service locator', () => {
      class TestService {}

      globalContainer.register('TestService', TestService);
      VytchesDDD.configure(globalContainer);

      VytchesDDD.reset();

      const [resetError] = safeRun(() => {
        VytchesDDD.getGlobalContainer();
      });
      expect(resetError).toBeInstanceOf(ContainerConfigurationError);
    });
  });

  describe('dispose', () => {
    it('should dispose all containers', () => {
      let globalDisposed = false;
      let contextDisposed = false;

      const disposableGlobal = {
        ...globalContainer,
        dispose: () => {
          globalDisposed = true;
        },
      };

      const disposableContext = {
        ...contextContainer,
        dispose: () => {
          contextDisposed = true;
        },
      };

      VytchesDDD.configure(disposableGlobal as any);
      VytchesDDD.configureContext('TestContext', disposableContext as any);

      VytchesDDD.dispose();

      expect(globalDisposed).toBe(true);
      expect(contextDisposed).toBe(true);
    });
  });

  describe('singleton behavior', () => {
    it('should maintain singleton instance across calls', () => {
      const instance1 = ServiceLocator.getInstance();
      const instance2 = ServiceLocator.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  // ---------------------------------------------------------------------------
  // D-3/A — single-lookup resolve; CircularDependencyError propagation (OQ-6)
  // ---------------------------------------------------------------------------
  describe('resolve — single-lookup semantics and error propagation', () => {
    it('propagates CircularDependencyError from global container (never swallows it)', () => {
      const c = new SimpleContainer();
      c.registerFactory('A', cc => cc.resolve('B'));
      c.registerFactory('B', cc => cc.resolve('A'));
      VytchesDDD.configure(c);

      const [err] = safeRun(() => VytchesDDD.resolve('A'));

      expect(err).toBeInstanceOf(CircularDependencyError);
    });

    it('propagates CircularDependencyError from context container (never swallows it)', () => {
      const c = new SimpleContainer();
      c.registerFactory('A', cc => cc.resolve('B'));
      c.registerFactory('B', cc => cc.resolve('A'));
      VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('ctx', c);

      const [err] = safeRun(() => VytchesDDD.resolve('A', 'ctx'));

      expect(err).toBeInstanceOf(CircularDependencyError);
    });

    it('ContainerServiceNotFoundError message preserves canonical format for string token', () => {
      VytchesDDD.configure(globalContainer);

      const [err] = safeRun(() => VytchesDDD.resolve('MySpecificService'));

      expect(err).toBeInstanceOf(ContainerServiceNotFoundError);
      // Exact message shape required by D-3/A: token name + context string
      expect((err as Error).message).toContain('MySpecificService');
      expect((err as Error).message).toContain('Service not registered in any container');
    });

    it('ContainerServiceNotFoundError uses "unknown" for non-string tokens', () => {
      VytchesDDD.configure(globalContainer);
      const sym = Symbol('TestSym');

      const [err] = safeRun(() => VytchesDDD.resolve(sym));

      expect(err).toBeInstanceOf(ContainerServiceNotFoundError);
      expect((err as Error).message).toContain('unknown');
      expect((err as Error).message).toContain('Service not registered in any container');
    });

    it('falls back to global when service absent from context but present in global', () => {
      class Svc {}
      globalContainer.register('Svc', Svc);
      VytchesDDD.configure(globalContainer);
      VytchesDDD.configureContext('ctx', contextContainer); // contextContainer has no Svc

      const result = VytchesDDD.resolve<Svc>('Svc', 'ctx');

      expect(result).toBeInstanceOf(Svc);
    });
  });
});
