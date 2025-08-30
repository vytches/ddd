import { Inject, Injectable, Module } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { VYTCHES_DDD_OPTIONS } from '../src/constants';
import { VytchesDDDModule } from '../src/vytches-ddd.module';

// Mock bus implementations
class MockCommandBus {
  execute(command: any) {
    return { success: true, command };
  }
  register(_commandType: any, _handler: any) {
    // Mock registration
  }
}

class MockQueryBus {
  execute(query: any) {
    return { success: true, query };
  }
  register(_queryType: any, _handler: any) {
    // Mock registration
  }
}

class MockEventBus {
  publish(event: any) {
    return { success: true, event };
  }
}

// Abstract tokens
abstract class ICommandBus {
  abstract execute(command: any): any;
}

abstract class IQueryBus {
  abstract execute(query: any): any;
}

abstract class IEventBus {
  abstract publish(event: any): any;
}

// Test service using abstract tokens
@Injectable()
class TestService {
  constructor(
    @Inject(ICommandBus) private commandBus: ICommandBus,
    @Inject(IQueryBus) private queryBus: IQueryBus,
    @Inject(IEventBus) private eventBus: IEventBus
  ) {}

  async executeCommand(command: any) {
    return this.commandBus.execute(command);
  }

  async executeQuery(query: any) {
    return this.queryBus.execute(query);
  }

  async publishEvent(event: any) {
    return this.eventBus.publish(event);
  }
}

describe('VytchesDDDModule.register()', () => {
  let module: TestingModule;
  let testService: TestService;

  beforeEach(async () => {
    @Module({
      imports: [
        VytchesDDDModule.register({
          providers: [
            { provide: ICommandBus, useClass: MockCommandBus },
            { provide: IQueryBus, useClass: MockQueryBus },
            { provide: IEventBus, useClass: MockEventBus },
          ],
          autoRegisterHandlers: true,
          isGlobal: true,
        }),
      ],
      providers: [TestService],
    })
    class TestModule {}

    module = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    testService = module.get<TestService>(TestService);
  });

  it('should create module with register method', () => {
    expect(module).toBeDefined();
  });

  it('should inject buses using abstract tokens', () => {
    expect(testService).toBeDefined();
  });

  it('should execute commands through injected command bus', async () => {
    const command = { type: 'CREATE_USER', data: { name: 'John' } };
    const result = await testService.executeCommand(command);

    expect(result).toEqual({
      success: true,
      command,
    });
  });

  it('should execute queries through injected query bus', async () => {
    const query = { type: 'GET_USER', id: '123' };
    const result = await testService.executeQuery(query);

    expect(result).toEqual({
      success: true,
      query,
    });
  });

  it('should publish events through injected event bus', async () => {
    const event = { type: 'USER_CREATED', userId: '123' };
    const result = await testService.publishEvent(event);

    expect(result).toEqual({
      success: true,
      event,
    });
  });
});

describe('VytchesDDDModule configuration options', () => {
  it('should accept configuration with auto-registration flags', async () => {
    const moduleConfig = VytchesDDDModule.register({
      providers: [{ provide: ICommandBus, useClass: MockCommandBus }],
      autoRegisterHandlers: true,
      autoRegisterProcessManagers: true,
      autoRegisterSagas: true,
      autoRegisterProjections: false,
      isGlobal: true,
    });

    expect(moduleConfig).toBeDefined();
    expect(moduleConfig.module).toBe(VytchesDDDModule);
    expect(moduleConfig.providers).toBeDefined();
    expect(moduleConfig.exports).toBeDefined();
    expect(moduleConfig.global).toBe(true);
  });

  it('should default auto-registration flags to true', async () => {
    const moduleConfig = VytchesDDDModule.register({
      providers: [{ provide: ICommandBus, useClass: MockCommandBus }],
    });

    // Check that configuration is created with defaults
    const configProvider = moduleConfig.providers?.find(
      (p: any) => p.provide === VYTCHES_DDD_OPTIONS
    ) as any;

    expect(configProvider).toBeDefined();
    expect(configProvider?.useValue?.autoRegisterHandlers).toBe(true);
    expect(configProvider?.useValue?.autoRegisterProcessManagers).toBe(true);
    expect(configProvider?.useValue?.autoRegisterSagas).toBe(true);
    expect(configProvider?.useValue?.autoRegisterProjections).toBe(false);
  });

  it('should export all provided tokens', () => {
    const moduleConfig = VytchesDDDModule.register({
      providers: [
        { provide: ICommandBus, useClass: MockCommandBus },
        { provide: IQueryBus, useClass: MockQueryBus },
        { provide: 'CUSTOM_TOKEN', useValue: 'custom' },
      ],
      isGlobal: true,
    });

    expect(moduleConfig.exports).toContain(ICommandBus);
    expect(moduleConfig.exports).toContain(IQueryBus);
    expect(moduleConfig.exports).toContain('CUSTOM_TOKEN');
  });
});
