import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { Injectable, Controller, Get, Post, Body } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';
import { safeRun } from '@vytches/ddd-utils';

// Create mock abstract classes for DI token compatibility using vi.hoisted()
const { MockICommandBus, MockIQueryBus } = vi.hoisted(() => {
  abstract class MockICommandBus {
    abstract register(commandType: any, handler: any): void;
    abstract registerFactory(commandType: any, factory: any): void;
    abstract use(middleware: any): this;
    abstract discoverHandlers(): void;
    abstract execute(command: any): Promise<any>;
  }

  abstract class MockIQueryBus {
    abstract register(queryType: any, handler: any): void;
    abstract registerFactory(queryType: any, factory: any): void;
    abstract use(middleware: any): this;
    abstract discoverHandlers(): void;
    abstract execute(query: any): Promise<any>;
  }

  return { MockICommandBus, MockIQueryBus };
});

// Mock całego systemu CQRS/Events dla testów architektonicznych
vi.mock('@vytches/ddd-cqrs', () => {
  const mockBus = vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    registerFactory: vi.fn(),
    execute: vi.fn().mockResolvedValue({ success: true, data: 'mock-result' }),
    send: vi.fn().mockResolvedValue({ success: true, data: 'mock-result' }),
  }));
  return {
    ICommandBus: MockICommandBus,
    IQueryBus: MockIQueryBus,
    CommandBus: mockBus,
    QueryBus: mockBus,
    EnhancedCommandBus: mockBus,
    EnhancedQueryBus: mockBus,
  };
});

