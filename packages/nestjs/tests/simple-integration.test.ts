import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { IEventBus } from '@vytches/ddd-contracts';
import type { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { beforeEach, describe, expect, it } from 'vitest';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';
import { VytchesDDDModule } from '../src/vytches-ddd.module';

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

    it('should provide buses through string tokens', async () => {
      const commandBus = module.get<ICommandBus>('ICommandBus');
      const queryBus = module.get<IQueryBus>('IQueryBus');
      const eventBus = module.get<IEventBus>('IEventBus');

      expect(commandBus).toBeDefined();
      expect(queryBus).toBeDefined();
      expect(eventBus).toBeDefined();
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
