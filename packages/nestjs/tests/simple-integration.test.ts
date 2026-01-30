import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import type { IEventBus } from '@vytches/ddd-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';
import { VytchesDDDModule } from '../src/vytches-ddd.module';

// Create mock abstract classes for DI token compatibility using vi.hoisted()
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

describe('VytchesDDDModule Integration', () => {
  let module: TestingModule;

  describe('forTesting()', () => {
    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forTesting()],
      }).compile();
    });

    it('should create module successfully', () => {
      expect(module).toBeDefined();
    });

    it('should provide VytchesExplorerService', () => {
      const explorer = module.get<VytchesExplorerService>(VytchesExplorerService);
      expect(explorer).toBeDefined();
      expect(explorer).toBeInstanceOf(VytchesExplorerService);
    });

    it('should provide buses through class tokens', async () => {
      const { ICommandBus, IQueryBus } = await import('@vytches/ddd-cqrs');

      const commandBus = module.get(ICommandBus);
      const queryBus = module.get(IQueryBus);

      expect(commandBus).toBeDefined();
      expect(queryBus).toBeDefined();
    });
  });

  describe('forRoot() with custom providers', () => {
    class CustomEventBus {
      async publish() {
        return Promise.resolve();
      }
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      async subscribe() {}
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      async registerHandler() {}
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      async unsubscribe() {}
      async publishMany() {
        return Promise.resolve();
      }
    }

    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            providers: [
              {
                provide: 'IEventBus',
                useClass: CustomEventBus,
              },
            ],
          }),
        ],
      }).compile();
    });

    it('should use custom event bus implementation', () => {
      const eventBus = module.get<IEventBus>('IEventBus');
      expect(eventBus).toBeInstanceOf(CustomEventBus);
    });

    it('should export custom providers', () => {
      expect(() => module.get<IEventBus>('IEventBus')).not.toThrow();
    });
  });

  describe('forRoot() without providers', () => {
    beforeEach(async () => {
      module = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot()],
      }).compile();
    });

    it('should create module without providers', () => {
      expect(module).toBeDefined();
    });

    it('should provide explorer service', () => {
      const explorer = module.get<VytchesExplorerService>(VytchesExplorerService);
      expect(explorer).toBeDefined();
    });
  });
});
