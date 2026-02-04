import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { EVENT_HANDLER_METADATA, IEventBus } from '@vytches/ddd-contracts';
import { safeRun } from '@vytches/ddd-utils';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';

// --- Mock @vytches/ddd-cqrs to avoid module boundary violations ---
const { MockICommandBus, MockIQueryBus } = vi.hoisted(() => {
  abstract class MockICommandBus {
    abstract register(commandType: unknown, handler: unknown): void;
    abstract registerFactory(commandType: unknown, factory: unknown): void;
    abstract use(middleware: unknown): this;
    abstract discoverHandlers(): void;
    abstract execute(command: unknown): Promise<unknown>;
  }

  abstract class MockIQueryBus {
    abstract register(queryType: unknown, handler: unknown): void;
    abstract registerFactory(queryType: unknown, factory: unknown): void;
    abstract use(middleware: unknown): this;
    abstract discoverHandlers(): void;
    abstract execute(query: unknown): Promise<unknown>;
  }

  return { MockICommandBus, MockIQueryBus };
});

vi.mock('@vytches/ddd-cqrs', () => ({
  ICommandBus: MockICommandBus,
  IQueryBus: MockIQueryBus,
}));

// --- Test message types ---
class TestCommand {
  constructor(public readonly data: string) {}
}

class TestQuery {
  constructor(public readonly filter: string) {}
}

class TestEvent {
  readonly eventName = 'TestEvent';
  constructor(public readonly payload: string) {}
}

class AnotherEvent {
  readonly eventName = 'AnotherEvent';
  constructor(public readonly value: number) {}
}

