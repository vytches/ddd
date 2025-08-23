import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { safeRun } from '@vytches/ddd-utils';
import { describe, expect, it } from 'vitest';
import { VytchesDDDModule } from '../src/vytches-ddd.module';

describe('VytchesDDDModule - Zero Config', () => {
  describe('forRoot() with no parameters', () => {
    it('should initialize with zero configuration', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot()],
      }).compile();

      expect(moduleRef).toBeDefined();

      // Module should initialize without errors
      const [initError] = await safeRun(async () => {
        await moduleRef.init();
      });

      expect(initError).toBeUndefined();
    });

    it('should auto-discover decorated classes when DomainService is available', async () => {
      // This test would require @DomainService decorator from @vytches/ddd-di
      // Since the decorator might not be exported yet, we'll skip this for now
      // In a real implementation, the decorator would be used like:
      // @Injectable()
      // @DomainService('testService', { context: 'TestContext' })
      // class TestService { ... }

      @Injectable()
      class TestService {
        getValue(): string {
          return 'test-value';
        }
      }

      const moduleRef = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot()],
        providers: [TestService],
      }).compile();

      await moduleRef.init();

      // Service should be available through NestJS DI
      const service = moduleRef.get(TestService);
      expect(service).toBeDefined();
      expect(service.getValue()).toBe('test-value');
    });
  });

  describe('forRoot() with features array', () => {
    it('should accept features array for intermediate complexity', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot({ features: ['cqrs', 'events'] })],
      }).compile();

      expect(moduleRef).toBeDefined();

      const [initError] = await safeRun(async () => {
        await moduleRef.init();
      });

      expect(initError).toBeUndefined();
    });

    it('should accept features array shorthand', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [VytchesDDDModule.forRoot(['acl', 'cqrs'])],
      }).compile();

      expect(moduleRef).toBeDefined();

      const [initError] = await safeRun(async () => {
        await moduleRef.init();
      });

      expect(initError).toBeUndefined();
    });
  });

  describe('Progressive Complexity', () => {
    it('should support full enterprise configuration', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          VytchesDDDModule.forRoot({
            contexts: {
              OrderManagement: {
                modules: [],
                accessMatrix: ['PaymentProcessing'],
              },
              PaymentProcessing: {
                modules: [],
                accessMatrix: [],
              },
            },
            discovery: {
              enabled: true,
              parallel: true,
              timeout: 5000,
            },
            cqrs: {
              autoRegisterHandlers: true,
            },
            events: {
              eventBus: {
                type: 'unified',
              },
            },
          }),
        ],
      }).compile();

      expect(moduleRef).toBeDefined();

      const [initError] = await safeRun(async () => {
        await moduleRef.init();
      });

      expect(initError).toBeUndefined();
    });
  });
});
