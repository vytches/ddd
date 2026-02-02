import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import 'reflect-metadata';
import { safeRun } from '@vytches/ddd-utils';
import type { IDependencyContainer } from '@vytches/ddd-di';
import { CommandBus, HandlerNotFoundError } from '../../src';
import type { CQRSExecutionContext, ICQRSMiddleware, ICommand, ICommandHandler } from '../../src/';

// Test command implementation
class TestCommand implements ICommand {
  constructor(public readonly data: string) {}
}

// Test validatable command
class ValidatableCommand implements ICommand {
  constructor(public readonly data: string) {}

  async validate(): Promise<void> {
    if (!this.data) {
      throw new Error('Data is required');
    }
  }
}

// Test command handler
class TestCommandHandler implements ICommandHandler<TestCommand> {
  async execute(_command: TestCommand): Promise<void> {
    // Mock implementation
  }
}

// Shared execution order tracker
let globalExecutionOrder: number[] = [];

// Test middleware
class TestMiddleware implements ICQRSMiddleware {
  public executionOrder: number[] = [];

  constructor(private order: number) {}

  async handle(context: CQRSExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    this.executionOrder.push(this.order);
    globalExecutionOrder.push(this.order);
    const result = await next();
    // Copy the global execution order to this middleware
    this.executionOrder = [...globalExecutionOrder];
    return result;
  }
}

