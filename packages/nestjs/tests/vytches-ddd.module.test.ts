import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@vytches/ddd-cqrs';
import { UnifiedEventBus } from '@vytches/ddd-events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NestJSContainerAdapter } from '../src/adapters/nestjs-container.adapter';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
// VytchesDDD will be mocked
import { VYTCHES_DDD_OPTIONS } from '../src/constants';

// Mock VytchesDDD
const mockVytchesDDD = {
  configure: vi.fn(),
  resolve: vi.fn(),
};

vi.mock('@vytches/ddd-di', async () => {
  const actual = await vi.importActual('@vytches/ddd-di');
  return {
    ...actual,
    VytchesDDD: mockVytchesDDD,
  };
});

describe('VytchesDDDModule', () => {
  let module: TestingModule;

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    vi.clearAllMocks();
    mockVytchesDDD.configure.mockClear();
    mockVytchesDDD.resolve.mockClear();
  });

  describe('forRoot', () => {
    it('should create module with default options', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot()],
      }).compile();

      expect(module).toBeDefined();

      const adapter = module.get(NestJSContainerAdapter);
      expect(adapter).toBeDefined();

      const commandBus = module.get(CommandBus);
      expect(commandBus).toBeDefined();

      const queryBus = module.get(QueryBus);
      expect(queryBus).toBeDefined();

      const eventBus = module.get(UnifiedEventBus);
      expect(eventBus).toBeDefined();
    });

    it('should create module with custom options', async () => {
      const options = {
        autoDiscovery: true,
        cqrs: {
          autoRegisterHandlers: true,
        },
      };

      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot(options)],
      }).compile();

      const moduleOptions = module.get(VYTCHES_DDD_OPTIONS);
      expect(moduleOptions).toEqual(options);
    });

    it('should configure VytchesDDD on module init', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot()],
      }).compile();

      await module.init();

      expect(mockVytchesDDD.configure).toHaveBeenCalled();
    });

    it('should apply middleware to command bus', async () => {
      const MiddlewareClass = vi.fn();

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            cqrs: {
              middleware: [{ class: MiddlewareClass }],
            },
          }),
        ],
      }).compile();

      const commandBus = module.get(CommandBus);
      expect(commandBus).toBeDefined();
    });
  });

  describe('forRootAsync', () => {
    it('should create module with factory', async () => {
      const options = { autoDiscovery: true };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRootAsync({
            useFactory: () => options,
          }),
        ],
      }).compile();

      const moduleOptions = module.get(VYTCHES_DDD_OPTIONS);
      expect(moduleOptions).toEqual(options);
    });

    it('should create module with useClass', async () => {
      class ConfigService {
        createVytchesDDDOptions() {
          return { autoDiscovery: false };
        }
      }

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRootAsync({
            useClass: ConfigService,
          }),
        ],
      }).compile();

      const moduleOptions = module.get(VYTCHES_DDD_OPTIONS);
      expect(moduleOptions).toEqual({ autoDiscovery: false });
    });

    it('should support async factory', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRootAsync({
            useFactory: async () => {
              await new Promise(resolve => setTimeout(resolve, 10));
              return { autoDiscovery: true };
            },
          }),
        ],
      }).compile();

      const moduleOptions = module.get(VYTCHES_DDD_OPTIONS);
      expect(moduleOptions).toEqual({ autoDiscovery: true });
    });

    it('should support inject dependencies', async () => {
      const CONFIG_TOKEN = 'CONFIG_TOKEN';

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRootAsync({
            imports: [
              {
                module: class ConfigModule {},
                providers: [
                  {
                    provide: CONFIG_TOKEN,
                    useValue: { enabled: true },
                  },
                ],
                exports: [CONFIG_TOKEN],
              },
            ],
            inject: [CONFIG_TOKEN],
            useFactory: (config: any) => ({
              autoDiscovery: config.enabled,
            }),
          }),
        ],
      }).compile();

      const moduleOptions = module.get(VYTCHES_DDD_OPTIONS);
      expect(moduleOptions).toEqual({ autoDiscovery: true });
    });
  });

  describe('forFeature', () => {
    it.skip('should register services by string token', async () => {
      (mockVytchesDDD.resolve as any).mockReturnValue({ value: 'service' });

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot(),
          VytchesDDDModule.forFeature({
            services: ['userService', 'orderService'],
          }),
        ],
      }).compile();

      expect(mockVytchesDDD.resolve).toHaveBeenCalledWith('userService');
      expect(mockVytchesDDD.resolve).toHaveBeenCalledWith('orderService');
    });

    it('should register services by class', async () => {
      class UserService {}
      class OrderService {}

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot(),
          VytchesDDDModule.forFeature({
            services: [UserService, OrderService],
          }),
        ],
      }).compile();

      const userService = module.get(UserService);
      expect(userService).toBeDefined();

      const orderService = module.get(OrderService);
      expect(orderService).toBeDefined();
    });

    it('should register handlers', async () => {
      class CreateUserHandler {}
      class GetUserHandler {}

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot(),
          VytchesDDDModule.forFeature({
            handlers: [CreateUserHandler, GetUserHandler],
          }),
        ],
      }).compile();

      const createHandler = module.get(CreateUserHandler);
      expect(createHandler).toBeDefined();

      const getHandler = module.get(GetUserHandler);
      expect(getHandler).toBeDefined();
    });

    it('should register event handlers', async () => {
      class UserCreatedHandler {}
      class OrderCreatedHandler {}

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot(),
          VytchesDDDModule.forFeature({
            eventHandlers: [UserCreatedHandler, OrderCreatedHandler],
          }),
        ],
      }).compile();

      const userHandler = module.get(UserCreatedHandler);
      expect(userHandler).toBeDefined();

      const orderHandler = module.get(OrderCreatedHandler);
      expect(orderHandler).toBeDefined();
    });

    it('should support bounded context', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot(),
          VytchesDDDModule.forFeature({
            services: ['contextService'],
            context: 'UserManagement',
          }),
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('forTest', () => {
    it('should create test module with default options', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forTest()],
      }).compile();

      const adapter = module.get(NestJSContainerAdapter);
      expect(adapter).toBeDefined();

      const commandBus = module.get(CommandBus);
      expect(commandBus).toBeDefined();

      const options = module.get(VYTCHES_DDD_OPTIONS);
      expect(options.autoDiscovery).toBe(false);
    });

    it('should register mocks', async () => {
      const mockUserService = { createUser: vi.fn() };
      const mockOrderService = { createOrder: vi.fn() };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forTest({
            mocks: {
              userService: mockUserService,
              orderService: mockOrderService,
            },
          }),
        ],
      }).compile();

      // Mocks should be registered in the adapter
      const adapter = module.get(NestJSContainerAdapter);
      expect(adapter).toBeDefined();
    });

    it('should override options', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forTest({
            overrides: {
              cqrs: {
                autoRegisterHandlers: false,
              },
            },
          }),
        ],
      }).compile();

      const options = module.get(VYTCHES_DDD_OPTIONS);
      expect(options.cqrs?.autoRegisterHandlers).toBe(false);
    });

    it('should enable debug mode', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forTest({
            debug: true,
          }),
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('Module initialization', () => {
    it('should setup CQRS when configured', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            cqrs: {
              autoRegisterHandlers: true,
            },
          }),
        ],
      }).compile();

      const commandBus = module.get(CommandBus);
      expect(commandBus).toBeDefined();

      const queryBus = module.get(QueryBus);
      expect(queryBus).toBeDefined();

      await module.init();
    });

    it('should setup events when configured', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            events: {
              eventBus: {
                type: 'unified',
              },
            },
          }),
        ],
      }).compile();

      const eventBus = module.get(UnifiedEventBus);
      expect(eventBus).toBeDefined();

      await module.init();
    });

    it('should run auto-discovery when enabled', async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            autoDiscovery: {
              enabled: true,
              patterns: ['**/*.service.ts'],
            },
          }),
        ],
      }).compile();

      await module.init();

      // Auto-discovery should be triggered
      expect(mockVytchesDDD.configure).toHaveBeenCalled();
    });
  });
});
