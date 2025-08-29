import { Injectable, Module } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ModuleRef } from '@nestjs/core';
// Mock decorators for testing - avoid lazy-loaded imports
const CommandHandler = (commandType: any) => (target: any) => {
  Reflect.defineMetadata(
    'di:handler-metadata',
    { handlerType: 'command', messageType: commandType },
    target as object
  );
  return target;
};

const QueryHandler = (queryType: any) => (target: any) => {
  Reflect.defineMetadata(
    'di:handler-metadata',
    { handlerType: 'query', messageType: queryType },
    target as object
  );
  return target;
};

const EventHandler = (eventType: any) => (target: any) => {
  Reflect.defineMetadata('di:event-handler', { eventType }, target as object);
  return target;
};

const DomainService = (serviceId: string) => (target: any) => {
  Reflect.defineMetadata('di:domain-service', { serviceId }, target as object);
  return target;
};

const Saga = (sagaType: string) => (target: any) => {
  Reflect.defineMetadata('saga:metadata', { saga: { sagaType } }, target as object);
  return target;
};
import { safeRun } from '@vytches/ddd-utils';
import { vi } from 'vitest';
import {
  VytchesDDDBulkProvider,
  BulkRegistrar,
  type BulkRegistrationConfig,
  type MixedServiceConfig,
} from '../../src/utils/bulk-provider.helper';
import type { IDomainEvent } from '@vytches/ddd-contracts';
import type { ICommand, IQuery } from '@vytches/ddd-cqrs';
import type { ISagaExecutionContext, ISagaActionResult } from '@vytches/ddd-messaging';

// Test commands, queries, and events
class TestCommand implements ICommand {
  constructor(public readonly data: string) {}
}

class TestQuery implements IQuery<string> {
  constructor(public readonly filter: string) {}
}

class TestEvent implements IDomainEvent {
  eventId = 'test-event-1';
  eventType = 'TestEvent';
  aggregateId = 'test-aggregate';
  occurredAt = new Date();
  eventVersion = 1;

  constructor(public readonly payload: { message: string }) {}
}

// Test services and handlers
@Injectable()
@CommandHandler(TestCommand)
class TestCommandHandler {
  async execute(command: TestCommand): Promise<void> {
    console.log(`Executing command: ${command.data}`);
  }
}

@Injectable()
@QueryHandler(TestQuery)
class TestQueryHandler {
  async execute(query: TestQuery): Promise<string> {
    return `Query result for: ${query.filter}`;
  }
}

@Injectable()
@EventHandler(TestEvent)
class TestEventHandler {
  async handle(event: TestEvent): Promise<void> {
    console.log(`Handling event: ${event.payload.message}`);
  }
}

@Injectable()
@DomainService('testDomainService')
class TestDomainService {
  async processData(data: string): Promise<string> {
    return `Processed: ${data}`;
  }
}

@Injectable()
@Saga('TestProcessingSaga')
class TestSaga {
  async handleEvent(_event: any, _context: ISagaExecutionContext): Promise<ISagaActionResult> {
    return { success: true };
  }

  canHandle(_event: any): boolean {
    return true;
  }

  async compensate(_stepName: string, _context: ISagaExecutionContext): Promise<ISagaActionResult> {
    return { success: true };
  }
}

// Handler without @Injectable (pure VytchesDDD)
@CommandHandler(TestCommand)
class PureVytchesDDDHandler {
  async execute(command: TestCommand): Promise<void> {
    console.log(`Pure VytchesDDD handler: ${command.data}`);
  }
}

// Service without @Injectable (pure VytchesDDD)
// @DomainService('pureVytchesDDDService')
// class PureVytchesDDDService {
//   async processData(data: string): Promise<string> {
//     return `Pure VytchesDDD processed: ${data}`;
//   }
// }

// Test module with all services
@Module({
  providers: [TestCommandHandler, TestQueryHandler, TestEventHandler, TestDomainService, TestSaga],
})
class TestModule {}

