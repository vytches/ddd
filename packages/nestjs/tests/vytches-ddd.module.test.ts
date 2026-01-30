import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';
import { VytchesDDDModule } from '../src/vytches-ddd.module';

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

// Mock the lazy-loaded modules to avoid static imports (module boundary violations)
vi.mock('@vytches/ddd-cqrs', () => {
  const mockBus = vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    registerFactory: vi.fn(),
    execute: vi.fn(),
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
    publish: vi.fn(),
    subscribe: vi.fn(),
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

describe('VytchesDDDModule', () => {
  let module: TestingModule;

  afterEach(async () => {
    if (module) {
      await module.close();
    }
    vi.clearAllMocks();
  });

  describe('forRoot', () => {
    it('should create module with default options', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot()],
      }).compile();

      expect(module).toBeDefined();

      // Should provide VytchesExplorerService
      const explorer = module.get(VytchesExplorerService);
      expect(explorer).toBeDefined();
      expect(explorer).toBeInstanceOf(VytchesExplorerService);
    });

    it('should create module with custom providers', async () => {
      const customProvider = {
        provide: 'CustomService',
        useValue: { test: 'value' },
      };

      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [customProvider],
          }),
        ],
      }).compile();

      expect(module).toBeDefined();

      const customService = module.get('CustomService');
      expect(customService).toEqual({ test: 'value' });
    });
  });

  describe('forTesting', () => {
    it('should create module with testing configuration', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forTesting()],
      }).compile();

      expect(module).toBeDefined();

      // Should provide VytchesExplorerService
      const explorer = module.get(VytchesExplorerService);
      expect(explorer).toBeDefined();
      expect(explorer).toBeInstanceOf(VytchesExplorerService);
    });

    it('should provide bus services through class tokens', async () => {
      const { ICommandBus, IQueryBus } = await import('@vytches/ddd-cqrs');

      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forTesting()],
      }).compile();

      expect(module).toBeDefined();

      // These services are provided by forTesting() with class tokens
      const commandBus = module.get(ICommandBus);
      expect(commandBus).toBeDefined();

      const queryBus = module.get(IQueryBus);
      expect(queryBus).toBeDefined();
    });

    it('should initialize buses with lazy loading', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forTesting()],
      }).compile();

      await module.init();

      expect(module).toBeDefined();
    });
  });
});
