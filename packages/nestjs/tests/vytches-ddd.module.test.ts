import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';

// Mock the lazy-loaded modules to avoid static imports (module boundary violations)
vi.mock('@vytches/ddd-cqrs', async () => {
  const mockBus = vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    execute: vi.fn(),
  }));
  return {
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
  VytchesDDD: {
    configure: vi.fn(),
    resolve: vi.fn(),
  },
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

    it('should provide bus services through string tokens', async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forTesting()],
      }).compile();

      expect(module).toBeDefined();

      // These services are provided by forTesting() with lazy-loaded factories
      const commandBus = module.get('ICommandBus');
      expect(commandBus).toBeDefined();

      const queryBus = module.get('IQueryBus');
      expect(queryBus).toBeDefined();

      const eventBus = module.get('IEventBus');
      expect(eventBus).toBeDefined();
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