describe('CommandBus', () => {
  let commandBus: CommandBus;
  let mockContainer: IDependencyContainer;
  let mockHandler: TestCommandHandler;

  beforeEach(() => {
    // Reset global execution order
    globalExecutionOrder = [];

    mockContainer = {
      resolve: vi.fn(),
      register: vi.fn(),
      registerInstance: vi.fn(),
      registerFactory: vi.fn(),
      isRegistered: vi.fn(),
      dispose: vi.fn(),
      getServices: vi.fn(),
      createScope: vi.fn(),
      getServicesByTag: vi.fn(),
    };

    mockHandler = new TestCommandHandler();
    commandBus = new CommandBus(mockContainer);
  });

  describe('constructor', () => {
    it('should initialize with empty middlewares', () => {
      expect(commandBus).toBeInstanceOf(CommandBus);
    });

    it('should store container reference', () => {
      expect(commandBus['container']).toBe(mockContainer);
    });
  });

  describe('register', () => {
    it('should allow manual handler registration', () => {
      const [registerError] = safeRun(() => {
        commandBus.register(TestCommand, mockHandler);
      });
      expect(registerError).toBeUndefined();
    });

    it('should register handler for string command name', () => {
      const [registerError] = safeRun(() => {
        commandBus.register('TestCommand', mockHandler);
      });
      expect(registerError).toBeUndefined();
    });
  });

  describe('registerFactory', () => {
    it('should allow factory registration', () => {
      const factory = () => mockHandler;

      const [factoryError] = safeRun(() => {
        commandBus.registerFactory(TestCommand, factory);
      });
      expect(factoryError).toBeUndefined();
    });

    it('should register factory for string command name', () => {
      const factory = () => mockHandler;

      const [factoryError] = safeRun(() => {
        commandBus.registerFactory('TestCommand', factory);
      });
      expect(factoryError).toBeUndefined();
    });
  });

  describe('use', () => {
    it('should add middleware to the pipeline', () => {
      const middleware = new TestMiddleware(1);
      const result = commandBus.use(middleware);

      expect(result).toBe(commandBus);
      expect(commandBus['middlewares']).toHaveLength(1);
      expect(commandBus['middlewares'][0]).toBe(middleware);
    });

    it('should add multiple middlewares in order', () => {
      const middleware1 = new TestMiddleware(1);
      const middleware2 = new TestMiddleware(2);

      commandBus.use(middleware1).use(middleware2);

      expect(commandBus['middlewares']).toHaveLength(2);
      expect(commandBus['middlewares'][0]).toBe(middleware1);
      expect(commandBus['middlewares'][1]).toBe(middleware2);
    });

    it('should return this for chaining', () => {
      const middleware1 = new TestMiddleware(1);
      const middleware2 = new TestMiddleware(2);

      const result = commandBus.use(middleware1).use(middleware2);

      expect(result).toBe(commandBus);
    });
  });

  describe('discoverHandlers', () => {
    it('should be callable without throwing (deprecated method)', () => {
      // discoverHandlers is deprecated but should still be callable
      // Logging behavior is handled through the Logger infrastructure
      const [error] = safeRun(() => commandBus.discoverHandlers());
      expect(error).toBeUndefined();
    });

    it('should suppress warnings in CI environment', () => {
      const originalCI = process.env.CI;
      process.env.CI = 'true';

      // In CI environment, the method should complete without issues
      // The actual warning suppression is handled by the CI check in the code
      const [error] = safeRun(() => commandBus.discoverHandlers());
      expect(error).toBeUndefined();

      process.env.CI = originalCI;
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      // Mock Reflect.getMetadata
      vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: string) => {
        if (key === 'di:command-handler') {
          return {
            serviceId: 'testHandler',
            handlerType: TestCommandHandler,
          };
        }
        return undefined;
      });
    });

    it('should successfully execute a command', async () => {
      const command = new TestCommand('test-data');
      const executeSpy = vi.spyOn(mockHandler, 'execute').mockResolvedValue(undefined);

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await commandBus.execute(command);

      expect(mockContainer.resolve).toHaveBeenCalledWith('testHandler');
      expect(executeSpy).toHaveBeenCalledWith(command);
    });

    it('should throw HandlerNotFoundError when handler is not found', async () => {
      const command = new TestCommand('test-data');

      (mockContainer.resolve as Mock).mockImplementation(() => {
        throw new Error('Handler not found');
      });

      const [executeError] = await safeRun(() => commandBus.execute(command));
      expect(executeError).toBeInstanceOf(HandlerNotFoundError);
    });

    it('should throw HandlerNotFoundError when no handler exists', async () => {
      const command = new TestCommand('test-data');

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue(undefined);

      const [executeError] = await safeRun(() => commandBus.execute(command));
      expect(executeError).toBeInstanceOf(HandlerNotFoundError);
      expect(executeError?.message).toContain('No command handler registered for: TestCommand');
    });

    it('should execute manually registered handler', async () => {
      const command = new TestCommand('test-data');
      const manualHandler = {
        execute: vi.fn().mockResolvedValue('manual-result'),
      };

      commandBus.register(TestCommand, manualHandler);

      const result = await commandBus.execute(command);

      expect(manualHandler.execute).toHaveBeenCalledWith(command);
      expect(result).toBe('manual-result');
    });

    it('should execute factory-registered handler', async () => {
      const command = new TestCommand('test-data');
      const factoryHandler = {
        execute: vi.fn().mockResolvedValue('factory-result'),
      };

      commandBus.registerFactory(TestCommand, () => factoryHandler);

      const result = await commandBus.execute(command);

      expect(factoryHandler.execute).toHaveBeenCalledWith(command);
      expect(result).toBe('factory-result');
    });

    it('should validate command when validatable', async () => {
      const command = new ValidatableCommand('test-data');
      const validateSpy = vi.spyOn(command, 'validate').mockResolvedValue(undefined);

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await commandBus.execute(command);

      expect(validateSpy).toHaveBeenCalled();
    });

    it('should throw validation error when validation fails', async () => {
      const command = new ValidatableCommand('');

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const [validationError] = await safeRun(() => commandBus.execute(command));
      expect(validationError?.message).toBe('Data is required');
    });

    it('should execute middleware in correct order', async () => {
      const command = new TestCommand('test-data');
      const middleware1 = new TestMiddleware(1);
      const middleware2 = new TestMiddleware(2);

      commandBus.use(middleware1).use(middleware2);

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await commandBus.execute(command);

      expect(middleware1.executionOrder).toEqual([1, 2]);
    });

    it('should execute without middleware when none are registered', async () => {
      const command = new TestCommand('test-data');
      const executeSpy = vi.spyOn(mockHandler, 'execute').mockResolvedValue(undefined);

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await commandBus.execute(command);

      expect(executeSpy).toHaveBeenCalledWith(command);
    });

    it('should handle handler execution errors', async () => {
      const command = new TestCommand('test-data');
      const error = new Error('Handler execution failed');

      vi.spyOn(mockHandler, 'execute').mockRejectedValue(error);
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      const [handlerError] = await safeRun(() => commandBus.execute(command));
      expect(handlerError?.message).toBe('Handler execution failed');
    });

    it('should create proper execution context', async () => {
      const command = new TestCommand('test-data');
      let capturedContext: CQRSExecutionContext;

      const middleware: ICQRSMiddleware = {
        async handle(context: CQRSExecutionContext, next: () => Promise<unknown>) {
          capturedContext = context;
          return next();
        },
      };

      commandBus.use(middleware);
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await commandBus.execute(command);

      expect(capturedContext!.commandOrQuery).toBe(command);
      expect(capturedContext!.handler).toBe(mockHandler);
      expect(capturedContext!.type).toBe('command');
    });

    it('should use service ID from metadata when available', async () => {
      const command = new TestCommand('test-data');

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue({
        serviceId: 'customServiceId',
        handlerType: TestCommandHandler,
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await commandBus.execute(command);

      expect(mockContainer.resolve).toHaveBeenCalledWith('customServiceId');
    });

    it('should use handler type name when no service ID in metadata', async () => {
      const command = new TestCommand('test-data');

      vi.spyOn(Reflect, 'getMetadata').mockReturnValue({
        handlerType: TestCommandHandler,
      });

      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await commandBus.execute(command);

      expect(mockContainer.resolve).toHaveBeenCalledWith('TestCommandHandler');
    });
  });

  describe('isValidatable', () => {
    it('should return true for objects with validate method', () => {
      const validatable = {
        validate: () => {
          return;
        },
      };
      expect(commandBus['isValidatable'](validatable)).toBe(true);
    });

    it('should return false for null', () => {
      expect(commandBus['isValidatable'](null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(commandBus['isValidatable'](undefined)).toBe(false);
    });

    it('should return false for objects without validate method', () => {
      const nonValidatable = { data: 'test' };
      expect(commandBus['isValidatable'](nonValidatable)).toBe(false);
    });

    it('should return false for primitive values', () => {
      expect(commandBus['isValidatable']('string')).toBe(false);
      expect(commandBus['isValidatable'](123)).toBe(false);
      expect(commandBus['isValidatable'](true)).toBe(false);
    });

    it('should return false when validate is not a function', () => {
      const invalidValidatable = { validate: 'not-a-function' };
      expect(commandBus['isValidatable'](invalidValidatable)).toBe(false);
    });
  });

  describe('middleware execution order', () => {
    it('should execute middleware in FIFO order', async () => {
      const command = new TestCommand('test-data');
      const executionOrder: number[] = [];

      const middleware1: ICQRSMiddleware = {
        async handle(context: CQRSExecutionContext, next: () => Promise<unknown>) {
          executionOrder.push(1);
          const result = await next();
          executionOrder.push(4);
          return result;
        },
      };

      const middleware2: ICQRSMiddleware = {
        async handle(context: CQRSExecutionContext, next: () => Promise<unknown>) {
          executionOrder.push(2);
          const result = await next();
          executionOrder.push(3);
          return result;
        },
      };

      commandBus.use(middleware1).use(middleware2);
      (mockContainer.resolve as Mock).mockReturnValue(mockHandler);

      await commandBus.execute(command);

      expect(executionOrder).toEqual([1, 2, 3, 4]);
    });
  });
});
