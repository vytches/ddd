/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  IDependencyContainer,
  ServiceDescriptor,
  ServiceFactory,
  ServiceRegistrationOptions,
  ServiceToken,
} from '@vytches/ddd-di';
import { beforeEach, describe, expect, it } from 'vitest';
import { EnhancedCommandBus } from '../src/implementations/enhanced-command-bus';
import { EnhancedQueryBus } from '../src/implementations/enhanced-query-bus';
import type { ICommand, ICommandHandler, IQuery, IQueryHandler } from '../src/interfaces';

// Mock container
class MockContainer implements IDependencyContainer {
  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): void {
    throw new Error('Method not implemented.');
  }
  isRegistered<T>(token: ServiceToken<T>): boolean {
    throw new Error('Method not implemented.');
  }
  getServices(): ServiceDescriptor[] {
    throw new Error('Method not implemented.');
  }
  getServicesByTag(tag: string): ServiceDescriptor[] {
    throw new Error('Method not implemented.');
  }
  createScope?(context?: string): IDependencyContainer {
    throw new Error('Method not implemented.');
  }
  dispose?(): void {
    throw new Error('Method not implemented.');
  }
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

  registerInstance(token: string, instance: any): void {
    this.services.set(token, instance);
  }

  has(token: string | symbol): boolean {
    return this.services.has(token as string);
  }
}

// Test command
class TestCommand implements ICommand {
  constructor(public readonly data: string) {}
}

// Test command handler
class TestCommandHandler implements ICommandHandler<TestCommand, void> {
  async execute(command: TestCommand): Promise<void> {
    // Process command
    console.log('Executing command with data:', command.data);
  }
}

// Test query
class TestQuery implements IQuery<string> {
  constructor(public readonly id: string) {}
}

// Test query handler
class TestQueryHandler implements IQueryHandler<TestQuery, string> {
  async execute(query: TestQuery): Promise<string> {
    return `Result for ${query.id}`;
  }
}

describe('EnhancedCommandBus', () => {
  let commandBus: EnhancedCommandBus;
  let container: MockContainer;

  beforeEach(() => {
    container = new MockContainer();
    commandBus = new EnhancedCommandBus(container, {
      enableMetrics: true,
      enableCache: true,
      defaultTimeout: 5000,
      defaultRetries: 2,
      resilience: {
        circuitBreaker: { enabled: true },
        retry: { enabled: true },
        timeout: { enabled: true },
      },
    });
  });

  it('should have required methods', () => {
    expect(commandBus.setTimeout).toBeDefined();
    expect(commandBus.setRetries).toBeDefined();
    expect(commandBus.enableCache).toBeDefined();
    expect(commandBus.enableBatching).toBeDefined();
    expect(commandBus.execute).toBeDefined();
    expect(commandBus.executeMany).toBeDefined();
    expect(commandBus.getMetrics).toBeDefined();
    expect(commandBus.resetMetrics).toBeDefined();
  });

  it('should configure timeout', () => {
    const result = commandBus.setTimeout(10000);
    expect(result).toBe(commandBus); // Fluent interface
  });

  it('should configure retries', () => {
    const result = commandBus.setRetries(5);
    expect(result).toBe(commandBus); // Fluent interface
  });

  it('should configure cache', () => {
    const result = commandBus.enableCache(false);
    expect(result).toBe(commandBus); // Fluent interface
  });

  it('should configure batching', () => {
    const result = commandBus.enableBatching(true, { maxSize: 20, delayMs: 100 });
    expect(result).toBe(commandBus); // Fluent interface
  });

  it('should execute command with registered handler', async () => {
    const handler = new TestCommandHandler();
    commandBus.register(TestCommand, handler);

    const command = new TestCommand('test');
    await expect(commandBus.execute(command)).resolves.toBeUndefined();
  });

  it('should get metrics', () => {
    const metrics = commandBus.getMetrics();
    expect(metrics).toHaveProperty('executionCount');
    expect(metrics).toHaveProperty('averageExecutionTime');
    expect(metrics).toHaveProperty('cacheHitRate');
    expect(metrics).toHaveProperty('errors');
    expect(metrics).toHaveProperty('timeouts');
    expect(metrics).toHaveProperty('retries');
  });

  it('should reset metrics', () => {
    commandBus.resetMetrics();
    const metrics = commandBus.getMetrics();
    expect(metrics.executionCount).toBe(0);
    expect(metrics.errors).toBe(0);
  });
});

describe('EnhancedQueryBus', () => {
  let queryBus: EnhancedQueryBus;
  let container: MockContainer;

  beforeEach(() => {
    container = new MockContainer();
    queryBus = new EnhancedQueryBus(container, {
      enableMetrics: true,
      enableCache: true,
      cacheOptions: {
        ttl: 60000,
        maxSize: 100,
        strategy: 'lru',
      },
      defaultTimeout: 3000,
      defaultRetries: 1,
      resilience: {
        circuitBreaker: true,
        retry: true,
        timeout: true,
      },
    });
  });

  it('should have required methods', () => {
    expect(queryBus.setTimeout).toBeDefined();
    expect(queryBus.setRetries).toBeDefined();
    expect(queryBus.enableCache).toBeDefined();
    expect(queryBus.enableBatching).toBeDefined();
    expect(queryBus.execute).toBeDefined();
    expect(queryBus.executeMany).toBeDefined();
    expect(queryBus.invalidateCache).toBeDefined();
    expect(queryBus.getMetrics).toBeDefined();
    expect(queryBus.resetMetrics).toBeDefined();
  });

  it('should configure cache with options', () => {
    const result = queryBus.enableCache(true, { ttl: 30000, maxSize: 200 });
    expect(result).toBe(queryBus); // Fluent interface
  });

  it('should execute query with registered handler', async () => {
    const handler = new TestQueryHandler();
    queryBus.register(TestQuery, handler);

    const query = new TestQuery('test-id');
    const result = await queryBus.execute(query);
    expect(result).toBe('Result for test-id');
  });

  it('should cache query results', async () => {
    const handler = new TestQueryHandler();
    queryBus.register(TestQuery, handler);

    const query = new TestQuery('cached-id');

    // First execution
    const result1 = await queryBus.execute(query);
    expect(result1).toBe('Result for cached-id');

    // Second execution should hit cache
    const result2 = await queryBus.execute(query);
    expect(result2).toBe('Result for cached-id');

    const metrics = queryBus.getMetrics();
    expect(metrics.cacheHits).toBeGreaterThan(0);
  });

  it('should invalidate cache', async () => {
    const handler = new TestQueryHandler();
    queryBus.register(TestQuery, handler);

    const query = new TestQuery('cache-test');
    await queryBus.execute(query);

    queryBus.invalidateCache();

    const metrics = queryBus.getMetrics();
    expect(metrics.cacheSize).toBe(0);
  });

  it('should execute multiple queries', async () => {
    const handler = new TestQueryHandler();
    queryBus.register(TestQuery, handler);

    const queries = [new TestQuery('query-1'), new TestQuery('query-2'), new TestQuery('query-3')];

    const results = await queryBus.executeMany(queries);
    expect(results).toHaveLength(3);
    expect(results[0]).toBe('Result for query-1');
    expect(results[1]).toBe('Result for query-2');
    expect(results[2]).toBe('Result for query-3');
  });
});