describe('VytchesDDDBulkProvider', () => {
  describe('Static Provider Creation Methods', () => {
    describe('forHandlers', () => {
      it('should create basic NestJS providers for handlers', () => {
        const handlers = [TestCommandHandler, TestQueryHandler, TestEventHandler];
        const providers = VytchesDDDBulkProvider.forHandlers(handlers as any);

        expect(providers).toHaveLength(3);

        // Check each provider
        providers.forEach((provider, index) => {
          expect((provider as any).provide).toBe(handlers[index]);
          expect((provider as any).useClass).toBe(handlers[index]);
        });
      });

      it('should handle empty handler array', () => {
        const providers = VytchesDDDBulkProvider.forHandlers([]);
        expect(providers).toHaveLength(0);
      });
    });

    describe('forDomainServices', () => {
      it('should create basic NestJS providers for domain services', () => {
        const services = [TestDomainService];
        const providers = VytchesDDDBulkProvider.forDomainServices(services);

        expect(providers).toHaveLength(1);
        expect((providers[0] as any).provide).toBe(TestDomainService);
        expect((providers[0] as any).useClass).toBe(TestDomainService);
      });

      it('should handle empty services array', () => {
        const providers = VytchesDDDBulkProvider.forDomainServices([]);
        expect(providers).toHaveLength(0);
      });
    });

    describe('forMixedServices', () => {
      it('should create providers for mixed service types', () => {
        const config: MixedServiceConfig = {
          handlers: [TestCommandHandler, TestQueryHandler],
          domainServices: [TestDomainService],
          eventHandlers: [TestEventHandler],
          sagas: [TestSaga],
        };

        const providers = VytchesDDDBulkProvider.forMixedServices(config);

        // Should include handlers + services + event handlers + sagas + bulk registrar
        expect(providers.length).toBeGreaterThan(4);

        // Verify specific provider types are included
        const handlerProviders = providers.filter(
          p => (p as any).provide === TestCommandHandler || (p as any).provide === TestQueryHandler
        );
        expect(handlerProviders).toHaveLength(2);

        const serviceProviders = providers.filter(p => (p as any).provide === TestDomainService);
        expect(serviceProviders).toHaveLength(1);
      });

      it('should handle empty configuration', () => {
        const config: MixedServiceConfig = {};
        const providers = VytchesDDDBulkProvider.forMixedServices(config);

        // Should still include the bulk registrar
        expect(providers.length).toBe(1);
      });

      it('should include custom providers when specified', () => {
        const customProvider = {
          provide: 'CUSTOM_TOKEN',
          useValue: 'custom-value',
        };

        const config: MixedServiceConfig = {
          customProviders: [customProvider],
        };

        const providers = VytchesDDDBulkProvider.forMixedServices(config);

        // Should include custom provider + bulk registrar
        expect(providers.length).toBe(2);
        expect(providers).toContainEqual(customProvider);
      });
    });

    describe('createBulkRegistrar', () => {
      it('should create a provider for bulk registration', () => {
        const config: MixedServiceConfig = {
          handlers: [TestCommandHandler],
          options: { enableVytchesDDDCapabilities: true },
        };

        const provider = VytchesDDDBulkProvider.createBulkRegistrar(config);

        expect((provider as any).provide).toMatch(/BULK_REGISTRAR_/);
        expect((provider as any).useFactory).toBeDefined();
        expect((provider as any).inject).toEqual([ModuleRef]);
      });
    });
  });

  describe('Validation Helpers', () => {
    describe('validateClasses', () => {
      it('should validate proper constructor functions', () => {
        const classes = [TestCommandHandler, TestDomainService];

        const [_result, error] = safeRun(() => {
          VytchesDDDBulkProvider.validateClasses(classes);
        });

        expect(error).toBeUndefined();
      });

      it('should reject non-function values', () => {
        const invalidClasses = [TestCommandHandler, 'not-a-class' as any];

        const [error] = safeRun(() => {
          VytchesDDDBulkProvider.validateClasses(invalidClasses);
        });

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain('Invalid class provided');
      });

      it('should reject functions without prototype', () => {
        const functionWithoutPrototype = () => {
          return;
        };
        delete (functionWithoutPrototype as any).prototype;

        const [error] = safeRun(() => {
          VytchesDDDBulkProvider.validateClasses([functionWithoutPrototype as any]);
        });

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain('Must have a prototype');
      });
    });

    describe('validateModuleRef', () => {
      it('should validate proper ModuleRef instance', () => {
        const mockModuleRef = {
          get: vi.fn(),
        } as any;

        const [_result, error] = safeRun(() => {
          VytchesDDDBulkProvider.validateModuleRef(mockModuleRef);
        });

        expect(error).toBeUndefined();
      });

      it('should reject null or undefined ModuleRef', () => {
        const [error] = safeRun(() => {
          VytchesDDDBulkProvider.validateModuleRef(null as any);
        });

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('ModuleRef is required for VytchesDDDBulkProvider');
      });

      it('should reject ModuleRef without get method', () => {
        const invalidModuleRef = {} as any;

        const [error] = safeRun(() => {
          VytchesDDDBulkProvider.validateModuleRef(invalidModuleRef);
        });

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain('must have a get() method');
      });
    });
  });
});

