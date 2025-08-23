import type { IDependencyContainer } from '@vytches/ddd-di';
import { beforeEach, describe, expect, it } from 'vitest';
import { EnhancedCommandBus } from '../src/implementations/enhanced-command-bus';
import { EnhancedQueryBus } from '../src/implementations/enhanced-query-bus';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../src/interfaces';

// Mock container
class MockContainer implements IDependencyContainer {
  private services = new Map<string, any>();

  resolve<T>(token: string | symbol): T {
    const service = this.services.get(token as string);
    if (!service) {
      throw new Error(`Service ${String(token)} not found`);
    }
    return service as T;
  }

  register(token: string, service: any): void {
    this.services.set(token, service);
  }

  registerFactory<T>(token: string, factory: any): void {
    this.services.set(token, factory);
  }

  registerInstance(token: string, instance: any): void {
    this.services.set(token, instance);
  }

  isRegistered<T>(token: string | symbol): boolean {
    return this.services.has(token as string);
  }

  getServices(): any[] {
    return Array.from(this.services.values());
  }

  getServicesByTag(tag: string): any[] {
    return [];
  }

  has(token: string | symbol): boolean {
    return this.services.has(token as string);
  }
}

// Test command and query
class TestCommand implements ICommand {
  constructor(public readonly data: string) {}
}

class TestQuery implements IQuery<string> {
  constructor(public readonly id: string) {}
}

class TestCommandHandler implements ICommandHandler<TestCommand, void> {
  async execute(_command: TestCommand): Promise<void> {
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

class TestQueryHandler implements IQueryHandler<TestQuery, string> {
  async execute(query: TestQuery): Promise<string> {
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 10));
    return `Result for ${query.id}`;
  }
}

describe('Enhanced Bus Configuration Methods', () => {
  let container: MockContainer;

  beforeEach(() => {
    container = new MockContainer();
  });

  describe('EnhancedCommandBus Configuration', () => {
    let commandBus: EnhancedCommandBus;

    beforeEach(() => {
      commandBus = new EnhancedCommandBus(container, {
        enableMetrics: true,
        enableCache: false,
        resilience: {
          timeout: { enabled: true, timeoutMs: 5000 },
          retry: { enabled: true, maxAttempts: 2 },
        },
      });
    });

    it('should allow timeout configuration via setTimeout method', () => {
      const result = commandBus.setTimeout(10000);

      // Should return the same instance for fluent interface
      expect(result).toBe(commandBus);

      // Internal timeout should be updated (we can't test this directly due to private fields,
      // but we can test that the method exists and returns the correct instance)
    });

    it('should allow retries configuration via setRetries method', () => {
      const result = commandBus.setRetries(5);

      // Should return the same instance for fluent interface
      expect(result).toBe(commandBus);
    });

    it('should allow cache configuration via enableCache method', () => {
      const result = commandBus.enableCache(true);

      // Should return the same instance for fluent interface
      expect(result).toBe(commandBus);
    });

    it('should allow batching configuration via enableBatching method', () => {
      const result = commandBus.enableBatching(true, { maxSize: 20, delayMs: 100 });

      // Should return the same instance for fluent interface
      expect(result).toBe(commandBus);
    });

    it('should work with fluent interface chaining', () => {
      const result = commandBus
        .setTimeout(8000)
        .setRetries(3)
        .enableCache(false)
        .enableBatching(true, { maxSize: 15 });

      // Should return the same instance after chaining
      expect(result).toBe(commandBus);
    });
  });

  describe('EnhancedQueryBus Configuration', () => {
    let queryBus: EnhancedQueryBus;

    beforeEach(() => {
      queryBus = new EnhancedQueryBus(container, {
        enableMetrics: true,
        enableCache: true,
        cacheOptions: { ttl: 60000, maxSize: 100 },
        resilience: {
          timeout: true,
          retry: true,
        },
      });
    });

    it('should allow timeout configuration via setTimeout method', () => {
      const result = queryBus.setTimeout(15000);

      // Should return the same instance for fluent interface
      expect(result).toBe(queryBus);
    });

    it('should allow retries configuration via setRetries method', () => {
      const result = queryBus.setRetries(4);

      // Should return the same instance for fluent interface
      expect(result).toBe(queryBus);
    });

    it('should allow cache configuration via enableCache method', () => {
      const result = queryBus.enableCache(true, { ttl: 30000, maxSize: 200 });

      // Should return the same instance for fluent interface
      expect(result).toBe(queryBus);
    });

    it('should allow batching configuration via enableBatching method', () => {
      const result = queryBus.enableBatching(true, { maxSize: 25, delayMs: 50 });

      // Should return the same instance for fluent interface
      expect(result).toBe(queryBus);
    });

    it('should work with fluent interface chaining', () => {
      const result = queryBus
        .setTimeout(12000)
        .setRetries(2)
        .enableCache(true, { ttl: 45000 })
        .enableBatching(false);

      // Should return the same instance after chaining
      expect(result).toBe(queryBus);
    });

    it('should allow cache invalidation', () => {
      queryBus.invalidateCache();

      // Method should exist and not throw
      expect(true).toBe(true);
    });
  });

  describe('Runtime Configuration Changes', () => {
    it('should allow runtime timeout changes on CommandBus', async () => {
      const commandBus = new EnhancedCommandBus(container, {
        resilience: { timeout: { enabled: true, timeoutMs: 5000 } },
      });

      commandBus.register(TestCommand, new TestCommandHandler());

      // Change timeout at runtime
      commandBus.setTimeout(1000); // Very short timeout for testing

      // This should work (execution should be allowed)
      const command = new TestCommand('test');
      await expect(commandBus.execute(command)).resolves.toBeUndefined();
    });

    it('should allow runtime retry changes on QueryBus', async () => {
      const queryBus = new EnhancedQueryBus(container, {
        resilience: { retry: true },
      });

      queryBus.register(TestQuery, new TestQueryHandler());

      // Change retries at runtime
      queryBus.setRetries(1);

      // This should work
      const query = new TestQuery('test');
      await expect(queryBus.execute(query)).resolves.toBe('Result for test');
    });
  });
});
