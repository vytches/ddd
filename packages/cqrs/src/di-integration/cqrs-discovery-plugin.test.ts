import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'reflect-metadata';
import { CQRSDiscoveryPlugin } from './cqrs-discovery-plugin';

// Test command and query classes
class TestCommand {
  constructor(public readonly data: string) {}
}

class TestQuery {
  constructor(public readonly id: string) {}
}

class TestCommandHandler {
  async execute(command: TestCommand): Promise<void> {
    // Mock implementation
  }
}

class TestQueryHandler {
  async execute(query: TestQuery): Promise<string> {
    return `Result for ${query.id}`;
  }
}

// Test classes without proper metadata
class UnhandledCommand {
  constructor(public readonly value: number) {}
}

class UnhandledHandler {
  async execute(command: UnhandledCommand): Promise<void> {
    // Mock implementation
  }
}

// Test non-handler class
class RegularClass {
  doSomething(): void {
    // Regular class method
  }
}

// Test primitive value
const primitiveValue = 'not-a-class';

// Test object without prototype
const plainObject = { key: 'value' };

describe('CQRSDiscoveryPlugin', () => {
  let plugin: CQRSDiscoveryPlugin;

  beforeEach(() => {
    plugin = new CQRSDiscoveryPlugin();

    // Clear any existing metadata
    Reflect.deleteMetadata('di:handler-type', TestCommandHandler);
    Reflect.deleteMetadata('di:command-handler', TestCommandHandler);
    Reflect.deleteMetadata('di:registration-pending', TestCommandHandler);
    Reflect.deleteMetadata('di:handler-type', TestQueryHandler);
    Reflect.deleteMetadata('di:query-handler', TestQueryHandler);
    Reflect.deleteMetadata('di:registration-pending', TestQueryHandler);
    Reflect.deleteMetadata('di:handler-type', UnhandledHandler);
    Reflect.deleteMetadata('di:command-handler', UnhandledHandler);
    Reflect.deleteMetadata('di:registration-pending', UnhandledHandler);
  });

  describe('name', () => {
    it('should have correct plugin name', () => {
      expect(plugin.name).toBe('CQRS');
    });
  });

  describe('isAvailable', () => {
    it('should always return true when in CQRS package', () => {
      expect(plugin.isAvailable()).toBe(true);
    });
  });

  describe('discoverHandlers', () => {
    it('should return empty array when no assemblies provided', async () => {
      const handlers = await plugin.discoverHandlers();
      expect(handlers).toEqual([]);
    });

    it('should return empty array when empty assemblies provided', async () => {
      const handlers = await plugin.discoverHandlers([]);
      expect(handlers).toEqual([]);
    });

    it('should discover command handlers with proper metadata', async () => {
      // Setup metadata for command handler
      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
        serviceId: 'testCommandHandler'
      }, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      const module = {
        TestCommand,
        TestCommandHandler,
        RegularClass,
        primitiveValue,
        plainObject
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(1);
      expect(handlers?.[0]).toEqual({
        type: 'command',
        messageType: TestCommand,
        handlerType: TestCommandHandler,
        metadata: {
          messageType: TestCommand,
          handlerType: TestCommandHandler,
          serviceId: 'testCommandHandler'
        }
      });
    });

    it('should discover query handlers with proper metadata', async () => {
      // Setup metadata for query handler
      Reflect.defineMetadata('di:handler-type', 'query', TestQueryHandler);
      Reflect.defineMetadata('di:query-handler', {
        messageType: TestQuery,
        handlerType: TestQueryHandler,
        serviceId: 'testQueryHandler'
      }, TestQueryHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestQueryHandler);

      const module = {
        TestQuery,
        TestQueryHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(1);
      expect(handlers?.[0]).toEqual({
        type: 'query',
        messageType: TestQuery,
        handlerType: TestQueryHandler,
        metadata: {
          messageType: TestQuery,
          handlerType: TestQueryHandler,
          serviceId: 'testQueryHandler'
        }
      });
    });

    it('should discover both command and query handlers', async () => {
      // Setup metadata for command handler
      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
        serviceId: 'testCommandHandler'
      }, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      // Setup metadata for query handler
      Reflect.defineMetadata('di:handler-type', 'query', TestQueryHandler);
      Reflect.defineMetadata('di:query-handler', {
        messageType: TestQuery,
        handlerType: TestQueryHandler,
        serviceId: 'testQueryHandler'
      }, TestQueryHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestQueryHandler);

      const module = {
        TestCommand,
        TestCommandHandler,
        TestQuery,
        TestQueryHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(2);

      const commandHandler = handlers.find(h => h.type === 'command');
      expect(commandHandler).toBeDefined();
      expect(commandHandler?.messageType).toBe(TestCommand);
      expect(commandHandler?.handlerType).toBe(TestCommandHandler);

      const queryHandler = handlers.find(h => h.type === 'query');
      expect(queryHandler).toBeDefined();
      expect(queryHandler?.messageType).toBe(TestQuery);
      expect(queryHandler?.handlerType).toBe(TestQueryHandler);
    });

    it('should ignore classes without handler-type metadata', async () => {
      const module = {
        TestCommandHandler,
        RegularClass,
        primitiveValue
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(0);
    });

    it('should ignore classes with wrong handler-type metadata', async () => {
      Reflect.defineMetadata('di:handler-type', 'event', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
      }, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      const module = {
        TestCommandHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(0);
    });

    it('should ignore classes without corresponding metadata', async () => {
      // Only handler-type metadata, missing command-handler metadata
      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      const module = {
        TestCommandHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(0);
    });

    it('should ignore classes without registration-pending metadata', async () => {
      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
      }, TestCommandHandler);
      // Missing registration-pending metadata

      const module = {
        TestCommandHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(0);
    });

    it('should ignore non-function values', async () => {
      const module = {
        primitiveValue: 'string',
        numberValue: 123,
        booleanValue: true,
        nullValue: null,
        undefinedValue: undefined,
        arrayValue: [1, 2, 3],
        plainObject: { key: 'value' }
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(0);
    });

    it('should ignore functions without prototype', async () => {
      const arrowFunction = () => {
        return
      };
      const regularFunction = function() {
        return
      };

      const module = {
        arrowFunction,
        regularFunction
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(0);
    });

    it('should handle multiple assemblies', async () => {
      // Setup command handler in first module
      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
      }, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      // Setup query handler in second module
      Reflect.defineMetadata('di:handler-type', 'query', TestQueryHandler);
      Reflect.defineMetadata('di:query-handler', {
        messageType: TestQuery,
        handlerType: TestQueryHandler,
      }, TestQueryHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestQueryHandler);

      const module1 = {
        TestCommandHandler
      };

      const module2 = {
        TestQueryHandler
      };

      const handlers = await plugin.discoverHandlers([module1, module2]);

      expect(handlers).toHaveLength(2);
      expect(handlers.some(h => h.type === 'command')).toBe(true);
      expect(handlers.some(h => h.type === 'query')).toBe(true);
    });

    it('should handle complex metadata structures', async () => {
      const complexMetadata = {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
        serviceId: 'complexCommandHandler',
        context: 'TestContext',
        timeout: 5000,
        middleware: ['ValidationMiddleware', 'LoggingMiddleware'],
        dependencies: ['service1', 'service2']
      };

      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', complexMetadata, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      const module = {
        TestCommandHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(1);
      expect(handlers?.[0]?.metadata).toEqual(complexMetadata);
    });

    it('should handle empty modules', async () => {
      const emptyModule = {};

      const handlers = await plugin.discoverHandlers([emptyModule]);

      expect(handlers).toHaveLength(0);
    });

    it('should handle modules with mixed content', async () => {
      // Only the handler with proper metadata should be discovered
      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
      }, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      const mixedModule = {
        TestCommandHandler,
        UnhandledHandler,
        RegularClass,
        primitiveValue: 'test',
        numberValue: 42,
        arrayValue: [1, 2, 3],
        objectValue: { key: 'value' },
        functionValue: () => {
          return
        }
      };

      const handlers = await plugin.discoverHandlers([mixedModule]);

      expect(handlers).toHaveLength(1);
      expect(handlers?.[0]?.type).toBe('command');
      expect(handlers?.[0]?.handlerType).toBe(TestCommandHandler);
    });

    it('should preserve metadata exactly as defined', async () => {
      const originalMetadata = {
        messageType: TestQuery,
        handlerType: TestQueryHandler,
        serviceId: 'preservedQueryHandler',
        customProperty: 'customValue',
        nestedObject: {
          prop1: 'value1',
          prop2: 123
        }
      };

      Reflect.defineMetadata('di:handler-type', 'query', TestQueryHandler);
      Reflect.defineMetadata('di:query-handler', originalMetadata, TestQueryHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestQueryHandler);

      const module = {
        TestQueryHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(1);
      expect(handlers?.[0]?.metadata).toEqual(originalMetadata);
      expect(handlers?.[0]?.metadata).not.toBe(originalMetadata); // Should be a copy/reference
    });
  });

  describe('scanModule', () => {
    it('should handle module scanning with spies', async () => {
      const scanModuleSpy = vi.spyOn(plugin as any, 'scanModule');

      // Setup metadata
      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
      }, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      const module = {
        TestCommandHandler,
        RegularClass
      };

      await plugin.discoverHandlers([module]);

      expect(scanModuleSpy).toHaveBeenCalledTimes(1);
      expect(scanModuleSpy).toHaveBeenCalledWith(module);
    });

    it('should be called for each assembly', async () => {
      const scanModuleSpy = vi.spyOn(plugin as any, 'scanModule');

      const module1 = { class1: class {} };
      const module2 = { class2: class {} };
      const module3 = { class3: class {} };

      await plugin.discoverHandlers([module1, module2, module3]);

      expect(scanModuleSpy).toHaveBeenCalledTimes(3);
      expect(scanModuleSpy).toHaveBeenNthCalledWith(1, module1);
      expect(scanModuleSpy).toHaveBeenNthCalledWith(2, module2);
      expect(scanModuleSpy).toHaveBeenNthCalledWith(3, module3);
    });
  });

  describe('edge cases', () => {
    it('should handle null assemblies gracefully', async () => {
      const handlers = await plugin.discoverHandlers(null as any);
      expect(handlers).toEqual([]);
    });

    it('should handle undefined assemblies gracefully', async () => {
      const handlers = await plugin.discoverHandlers(undefined);
      expect(handlers).toEqual([]);
    });

    it('should handle assemblies with null/undefined modules', async () => {
      const handlers = await plugin.discoverHandlers([null, undefined, {}]);
      expect(handlers).toEqual([]);
    });

    it('should handle modules with circular references', async () => {
      const circularModule: any = {
        TestCommandHandler
      };
      circularModule.self = circularModule;

      // Setup metadata
      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
      }, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      const handlers = await plugin.discoverHandlers([circularModule]);

      expect(handlers).toHaveLength(1);
      expect(handlers?.[0]?.type).toBe('command');
    });

    it('should handle handlers with false registration-pending', async () => {
      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
      }, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', false, TestCommandHandler);

      const module = {
        TestCommandHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(0);
    });

    it('should handle handlers with truthy registration-pending values', async () => {
      Reflect.defineMetadata('di:handler-type', 'command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
      }, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', 'truthy-string', TestCommandHandler);

      const module = {
        TestCommandHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(1);
    });
  });

  describe('metadata validation', () => {
    it('should require exact handler-type match', async () => {
      // Test case insensitive rejection
      Reflect.defineMetadata('di:handler-type', 'Command', TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', {
        messageType: TestCommand,
        handlerType: TestCommandHandler,
      }, TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      const module = {
        TestCommandHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(0);
    });

    it('should handle missing metadata gracefully', async () => {
      const module = {
        TestCommandHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(0);
    });

    it('should handle invalid metadata types', async () => {
      Reflect.defineMetadata('di:handler-type', 123, TestCommandHandler);
      Reflect.defineMetadata('di:command-handler', 'invalid', TestCommandHandler);
      Reflect.defineMetadata('di:registration-pending', true, TestCommandHandler);

      const module = {
        TestCommandHandler
      };

      const handlers = await plugin.discoverHandlers([module]);

      expect(handlers).toHaveLength(0);
    });
  });
});