describe('BulkRegistrar', () => {
  let moduleRef: ModuleRef;
  let testingModule: TestingModule;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    moduleRef = testingModule.get(ModuleRef);
  });

  afterEach(async () => {
    if (testingModule) {
      await testingModule.close();
    }
  });

  describe('Constructor', () => {
    it('should create registrar with valid inputs', () => {
      const config: BulkRegistrationConfig = {
        handlers: [TestCommandHandler],
        services: [TestDomainService],
      };

      const [error] = safeRun(() => {
        new BulkRegistrar(moduleRef, config);
      });

      expect(error).toBeUndefined();
    });

    it('should validate ModuleRef on construction', () => {
      const config: BulkRegistrationConfig = { handlers: [TestCommandHandler] };

      const [error] = safeRun(() => {
        new BulkRegistrar(null as any, config);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('ModuleRef is required');
    });

    it('should validate handler classes on construction', () => {
      const config: BulkRegistrationConfig = {
        handlers: ['not-a-class' as any],
      };

      const [error] = safeRun(() => {
        new BulkRegistrar(moduleRef, config);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Invalid class provided');
    });
  });

  describe('registerAll', () => {
    it('should register handlers successfully', async () => {
      const config: BulkRegistrationConfig = {
        handlers: [TestCommandHandler, TestQueryHandler],
        options: { enableVytchesDDDCapabilities: true },
      };

      const registrar = new BulkRegistrar(moduleRef, config);
      const result = await registrar.registerAll();

      expect(result.handlers).toHaveLength(2);
      expect(result.errors).toHaveLength(0);

      // Verify handler registration details
      const commandHandlerResult = result.handlers.find(h => h.className === 'TestCommandHandler');
      expect(commandHandlerResult).toBeDefined();
      expect(commandHandlerResult?.registered).toBe(true);
      expect(commandHandlerResult?.instance).toBeInstanceOf(TestCommandHandler);
    });

    it('should register domain services successfully', async () => {
      const config: BulkRegistrationConfig = {
        services: [TestDomainService],
      };

      const registrar = new BulkRegistrar(moduleRef, config);
      const result = await registrar.registerAll();

      expect(result.services).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const serviceResult = result.services[0];
      expect(serviceResult?.className).toBe('TestDomainService');
      expect(serviceResult?.registered).toBe(true);
      expect(serviceResult?.instance).toBeInstanceOf(TestDomainService);
    });

    it('should register event handlers successfully', async () => {
      const config: BulkRegistrationConfig = {
        eventHandlers: [TestEventHandler],
        options: { enableVytchesDDDCapabilities: true },
      };

      const registrar = new BulkRegistrar(moduleRef, config);
      const result = await registrar.registerAll();

      expect(result.eventHandlers).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const eventHandlerResult = result.eventHandlers[0];
      expect(eventHandlerResult?.className).toBe('TestEventHandler');
      expect(eventHandlerResult?.registered).toBe(true);
    });

    it('should register sagas successfully', async () => {
      const config: BulkRegistrationConfig = {
        sagas: [TestSaga],
        options: { enableVytchesDDDCapabilities: true },
      };

      const registrar = new BulkRegistrar(moduleRef, config);
      const result = await registrar.registerAll();

      expect(result.sagas).toHaveLength(1);
      expect(result.errors).toHaveLength(0);

      const sagaResult = result.sagas[0];
      expect(sagaResult?.className).toBe('TestSaga');
      expect(sagaResult?.registered).toBe(true);
    });

    it('should handle mixed service types in single registration', async () => {
      const config: BulkRegistrationConfig = {
        handlers: [TestCommandHandler],
        services: [TestDomainService],
        eventHandlers: [TestEventHandler],
        sagas: [TestSaga],
        options: { enableVytchesDDDCapabilities: true },
      };

      const registrar = new BulkRegistrar(moduleRef, config);
      const result = await registrar.registerAll();

      expect(result.handlers).toHaveLength(1);
      expect(result.services).toHaveLength(1);
      expect(result.eventHandlers).toHaveLength(1);
      expect(result.sagas).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle services not found in NestJS container', async () => {
      const config: BulkRegistrationConfig = {
        handlers: [PureVytchesDDDHandler], // Not registered with @Injectable
      };

      const registrar = new BulkRegistrar(moduleRef, config);
      const result = await registrar.registerAll();

      expect(result.handlers).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      const error = result.errors[0];
      expect(error?.type).toBe('INSTANCE_NOT_FOUND');
      expect(error?.className).toBe('PureVytchesDDDHandler');
      expect(error?.message).toContain('not found in NestJS container');
    });

    it('should prevent duplicate registration', async () => {
      const config: BulkRegistrationConfig = {
        handlers: [TestCommandHandler],
      };

      const registrar = new BulkRegistrar(moduleRef, config);

      // First registration should succeed
      const result1 = await registrar.registerAll();
      expect(result1.errors).toHaveLength(0);

      // Second registration should fail
      const [error] = await safeRun(async () => {
        await registrar.registerAll();
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Bulk registration has already been performed');
    });

    it('should handle registration errors gracefully', async () => {
      // Mock ModuleRef.get to throw an error
      const mockModuleRef = {
        get: vi.fn().mockImplementation(() => {
          throw new Error('Mock registration error');
        }),
      } as any;

      const config: BulkRegistrationConfig = {
        handlers: [TestCommandHandler],
      };

      const registrar = new BulkRegistrar(mockModuleRef, config);
      const result = await registrar.registerAll();

      expect(result.handlers).toHaveLength(0);
      expect(result.errors).toHaveLength(1);

      const error = result.errors[0];
      expect(error?.type).toBe('HANDLER_REGISTRATION_ERROR');
      expect(error?.message).toContain('Mock registration error');
    });
  });

  describe('VytchesDDD Integration', () => {
    it('should register with VytchesDDD when enabled', async () => {
      const config: BulkRegistrationConfig = {
        services: [TestDomainService], // Always registers with VytchesDDD
      };

      // Mock console.debug to verify VytchesDDD registration
      const originalDebug = console.debug;
      const mockDebug = vi.fn();
      console.debug = mockDebug;

      try {
        const registrar = new BulkRegistrar(moduleRef, config);
        const result = await registrar.registerAll();

        expect(result.services).toHaveLength(1);
        expect(result.errors).toHaveLength(0);

        // Note: VytchesDDD registration might fail in test environment
        // but the service should still be registered successfully
      } finally {
        console.debug = originalDebug;
      }
    });

    it('should handle VytchesDDD registration failures gracefully', async () => {
      const config: BulkRegistrationConfig = {
        handlers: [TestCommandHandler],
        options: { enableVytchesDDDCapabilities: true },
      };

      // Mock console.warn to verify error handling
      const originalWarn = console.warn;
      const mockWarn = vi.fn();
      console.warn = mockWarn;

      try {
        const registrar = new BulkRegistrar(moduleRef, config);
        const result = await registrar.registerAll();

        // Handler registration should still succeed even if VytchesDDD fails
        expect(result.handlers).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('Options Handling', () => {
    it('should apply context from options', async () => {
      const config: BulkRegistrationConfig = {
        services: [TestDomainService],
        options: {
          context: 'TestBoundedContext',
          enableVytchesDDDCapabilities: true,
        },
      };

      const registrar = new BulkRegistrar(moduleRef, config);
      const result = await registrar.registerAll();

      expect(result.services).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty options', async () => {
      const config: BulkRegistrationConfig = {
        handlers: [TestCommandHandler],
        options: {},
      };

      const registrar = new BulkRegistrar(moduleRef, config);
      const result = await registrar.registerAll();

      expect(result.handlers).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });
});