// --- Test decorators that apply same metadata as real VytchesDDD decorators ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TestCommandHandlerDecorator(messageType: new (...args: any[]) => any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <T extends new (...args: any[]) => any>(target: T): T => {
    Reflect.defineMetadata('di:handler-type', 'command', target);
    Reflect.defineMetadata('di:handler-metadata', { messageType, handlerType: target }, target);
    Reflect.defineMetadata('di:command-handler', { messageType, handlerType: target }, messageType);
    return target;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TestQueryHandlerDecorator(messageType: new (...args: any[]) => any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <T extends new (...args: any[]) => any>(target: T): T => {
    Reflect.defineMetadata('di:handler-type', 'query', target);
    Reflect.defineMetadata('di:handler-metadata', { messageType, handlerType: target }, target);
    Reflect.defineMetadata('di:query-handler', { messageType, handlerType: target }, messageType);
    return target;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TestClassEventHandlerDecorator(eventName: new (...args: any[]) => any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <T extends new (...args: any[]) => any>(target: T): T => {
    Reflect.defineMetadata('di:handler-type', 'event', target);
    Reflect.defineMetadata('di:handler-metadata', { messageType: eventName }, target);
    Reflect.defineMetadata('di:event-handler', { eventName, type: 'event' }, target);
    Reflect.defineMetadata(EVENT_HANDLER_METADATA, { eventName }, target);
    return target;
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TestMethodEventHandlerDecorator(eventName: new (...args: any[]) => any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor => {
    Reflect.defineMetadata(EVENT_HANDLER_METADATA, { eventName }, descriptor.value);
    return descriptor;
  };
}

// --- Test handler classes ---

@Injectable()
@TestCommandHandlerDecorator(TestCommand)
class TestCommandHandler {
  async execute(command: TestCommand): Promise<string> {
    return `cmd:${command.data}`;
  }
}

@Injectable()
@TestQueryHandlerDecorator(TestQuery)
class TestQueryHandler {
  async execute(query: TestQuery): Promise<string[]> {
    return [`result:${query.filter}`];
  }
}

@Injectable()
@TestClassEventHandlerDecorator(TestEvent)
class TestClassLevelEventHandler {
  public handledEvents: unknown[] = [];

  async handle(event: TestEvent): Promise<void> {
    this.handledEvents.push(event);
  }
}

@Injectable()
class TestMethodLevelEventHandler {
  public handledTestEvents: unknown[] = [];
  public handledAnotherEvents: unknown[] = [];

  @TestMethodEventHandlerDecorator(TestEvent)
  async onTestEvent(event: TestEvent): Promise<void> {
    this.handledTestEvents.push(event);
  }

  @TestMethodEventHandlerDecorator(AnotherEvent)
  async onAnotherEvent(event: AnotherEvent): Promise<void> {
    this.handledAnotherEvents.push(event);
  }

  // This method should NOT be discovered (no decorator)
  async someOtherMethod(): Promise<void> {
    // no-op
  }
}

// --- Helper to create mock buses with spies ---
function createMockBuses(): {
  commandBus: {
    register: ReturnType<typeof vi.fn>;
    registerFactory: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };
  queryBus: {
    register: ReturnType<typeof vi.fn>;
    registerFactory: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
  eventBus: {
    subscribe: ReturnType<typeof vi.fn>;
    registerHandler: ReturnType<typeof vi.fn>;
    publish: ReturnType<typeof vi.fn>;
    publishMany: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  };
} {
  return {
    commandBus: {
      register: vi.fn(),
      registerFactory: vi.fn(),
      execute: vi.fn().mockResolvedValue(undefined),
    },
    queryBus: {
      register: vi.fn(),
      registerFactory: vi.fn(),
      send: vi.fn().mockResolvedValue(undefined),
    },
    eventBus: {
      subscribe: vi.fn(),
      registerHandler: vi.fn(),
      publish: vi.fn().mockResolvedValue(undefined),
      publishMany: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn(),
    },
  };
}

// ============================================================
// TESTS
// ============================================================

describe('DI Auto-Discovery System - Comprehensive Tests', () => {
  let module: TestingModule;

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  // ----------------------------------------------------------
  // 1. Bus Injection Verification
  // ----------------------------------------------------------
  describe('Bus Injection Verification', () => {
    it('should inject all three buses when provided via forRoot', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              { provide: MockICommandBus, useValue: mocks.commandBus },
              { provide: MockIQueryBus, useValue: mocks.queryBus },
              { provide: IEventBus, useValue: mocks.eventBus },
            ],
          }),
        ],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      expect(explorer.hasCommandBus()).toBe(true);
      expect(explorer.hasQueryBus()).toBe(true);
      expect(explorer.hasEventBus()).toBe(true);
    });

    it('should handle missing buses gracefully (all optional)', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot()],
      }).compile();

      const [initError] = await safeRun(async () => module.init());
      expect(initError).toBeUndefined();

      const explorer = module.get(VytchesExplorerService);
      expect(explorer.hasCommandBus()).toBe(false);
      expect(explorer.hasQueryBus()).toBe(false);
      expect(explorer.hasEventBus()).toBe(false);
    });

    it('should inject only event bus when only event bus is provided', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: IEventBus, useValue: mocks.eventBus }],
          }),
        ],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      expect(explorer.hasCommandBus()).toBe(false);
      expect(explorer.hasQueryBus()).toBe(false);
      expect(explorer.hasEventBus()).toBe(true);
    });

    it('should provide all buses through forTesting()', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forTesting()],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      expect(explorer.hasCommandBus()).toBe(true);
      expect(explorer.hasQueryBus()).toBe(true);
      expect(explorer.hasEventBus()).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 2. Class-Level Command Handler Discovery
  // ----------------------------------------------------------
  describe('Class-Level Command Handler Discovery', () => {
    it('should discover and register command handler with command bus', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              { provide: MockICommandBus, useValue: mocks.commandBus },
              { provide: MockIQueryBus, useValue: mocks.queryBus },
              { provide: IEventBus, useValue: mocks.eventBus },
            ],
          }),
        ],
        providers: [TestCommandHandler],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      const commandHandlers = explorer.getHandlersByType('command');

      expect(commandHandlers.length).toBeGreaterThanOrEqual(1);
      const handler = commandHandlers.find(h => h.handlerType === TestCommandHandler);
      expect(handler).toBeDefined();
      expect(handler?.messageType).toBe(TestCommand);

      // Verify registration was called on the bus
      expect(mocks.commandBus.registerFactory).toHaveBeenCalled();
    });

    it('should use registerFactory when available on command bus', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: MockICommandBus, useValue: mocks.commandBus }],
          }),
        ],
        providers: [TestCommandHandler],
      }).compile();
      await module.init();

      // registerFactory should be preferred over register
      expect(mocks.commandBus.registerFactory).toHaveBeenCalledWith(
        TestCommand,
        expect.any(Function)
      );
    });

    it('should fall back to register when registerFactory is not available', async () => {
      const busWithoutFactory = {
        register: vi.fn(),
        execute: vi.fn(),
      };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: MockICommandBus, useValue: busWithoutFactory }],
          }),
        ],
        providers: [TestCommandHandler],
      }).compile();
      await module.init();

      expect(busWithoutFactory.register).toHaveBeenCalledWith(TestCommand, expect.any(Object));
    });
  });

  // ----------------------------------------------------------
  // 3. Class-Level Query Handler Discovery
  // ----------------------------------------------------------
  describe('Class-Level Query Handler Discovery', () => {
    it('should discover and register query handler with query bus', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              { provide: MockICommandBus, useValue: mocks.commandBus },
              { provide: MockIQueryBus, useValue: mocks.queryBus },
              { provide: IEventBus, useValue: mocks.eventBus },
            ],
          }),
        ],
        providers: [TestQueryHandler],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      const queryHandlers = explorer.getHandlersByType('query');

      expect(queryHandlers.length).toBeGreaterThanOrEqual(1);
      const handler = queryHandlers.find(h => h.handlerType === TestQueryHandler);
      expect(handler).toBeDefined();
      expect(handler?.messageType).toBe(TestQuery);

      expect(mocks.queryBus.registerFactory).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // 4. Class-Level Event Handler Discovery
  // ----------------------------------------------------------
  describe('Class-Level Event Handler Discovery', () => {
    it('should discover class-level event handler and register with registerHandler', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              { provide: MockICommandBus, useValue: mocks.commandBus },
              { provide: MockIQueryBus, useValue: mocks.queryBus },
              { provide: IEventBus, useValue: mocks.eventBus },
            ],
          }),
        ],
        providers: [TestClassLevelEventHandler],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      const eventHandlers = explorer.getHandlersByType('event');

      // Should find the class-level event handler
      const classHandler = eventHandlers.find(
        h =>
          h.handlerType === TestClassLevelEventHandler &&
          !(h.metadata as Record<string, unknown>)?.methodName
      );
      expect(classHandler).toBeDefined();

      // registerHandler should have been called (not subscribe) for class-level
      expect(mocks.eventBus.registerHandler).toHaveBeenCalledWith(
        'TestEvent',
        expect.any(Object) // The handler instance with handle() method
      );
    });

    it('should not register event handler when event bus is not provided', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              // Only command bus, no event bus
              { provide: MockICommandBus, useValue: mocks.commandBus },
            ],
          }),
        ],
        providers: [TestClassLevelEventHandler],
      }).compile();
      await module.init();

      // Event handler should be discovered but not registered
      const explorer = module.get(VytchesExplorerService);
      const eventHandlers = explorer.getHandlersByType('event');
      expect(eventHandlers.length).toBeGreaterThanOrEqual(1);

      // No subscribe or registerHandler calls
      expect(mocks.eventBus.subscribe).not.toHaveBeenCalled();
      expect(mocks.eventBus.registerHandler).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // 5. Method-Level Event Handler Discovery
  // ----------------------------------------------------------
  describe('Method-Level Event Handler Discovery', () => {
    it('should discover method-level event handlers and register with subscribe', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              { provide: MockICommandBus, useValue: mocks.commandBus },
              { provide: MockIQueryBus, useValue: mocks.queryBus },
              { provide: IEventBus, useValue: mocks.eventBus },
            ],
          }),
        ],
        providers: [TestMethodLevelEventHandler],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      const eventHandlers = explorer.getHandlersByType('event');

      // Should find two method-level handlers (onTestEvent, onAnotherEvent)
      const methodHandlers = eventHandlers.filter(
        h => (h.metadata as Record<string, unknown>)?.methodName
      );
      expect(methodHandlers.length).toBeGreaterThanOrEqual(2);

      // Check specific methods
      const testEventHandler = methodHandlers.find(
        h => (h.metadata as Record<string, unknown>)?.methodName === 'onTestEvent'
      );
      expect(testEventHandler).toBeDefined();
      expect(testEventHandler?.messageType).toBe(TestEvent);
      expect(testEventHandler?.handlerType).toBe(TestMethodLevelEventHandler);

      const anotherEventHandler = methodHandlers.find(
        h => (h.metadata as Record<string, unknown>)?.methodName === 'onAnotherEvent'
      );
      expect(anotherEventHandler).toBeDefined();
      expect(anotherEventHandler?.messageType).toBe(AnotherEvent);

      // subscribe should have been called for method-level handlers
      expect(mocks.eventBus.subscribe).toHaveBeenCalledWith('TestEvent', expect.any(Function));
      expect(mocks.eventBus.subscribe).toHaveBeenCalledWith('AnotherEvent', expect.any(Function));
    });

    it('should not discover non-decorated methods', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: IEventBus, useValue: mocks.eventBus }],
          }),
        ],
        providers: [TestMethodLevelEventHandler],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      const eventHandlers = explorer.getHandlersByType('event');

      // 'someOtherMethod' should NOT appear
      const otherMethod = eventHandlers.find(
        h => (h.metadata as Record<string, unknown>)?.methodName === 'someOtherMethod'
      );
      expect(otherMethod).toBeUndefined();
    });

    it('should bind method-level handlers to the correct instance', async () => {
      const subscribeSpy = vi.fn();
      const mockEventBus = {
        subscribe: subscribeSpy,
        registerHandler: vi.fn(),
        publish: vi.fn().mockResolvedValue(undefined),
        publishMany: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn(),
      };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: IEventBus, useValue: mockEventBus }],
          }),
        ],
        providers: [TestMethodLevelEventHandler],
      }).compile();
      await module.init();

      // Find the subscribe call for TestEvent
      const testEventCall = subscribeSpy.mock.calls.find(
        (call: unknown[]) => call[0] === 'TestEvent'
      );
      expect(testEventCall).toBeDefined();

      // Call the bound handler function to verify it executes correctly
      const boundHandler = testEventCall![1] as (event: unknown) => Promise<void>;
      const testEvent = new TestEvent('test-payload');
      await boundHandler(testEvent);

      // The handler instance should have received the event
      const handlerInstance = module.get(TestMethodLevelEventHandler);
      expect(handlerInstance.handledTestEvents).toContain(testEvent);
    });
  });

  // ----------------------------------------------------------
  // 6. Mixed Handler Discovery
  // ----------------------------------------------------------
  describe('Mixed Handler Discovery', () => {
    it('should discover all handler types simultaneously', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              { provide: MockICommandBus, useValue: mocks.commandBus },
              { provide: MockIQueryBus, useValue: mocks.queryBus },
              { provide: IEventBus, useValue: mocks.eventBus },
            ],
          }),
        ],
        providers: [
          TestCommandHandler,
          TestQueryHandler,
          TestClassLevelEventHandler,
          TestMethodLevelEventHandler,
        ],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);

      // All handler types should be discovered
      expect(explorer.getHandlersByType('command').length).toBeGreaterThanOrEqual(1);
      expect(explorer.getHandlersByType('query').length).toBeGreaterThanOrEqual(1);
      expect(explorer.getHandlersByType('event').length).toBeGreaterThanOrEqual(3); // 1 class + 2 method

      // All bus registration methods should have been called
      expect(mocks.commandBus.registerFactory).toHaveBeenCalled();
      expect(mocks.queryBus.registerFactory).toHaveBeenCalled();
      expect(mocks.eventBus.registerHandler).toHaveBeenCalled(); // class-level
      expect(mocks.eventBus.subscribe).toHaveBeenCalled(); // method-level
    });

    it('should return all handlers via getHandlers()', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              { provide: MockICommandBus, useValue: mocks.commandBus },
              { provide: MockIQueryBus, useValue: mocks.queryBus },
              { provide: IEventBus, useValue: mocks.eventBus },
            ],
          }),
        ],
        providers: [
          TestCommandHandler,
          TestQueryHandler,
          TestClassLevelEventHandler,
          TestMethodLevelEventHandler,
        ],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      const allHandlers = explorer.getHandlers();

      // At minimum: 1 command + 1 query + 1 class event + 2 method events = 5
      expect(allHandlers.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ----------------------------------------------------------
  // 7. Handler Retrieval Methods
  // ----------------------------------------------------------
  describe('Handler Retrieval Methods', () => {
    it('getHandlersByType should filter correctly', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              { provide: MockICommandBus, useValue: mocks.commandBus },
              { provide: MockIQueryBus, useValue: mocks.queryBus },
              { provide: IEventBus, useValue: mocks.eventBus },
            ],
          }),
        ],
        providers: [TestCommandHandler, TestQueryHandler, TestClassLevelEventHandler],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);

      const commands = explorer.getHandlersByType('command');
      const queries = explorer.getHandlersByType('query');
      const events = explorer.getHandlersByType('event');
      const services = explorer.getHandlersByType('domain-service');

      // Every handler should have correct type
      commands.forEach(h => expect(h.type).toBe('command'));
      queries.forEach(h => expect(h.type).toBe('query'));
      events.forEach(h => expect(h.type).toBe('event'));
      expect(services.length).toBe(0); // No domain services registered
    });

    it('getHandlers should return empty before initialization', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot()],
      }).compile();
      // Do NOT call module.init()

      const explorer = module.get(VytchesExplorerService);
      expect(explorer.getHandlers()).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // 8. Manual Handler Registration
  // ----------------------------------------------------------
  describe('Manual Handler Registration', () => {
    it('should register manually added handler with the bus', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: MockICommandBus, useValue: mocks.commandBus }],
          }),
        ],
        providers: [TestCommandHandler],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      const beforeCount = explorer.getHandlers().length;

      // Manually register another handler
      await explorer.registerHandler({
        type: 'command',
        messageType: TestQuery as unknown as new (...args: unknown[]) => unknown,
        handlerType: TestQueryHandler as unknown as new (...args: unknown[]) => unknown,
        metadata: {},
      });

      expect(explorer.getHandlers().length).toBe(beforeCount + 1);
    });
  });

  // ----------------------------------------------------------
  // 9. Error Handling
  // ----------------------------------------------------------
  describe('Error Handling', () => {
    it('should not fail when no handlers are found', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              { provide: MockICommandBus, useValue: mocks.commandBus },
              { provide: MockIQueryBus, useValue: mocks.queryBus },
              { provide: IEventBus, useValue: mocks.eventBus },
            ],
          }),
        ],
        // No handler providers
      }).compile();

      const [initError] = await safeRun(async () => module.init());
      expect(initError).toBeUndefined();

      const explorer = module.get(VytchesExplorerService);
      // May find some NestJS internal providers, but no CQRS handlers
      const commands = explorer.getHandlersByType('command');
      const queries = explorer.getHandlersByType('query');
      expect(commands.length).toBe(0);
      expect(queries.length).toBe(0);
    });

    it('should skip providers without metadata gracefully', async () => {
      @Injectable()
      class PlainService {
        getValue(): string {
          return 'plain';
        }
      }

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: IEventBus, useValue: createMockBuses().eventBus }],
          }),
        ],
        providers: [PlainService],
      }).compile();

      const [initError] = await safeRun(async () => module.init());
      expect(initError).toBeUndefined();

      const explorer = module.get(VytchesExplorerService);
      // PlainService should not appear as a handler
      const allHandlers = explorer.getHandlers();
      const plainHandler = allHandlers.find(h => h.handlerType === PlainService);
      expect(plainHandler).toBeUndefined();
    });

    it('should continue registering after one handler fails', async () => {
      const mocks = createMockBuses();
      // Make the first registerFactory call throw, second should still work
      let callCount = 0;
      mocks.commandBus.registerFactory.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Registration failed');
        }
      });

      // Create a second command handler
      class SecondCommand {
        constructor(public readonly id: string) {}
      }

      @Injectable()
      @TestCommandHandlerDecorator(SecondCommand)
      class SecondCommandHandler {
        async execute(): Promise<void> {
          // no-op
        }
      }

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: MockICommandBus, useValue: mocks.commandBus }],
          }),
        ],
        providers: [TestCommandHandler, SecondCommandHandler],
      }).compile();

      // Should not throw even though one registration failed
      const [initError] = await safeRun(async () => module.init());
      expect(initError).toBeUndefined();

      // registerFactory should have been called for both
      expect(mocks.commandBus.registerFactory).toHaveBeenCalledTimes(2);
    });
  });

  // ----------------------------------------------------------
  // 10. Initialization Guards
  // ----------------------------------------------------------
  describe('Initialization Guards', () => {
    it('should only initialize once even if onModuleInit is called twice', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: MockICommandBus, useValue: mocks.commandBus }],
          }),
        ],
        providers: [TestCommandHandler],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      const firstCallCount = mocks.commandBus.registerFactory.mock.calls.length;

      // Manually trigger onModuleInit again
      await explorer.onModuleInit();

      // Should not register handlers again
      expect(mocks.commandBus.registerFactory.mock.calls.length).toBe(firstCallCount);
    });
  });

  // ----------------------------------------------------------
  // 11. End-to-End Event Handler Execution
  // ----------------------------------------------------------
  describe('End-to-End Event Handler Execution', () => {
    it('class-level event handler should receive events through the bus', async () => {
      // Track handlers registered with the event bus
      const registeredHandlers = new Map<string, { handle: (event: unknown) => unknown }>();

      const mockEventBus = {
        subscribe: vi.fn(),
        registerHandler: vi
          .fn()
          .mockImplementation(
            (eventType: string, handler: { handle: (event: unknown) => unknown }) => {
              registeredHandlers.set(eventType, handler);
            }
          ),
        publish: vi.fn().mockResolvedValue(undefined),
        publishMany: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn(),
      };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: IEventBus, useValue: mockEventBus }],
          }),
        ],
        providers: [TestClassLevelEventHandler],
      }).compile();
      await module.init();

      // Simulate event bus dispatching to the registered handler
      const handler = registeredHandlers.get('TestEvent');
      expect(handler).toBeDefined();

      const event = new TestEvent('e2e-test');
      await handler!.handle(event);

      // Verify the handler instance processed the event
      const handlerInstance = module.get(TestClassLevelEventHandler);
      expect(handlerInstance.handledEvents).toContain(event);
    });

    it('method-level event handler should execute bound method correctly', async () => {
      const subscribedHandlers = new Map<string, (event: unknown) => unknown>();

      const mockEventBus = {
        subscribe: vi
          .fn()
          .mockImplementation((eventType: string, handler: (event: unknown) => unknown) => {
            subscribedHandlers.set(eventType, handler);
          }),
        registerHandler: vi.fn(),
        publish: vi.fn().mockResolvedValue(undefined),
        publishMany: vi.fn().mockResolvedValue(undefined),
        unsubscribe: vi.fn(),
      };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: IEventBus, useValue: mockEventBus }],
          }),
        ],
        providers: [TestMethodLevelEventHandler],
      }).compile();
      await module.init();

      // Simulate event dispatch for TestEvent
      const testEventHandler = subscribedHandlers.get('TestEvent');
      expect(testEventHandler).toBeDefined();

      const event1 = new TestEvent('method-test');
      await testEventHandler!(event1);

      // Simulate event dispatch for AnotherEvent
      const anotherEventHandler = subscribedHandlers.get('AnotherEvent');
      expect(anotherEventHandler).toBeDefined();

      const event2 = new AnotherEvent(42);
      await anotherEventHandler!(event2);

      // Verify both methods received their events
      const handlerInstance = module.get(TestMethodLevelEventHandler);
      expect(handlerInstance.handledTestEvents).toContain(event1);
      expect(handlerInstance.handledAnotherEvents).toContain(event2);
    });

    it('command handler factory should return correct instance', async () => {
      let capturedFactory: (() => unknown) | undefined;

      const mockCommandBus = {
        registerFactory: vi.fn().mockImplementation((_type: unknown, factory: () => unknown) => {
          capturedFactory = factory;
        }),
        register: vi.fn(),
        execute: vi.fn(),
      };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: MockICommandBus, useValue: mockCommandBus }],
          }),
        ],
        providers: [TestCommandHandler],
      }).compile();
      await module.init();

      // The factory should return the NestJS-managed handler instance
      expect(capturedFactory).toBeDefined();
      const instance = capturedFactory!();
      expect(instance).toBeInstanceOf(TestCommandHandler);

      // Execute the handler directly
      const result = await (instance as TestCommandHandler).execute(
        new TestCommand('factory-test')
      );
      expect(result).toBe('cmd:factory-test');
    });
  });

  // ----------------------------------------------------------
  // 12. Combined Class and Method Event Handlers
  // ----------------------------------------------------------
  describe('Combined Class and Method Event Handlers on Same Provider', () => {
    @Injectable()
    @TestClassEventHandlerDecorator(TestEvent)
    class CombinedEventHandler {
      public classHandleCalls: unknown[] = [];
      public methodHandleCalls: unknown[] = [];

      async handle(event: TestEvent): Promise<void> {
        this.classHandleCalls.push(event);
      }

      @TestMethodEventHandlerDecorator(AnotherEvent)
      async onAnotherEvent(event: AnotherEvent): Promise<void> {
        this.methodHandleCalls.push(event);
      }
    }

    it('should discover both class-level and method-level handlers on same class', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [{ provide: IEventBus, useValue: mocks.eventBus }],
          }),
        ],
        providers: [CombinedEventHandler],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      const eventHandlers = explorer.getHandlersByType('event');

      // Should find both: class-level for TestEvent and method-level for AnotherEvent
      const classHandler = eventHandlers.find(
        h =>
          h.handlerType === CombinedEventHandler &&
          !(h.metadata as Record<string, unknown>)?.methodName
      );
      const methodHandler = eventHandlers.find(
        h =>
          h.handlerType === CombinedEventHandler &&
          (h.metadata as Record<string, unknown>)?.methodName === 'onAnotherEvent'
      );

      expect(classHandler).toBeDefined();
      expect(methodHandler).toBeDefined();

      // registerHandler called for class-level, subscribe for method-level
      expect(mocks.eventBus.registerHandler).toHaveBeenCalledWith('TestEvent', expect.any(Object));
      expect(mocks.eventBus.subscribe).toHaveBeenCalledWith('AnotherEvent', expect.any(Function));
    });
  });

  // ----------------------------------------------------------
  // 13. Context Configuration
  // ----------------------------------------------------------
  describe('Context Configuration', () => {
    it('should support configureContext method', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forTesting()],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      explorer.configureContext({ name: 'TestContext' });

      // Should not throw
      expect(explorer).toBeDefined();
    });

    it('discoverAllContextHandlers should return all discovered handlers', async () => {
      const mocks = createMockBuses();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              { provide: MockICommandBus, useValue: mocks.commandBus },
              { provide: IEventBus, useValue: mocks.eventBus },
            ],
          }),
        ],
        providers: [TestCommandHandler, TestClassLevelEventHandler],
      }).compile();
      await module.init();

      const explorer = module.get(VytchesExplorerService);
      const allContextHandlers = await explorer.discoverAllContextHandlers();

      expect(allContextHandlers.length).toBeGreaterThanOrEqual(2);
    });
  });
});
