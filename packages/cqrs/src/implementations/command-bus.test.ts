import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandBus } from './command-bus';
import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext } from '../middleware';
import { HandlerNotFoundError, CQRSConfigurationError } from '../errors';
import { CQRSMetadataRegistry } from '../registry';

describe('CommandBus', () => {
  class TestCommand implements ICommand {
    constructor(public readonly data: string) {}
  }

  class TestValidatableCommand implements ICommand {
    constructor(public readonly data: string) {}

    async validate(): Promise<void> {
      if (this.data === 'invalid') {
        throw new Error('Validation failed');
      }
    }
  }

  class TestCommandHandler implements ICommandHandler<TestCommand> {
    async execute(_command: TestCommand): Promise<void> {
      // Mock implementation
    }
  }

  let commandBus: CommandBus;
  let mockHandler: ICommandHandler<TestCommand>;
  let mockMiddleware: ICQRSMiddleware;

  beforeEach(() => {
    commandBus = new CommandBus();
    mockHandler = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    mockMiddleware = {
      handle: vi.fn().mockImplementation(async (context, next) => next()),
    };
  });

  describe('constructor', () => {
    it('should create command bus without handler resolver', () => {
      const bus = new CommandBus();
      expect(bus).toBeInstanceOf(CommandBus);
    });

    it('should create command bus with handler resolver', () => {
      const resolver = vi.fn();
      const bus = new CommandBus(resolver);
      expect(bus).toBeInstanceOf(CommandBus);
    });
  });

  describe('register', () => {
    it('should register command handler', () => {
      expect(() => {
        commandBus.register(TestCommand, mockHandler);
      }).not.toThrow();
    });
  });

  describe('registerFactory', () => {
    it('should register handler factory', () => {
      const factory = vi.fn().mockReturnValue(mockHandler);

      expect(() => {
        commandBus.registerFactory(TestCommand, factory);
      }).not.toThrow();
    });
  });

  describe('use', () => {
    it('should add middleware to pipeline', () => {
      const result = commandBus.use(mockMiddleware);
      expect(result).toBe(commandBus);
    });
  });

  describe('execute', () => {
    it('should execute command with registered handler', async () => {
      const command = new TestCommand('test');
      commandBus.register(TestCommand, mockHandler);

      await commandBus.execute(command);

      expect(mockHandler.execute).toHaveBeenCalledWith(command);
    });

    it('should execute command from factory', async () => {
      const command = new TestCommand('test');
      const factory = vi.fn().mockReturnValue(mockHandler);
      commandBus.registerFactory(TestCommand, factory);

      await commandBus.execute(command);

      expect(factory).toHaveBeenCalled();
      expect(mockHandler.execute).toHaveBeenCalledWith(command);
    });

    it('should throw error when handler not found', async () => {
      const command = new TestCommand('test');

      await expect(commandBus.execute(command)).rejects.toThrow(HandlerNotFoundError);
    });

    it('should validate command if validatable', async () => {
      const command = new TestValidatableCommand('valid');
      const validateSpy = vi.spyOn(command, 'validate');
      commandBus.register(TestValidatableCommand, mockHandler);

      await commandBus.execute(command);

      expect(validateSpy).toHaveBeenCalled();
    });

    it('should throw validation error for invalid command', async () => {
      const command = new TestValidatableCommand('invalid');
      commandBus.register(TestValidatableCommand, mockHandler);

      await expect(commandBus.execute(command)).rejects.toThrow('Validation failed');
    });

    it('should execute with middleware pipeline', async () => {
      const command = new TestCommand('test');
      commandBus.register(TestCommand, mockHandler);
      commandBus.use(mockMiddleware);

      await commandBus.execute(command);

      expect(mockMiddleware.handle).toHaveBeenCalled();
      expect(mockHandler.execute).toHaveBeenCalledWith(command);
    });

    it('should execute multiple middlewares in order', async () => {
      const command = new TestCommand('test');
      const calls: number[] = [];

      const middleware1: ICQRSMiddleware = {
        handle: vi.fn().mockImplementation(async (context, next) => {
          calls.push(1);
          return next();
        }),
      };

      const middleware2: ICQRSMiddleware = {
        handle: vi.fn().mockImplementation(async (context, next) => {
          calls.push(2);
          return next();
        }),
      };

      commandBus.register(TestCommand, mockHandler);
      commandBus.use(middleware1);
      commandBus.use(middleware2);

      await commandBus.execute(command);

      expect(calls).toEqual([1, 2]);
    });
  });

  describe('discoverHandlers', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should throw error when no handler resolver provided', () => {
      const bus = new CommandBus();
      vi.spyOn(CQRSMetadataRegistry, 'getCommandHandlers').mockReturnValue(
        new Map([[TestCommand, TestCommandHandler]])
      );

      expect(() => bus.discoverHandlers()).toThrow(CQRSConfigurationError);
    });

    it('should auto-register handlers using resolver', () => {
      const resolver = vi.fn().mockReturnValue(mockHandler);
      const bus = new CommandBus(resolver);

      vi.spyOn(CQRSMetadataRegistry, 'getCommandHandlers').mockReturnValue(
        new Map([[TestCommand, TestCommandHandler]])
      );

      expect(() => bus.discoverHandlers()).not.toThrow();
      expect(resolver).toHaveBeenCalledWith(TestCommandHandler);
    });

    it('should skip already registered handlers', () => {
      const resolver = vi.fn().mockReturnValue(mockHandler);
      const bus = new CommandBus(resolver);

      // Pre-register handler
      bus.register(TestCommand, mockHandler);

      vi.spyOn(CQRSMetadataRegistry, 'getCommandHandlers').mockReturnValue(
        new Map([[TestCommand, TestCommandHandler]])
      );

      bus.discoverHandlers();

      expect(resolver).not.toHaveBeenCalled();
    });

    it('should throw configuration error when resolver fails', () => {
      const resolver = vi.fn().mockImplementation(() => {
        throw new Error('Resolution failed');
      });
      const bus = new CommandBus(resolver);

      vi.spyOn(CQRSMetadataRegistry, 'getCommandHandlers').mockReturnValue(
        new Map([[TestCommand, TestCommandHandler]])
      );

      expect(() => bus.discoverHandlers()).toThrow(CQRSConfigurationError);
    });
  });

  describe('middleware execution context', () => {
    it('should pass correct context to middleware', async () => {
      const command = new TestCommand('test');
      let capturedContext: CQRSExecutionContext | undefined;

      const contextCapturingMiddleware: ICQRSMiddleware = {
        handle: vi.fn().mockImplementation(async (context, next) => {
          capturedContext = context;
          return next();
        }),
      };

      commandBus.register(TestCommand, mockHandler);
      commandBus.use(contextCapturingMiddleware);

      await commandBus.execute(command);

      expect(capturedContext).toBeInstanceOf(CQRSExecutionContext);
      expect(capturedContext?.commandOrQuery).toBe(command);
      expect(capturedContext?.handler).toBe(mockHandler);
      expect(capturedContext?.type).toBe('command');
    });
  });
});