vi.mock('@vytches/ddd-events', async () => ({
  UnifiedEventBus: vi.fn().mockImplementation(() => ({
    publish: vi.fn().mockResolvedValue(true),
    subscribe: vi.fn(),
    publishMany: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('@vytches/ddd-di', async () => ({
  SimpleContainer: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    resolve: vi.fn(),
  })),
  ServiceLifetime: {
    Transient: 'transient',
    Singleton: 'singleton',
    Scoped: 'scoped',
  },
  VytchesDDD: {
    configure: vi.fn(),
    resolve: vi.fn(),
    configureContext: vi.fn(),
  },
  PerformanceOptimizer: vi.fn().mockImplementation(() => ({
    optimizeConfiguration: vi.fn().mockResolvedValue({
      handlersFound: 0,
      startupTime: 50,
      optimized: true,
    }),
    getMetrics: vi.fn().mockReturnValue({
      handlersFound: 0,
      startupTime: 50,
      optimized: true,
    }),
    generateReport: vi.fn().mockReturnValue('Mock performance report'),
  })),
  PerformanceMonitor: vi.fn().mockImplementation(() => ({
    startMeasurement: vi.fn(),
    endMeasurement: vi.fn(),
    updateHandlerCount: vi.fn(),
    generateReport: vi.fn().mockReturnValue('Mock monitoring report'),
    getMetrics: vi.fn().mockReturnValue({
      handlersFound: 0,
      startupTime: 50,
      optimized: true,
    }),
    checkPerformanceTargets: vi.fn().mockReturnValue(true),
  })),
}));

// Test domenowy handler z pełną implementacją
interface TestCommand {
  id: string;
  name: string;
}

interface TestQuery {
  id: string;
}

interface TestEvent {
  eventType: string;
  payload: any;
}

class TestDomainCommand implements TestCommand {
  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}
}

class TestDomainQuery implements TestQuery {
  constructor(public readonly id: string) {}
}

// Mock handler z dekoratorem
@Injectable()
class TestCommandHandler {
  async execute(command: TestDomainCommand): Promise<{ success: boolean; id: string }> {
    return { success: true, id: command.id };
  }
}

@Injectable()
class TestQueryHandler {
  async execute(query: TestDomainQuery): Promise<{ data: string; id: string }> {
    return { data: `result-for-${query.id}`, id: query.id };
  }
}

@Injectable()
class TestEventHandler {
  async handle(event: TestEvent): Promise<void> {
    console.log(`Handled event: ${event.eventType}`);
  }
}

// Business service korzystający z VytchesDDD
@Injectable()
class UserBusinessService {
  constructor() {
    // Empty constructor is required for NestJS DI
  }

  async createUser(userData: { name: string; email: string }) {
    // Symulacja logiki biznesowej
    return {
      id: `user-${Date.now()}`,
      name: userData.name,
      email: userData.email,
      createdAt: new Date(),
    };
  }
}

// NestJS Controller integrujący się z VytchesDDD
@Controller('users')
class UserController {
  constructor(private readonly userService: UserBusinessService) {}

  @Post()
  async createUser(@Body() userData: { name: string; email: string }) {
    return await this.userService.createUser(userData);
  }

  @Get(':id')
  async getUser(@Body() query: { id: string }) {
    return { id: query.id, name: 'Test User' };
  }
}

describe('VytchesDDDModule - Architecture Validation Tests', () => {
  let module: TestingModule;

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    vi.clearAllMocks();
  });

  describe('Real-World NestJS Integration', () => {
    it('should integrate seamlessly with NestJS controllers and services', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('UserManagement', {
            bridgeToNestJS: true,
            handlers: {
              include: ['*Handler'],
              prefix: 'User',
            },
            performance: {
              performanceTarget: 100,
              autoOptimize: true,
            },
          }),
        ],
        controllers: [UserController],
        providers: [UserBusinessService, TestCommandHandler, TestQueryHandler, TestEventHandler],
      }).compile();

      await module.init();

      expect(module).toBeDefined();

      // Sprawdź czy VytchesDDD services są dostępne
      const explorer = module.get(`VytchesExplorerService_UserManagement`);
      expect(explorer).toBeDefined();
      expect(explorer).toBeInstanceOf(VytchesExplorerService);

      // Sprawdź context configuration
      const contextConfig = explorer.getContextConfiguration();
      expect(contextConfig).toBeDefined();
      expect(contextConfig?.context).toBe('UserManagement');
      expect(contextConfig?.bridgeToNestJS).toBe(true);

      // Sprawdź czy NestJS services działają normalnie
      const userService = module.get(UserBusinessService);
      expect(userService).toBeDefined();

      const controller = module.get(UserController);
      expect(controller).toBeDefined();

      // Test rzeczywistego wywołania
      const [serviceError, user] = await safeRun(async () =>
        userService.createUser({ name: 'John', email: 'john@test.com' })
      );

      expect(serviceError).toBeUndefined();
      expect(user).toBeDefined();
      expect(user?.name).toBe('John');
      expect(user?.email).toBe('john@test.com');
    });

    it('should handle multiple contexts without conflicts', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContexts({
            globalBridgeToNestJS: true,
            enableContexts: true,
            contexts: {
              UserManagement: {
                handlers: { prefix: 'User' },
                performance: { performanceTarget: 100 },
              },
              OrderProcessing: {
                handlers: { prefix: 'Order' },
                performance: { performanceTarget: 150 },
              },
              PaymentProcessing: {
                bridgeToNestJS: false, // Override global setting
                handlers: { prefix: 'Payment' },
              },
            },
          }),
        ],
        providers: [TestCommandHandler, TestQueryHandler, TestEventHandler],
      }).compile();

      await module.init();

      // Sprawdź izolację kontekstów
      const userExplorer = module.get(`VytchesExplorerService_UserManagement`);
      const orderExplorer = module.get(`VytchesExplorerService_OrderProcessing`);
      const paymentExplorer = module.get(`VytchesExplorerService_PaymentProcessing`);

      expect(userExplorer).toBeDefined();
      expect(orderExplorer).toBeDefined();
      expect(paymentExplorer).toBeDefined();

      // Sprawdź konfigurację kontekstów
      const userConfig = userExplorer.getContextConfiguration();
      const orderConfig = orderExplorer.getContextConfiguration();
      const paymentConfig = paymentExplorer.getContextConfiguration();

      expect(userConfig?.context).toBe('UserManagement');
      expect(orderConfig?.context).toBe('OrderProcessing');
      expect(paymentConfig?.context).toBe('PaymentProcessing');

      // Sprawdź bridgeToNestJS configuration
      expect(paymentConfig?.bridgeToNestJS).toBe(false);

      // Base explorer should also be available
      const baseExplorer = module.get(VytchesExplorerService);
      expect(baseExplorer).toBeDefined();
    });

    it('should maintain backward compatibility with existing patterns', async () => {
      // Test forRoot() kompatybilności
      const oldModule = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot()],
        providers: [TestCommandHandler],
      }).compile();

      await oldModule.init();

      const oldExplorer = oldModule.get(VytchesExplorerService);
      expect(oldExplorer).toBeInstanceOf(VytchesExplorerService);

      await oldModule.close();

      // Test forTesting() kompatybilności
      const testModule = await Test.createTestingModule({
        imports: [VytchesDDDModule.forTesting()],
        providers: [TestCommandHandler],
      }).compile();

      await testModule.init();

      const testExplorer = testModule.get(VytchesExplorerService);
      expect(testExplorer).toBeInstanceOf(VytchesExplorerService);

      const { ICommandBus, IQueryBus } = await import('@vytches/ddd-cqrs');
      const commandBus = testModule.get(ICommandBus);
      const queryBus = testModule.get(IQueryBus);

      expect(commandBus).toBeDefined();
      expect(queryBus).toBeDefined();

      await testModule.close();
    });
  });

  describe('Handler Discovery and Registration', () => {
    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('TestContext', {
            bridgeToNestJS: true,
            handlers: {
              include: ['*Handler'],
              exclude: ['*MockHandler'],
            },
          }),
        ],
        providers: [TestCommandHandler, TestQueryHandler, TestEventHandler],
      }).compile();

      await module.init();
    });

    it('should discover and register all handler types', async () => {
      const explorer = module.get(`VytchesExplorerService_TestContext`);

      // Test discovery wszystkich typów handlerów
      const commandHandlers = await explorer.discoverContextHandlers('TestContext', 'command');
      const queryHandlers = await explorer.discoverContextHandlers('TestContext', 'query');
      const eventHandlers = await explorer.discoverContextHandlers('TestContext', 'event');

      expect(Array.isArray(commandHandlers)).toBe(true);
      expect(Array.isArray(queryHandlers)).toBe(true);
      expect(Array.isArray(eventHandlers)).toBe(true);

      // Test comprehensive discovery
      const allHandlers = await explorer.discoverAllContextHandlers();
      expect(Array.isArray(allHandlers)).toBe(true);
    });

    it('should respect handler filtering rules', async () => {
      // Test z różnymi filtrami
      const moduleWithFilters = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('FilteredContext', {
            bridgeToNestJS: true,
            handlers: {
              include: ['*Command*'],
              exclude: ['*Test*'],
            },
          }),
        ],
        providers: [TestCommandHandler, TestQueryHandler],
      }).compile();

      await moduleWithFilters.init();

      const explorer = moduleWithFilters.get(`VytchesExplorerService_FilteredContext`);
      const config = explorer.getContextConfiguration();

      expect(config?.handlers?.include).toContain('*Command*');
      expect(config?.handlers?.exclude).toContain('*Test*');

      await moduleWithFilters.close();
    });

    it('should handle handler registration errors gracefully', async () => {
      const explorer = module.get(`VytchesExplorerService_TestContext`);

      // Test z nieistniejącym kontekstem
      const [noHandlersError, noHandlers] = await safeRun(async () =>
        explorer.discoverContextHandlers('NonExistentContext', 'command')
      );

      expect(noHandlersError).toBeUndefined(); // Shouldn't throw
      expect(noHandlers).toEqual([]); // Should return empty array
    });
  });

  describe('Performance Configuration Validation', () => {
    it('should apply performance settings per context', async () => {
      const performanceOptions = {
        performanceMode: 'production' as const,
        autoOptimize: true,
        performanceTarget: 75,
        contexts: ['HighPerformanceContext'],
      };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('HighPerformanceContext', {
            bridgeToNestJS: true,
            performance: performanceOptions,
            monitoring: {
              enabled: true,
              warnAt: 40,
              errorAt: 80,
            },
          }),
        ],
        providers: [TestCommandHandler],
      }).compile();

      await module.init();

      const explorer = module.get(`VytchesExplorerService_HighPerformanceContext`);
      const config = explorer.getContextConfiguration();

      expect(config?.context).toBe('HighPerformanceContext');
      expect(config?.bridgeToNestJS).toBe(true);

      // Performance config powinien być stosowany
      expect(config?.performance).toBeDefined();
    });

    it('should handle performance monitoring setup', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContext('MonitoredContext', {
            performance: {
              performanceMode: 'development',
              performanceTarget: 200,
              autoOptimize: false,
            },
            monitoring: {
              enabled: true,
              warnAt: 100,
              errorAt: 300,
            },
          }),
        ],
      }).compile();

      await module.init();

      const explorer = module.get(`VytchesExplorerService_MonitoredContext`);
      expect(explorer).toBeInstanceOf(VytchesExplorerService);

      const config = explorer.getContextConfiguration();
      expect(config?.monitoring?.enabled).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty context configurations', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContexts({
            globalBridgeToNestJS: false,
            enableContexts: true,
            contexts: {},
          }),
        ],
      }).compile();

      await module.init();
      expect(module).toBeDefined();
    });

    it('should handle malformed handler configurations', async () => {
      const [moduleError] = await safeRun(async () => {
        const testModule = await Test.createTestingModule({
          imports: [
            VytchesDDDModule.forContext('InvalidContext', {
              bridgeToNestJS: true,
              handlers: {
                include: [], // Empty include
                exclude: null as any, // Invalid exclude
              },
            }),
          ],
        }).compile();

        await testModule.init();
        return testModule;
      });

      // Nie powinno rzucić błędu - graceful handling
      expect(moduleError).toBeUndefined();
    });

    it('should validate context names and prevent conflicts', async () => {
      // Test invalid context name should throw during configuration
      const [configError] = safeRun(() => {
        return VytchesDDDModule.forContext('', { bridgeToNestJS: true });
      });

      expect(configError).toBeDefined();
      expect(configError?.message).toContain('Context name cannot be null or empty');

      // Test válid context names work properly
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forContexts({
            contexts: {
              ValidContext: { bridgeToNestJS: true },
              'Another-Valid_Context123': { bridgeToNestJS: true },
            },
          }),
        ],
      }).compile();

      await module.init();

      // Sprawdź czy válid konteksty zostały utworzone
      const validExplorer = module.get(`VytchesExplorerService_ValidContext`);
      const anotherValidExplorer = module.get(`VytchesExplorerService_Another-Valid_Context123`);

      expect(validExplorer).toBeDefined();
      expect(anotherValidExplorer).toBeDefined();
    });

    it('should handle concurrent context initialization', async () => {
      const contexts = ['Context1', 'Context2', 'Context3', 'Context4', 'Context5'];

      const modulePromises = contexts.map(context =>
        Test.createTestingModule({
          imports: [
            VytchesDDDModule.forContext(context, {
              bridgeToNestJS: true,
              performance: { performanceTarget: Math.floor(Math.random() * 100) + 50 },
            }),
          ],
        }).compile()
      );

      const [concurrentError, modules] = await safeRun(async () => Promise.all(modulePromises));

      expect(concurrentError).toBeUndefined();
      expect(modules).toHaveLength(5);

      // Initialize wszystkich modułów
      const initPromises = modules?.map(mod => mod.init()) ?? [];
      const [initError] = await safeRun(async () => Promise.all(initPromises));

      expect(initError).toBeUndefined();

      // Cleanup
      await Promise.all(modules?.map(mod => mod.close()) ?? []);
    });
  });
});
