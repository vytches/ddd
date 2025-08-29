import { Inject, Injectable, Module } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { VYTCHES_DDD_OPTIONS } from '../src/constants';
import { VytchesDiscoveryService } from '../src/discovery/vytches-discovery.service';
import { VytchesDDDModule } from '../src/vytches-ddd.module';

// Define abstract bus interfaces
abstract class ICommandBus {
  abstract execute(command: any): Promise<any>;
  abstract register(commandType: any, handler: any): void;
}

abstract class IQueryBus {
  abstract execute(query: any): Promise<any>;
  abstract register(queryType: any, handler: any): void;
}

abstract class IEventBus {
  abstract publish(event: any): Promise<void>;
}

// Mock implementations
class MockCommandBus extends ICommandBus {
  private handlers = new Map();

  async execute(command: any): Promise<any> {
    const handler = this.handlers.get(command.constructor);
    if (handler) {
      return handler.handle(command);
    }
    return { success: true, command };
  }

  register(commandType: any, handler: any): void {
    this.handlers.set(commandType, handler);
  }
}

class MockQueryBus extends IQueryBus {
  private handlers = new Map();

  async execute(query: any): Promise<any> {
    const handler = this.handlers.get(query.constructor);
    if (handler) {
      return handler.handle(query);
    }
    return { success: true, query };
  }

  register(queryType: any, handler: any): void {
    this.handlers.set(queryType, handler);
  }
}

class MockEventBus extends IEventBus {
  async publish(event: any): Promise<void> {
    console.log('Event published:', event);
  }
}

// Commands and Queries
class CreateUserCommand {
  constructor(public readonly name: string) {}
}

class GetUserQuery {
  constructor(public readonly id: string) {}
}

// Handlers
@Injectable()
class CreateUserHandler {
  async handle(command: CreateUserCommand) {
    return { id: '123', name: command.name };
  }
}

@Injectable()
class GetUserHandler {
  async handle(query: GetUserQuery) {
    return { id: query.id, name: 'John Doe' };
  }
}

// Service using abstract tokens
@Injectable()
class UserService {
  constructor(
    @Inject(ICommandBus) private commandBus: ICommandBus,
    @Inject(IQueryBus) private queryBus: IQueryBus,
    @Inject(IEventBus) private eventBus: IEventBus
  ) {}

  async createUser(name: string) {
    return this.commandBus.execute(new CreateUserCommand(name));
  }

  async getUser(id: string) {
    return this.queryBus.execute(new GetUserQuery(id));
  }

  async publishUserCreatedEvent(userId: string) {
    await this.eventBus.publish({ type: 'USER_CREATED', userId });
  }
}

describe('VytchesDDDModule Integration', () => {
  let module: TestingModule;
  let userService: UserService;

  beforeEach(async () => {
    @Module({
      imports: [
        VytchesDDDModule.register({
          providers: [
            { provide: ICommandBus, useClass: MockCommandBus },
            { provide: IQueryBus, useClass: MockQueryBus },
            { provide: IEventBus, useClass: MockEventBus },
          ],
          autoRegisterHandlers: false, // Disable for this test
          isGlobal: true,
        }),
      ],
      providers: [UserService, CreateUserHandler, GetUserHandler],
    })
    class TestModule {}

    module = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  describe('Module Setup', () => {
    it('should create the module successfully', () => {
      expect(module).toBeDefined();
    });

    it('should provide VytchesDiscoveryService', () => {
      const discoveryService = module.get(VytchesDiscoveryService);
      expect(discoveryService).toBeDefined();
    });

    it('should provide configuration options', () => {
      const options = module.get(VYTCHES_DDD_OPTIONS);
      expect(options).toBeDefined();
      expect(options.autoRegisterHandlers).toBe(false);
      expect(options.isGlobal).toBe(true);
    });
  });

  describe('Dependency Injection', () => {
    it('should inject buses using abstract tokens', () => {
      expect(userService).toBeDefined();
    });

    it('should resolve command bus correctly', async () => {
      const commandBus = module.get(ICommandBus);
      expect(commandBus).toBeDefined();
      expect(commandBus).toBeInstanceOf(MockCommandBus);
    });

    it('should resolve query bus correctly', async () => {
      const queryBus = module.get(IQueryBus);
      expect(queryBus).toBeDefined();
      expect(queryBus).toBeInstanceOf(MockQueryBus);
    });

    it('should resolve event bus correctly', async () => {
      const eventBus = module.get(IEventBus);
      expect(eventBus).toBeDefined();
      expect(eventBus).toBeInstanceOf(MockEventBus);
    });
  });

  describe('Service Operations', () => {
    it('should execute commands through injected command bus', async () => {
      const result = await userService.createUser('Alice');
      expect(result).toBeDefined();
      expect(result.command).toBeDefined();
      expect(result.command.name).toBe('Alice');
    });

    it('should execute queries through injected query bus', async () => {
      const result = await userService.getUser('user-123');
      expect(result).toBeDefined();
      expect(result.query).toBeDefined();
      expect(result.query.id).toBe('user-123');
    });

    it('should publish events through injected event bus', async () => {
      await expect(userService.publishUserCreatedEvent('user-456')).resolves.not.toThrow();
    });
  });

  describe('Handler Registration', () => {
    it('should support manual handler registration', async () => {
      const commandBus = module.get<MockCommandBus>(ICommandBus);
      const createUserHandler = module.get(CreateUserHandler);

      // Manually register handler
      commandBus.register(CreateUserCommand, createUserHandler);

      // Execute command directly on bus
      const result = await commandBus.execute(new CreateUserCommand('Bob'));
      expect(result).toEqual({ id: '123', name: 'Bob' });
    });

    it('should support manual query handler registration', async () => {
      const queryBus = module.get<MockQueryBus>(IQueryBus);
      const getUserHandler = module.get(GetUserHandler);

      // Manually register handler
      queryBus.register(GetUserQuery, getUserHandler);

      // Execute query directly on bus
      const result = await queryBus.execute(new GetUserQuery('user-789'));
      expect(result).toEqual({ id: 'user-789', name: 'John Doe' });
    });
  });
});

describe('VytchesDDDModule with Auto-Registration', () => {
  let module: TestingModule;

  beforeEach(async () => {
    @Module({
      imports: [
        VytchesDDDModule.register({
          providers: [
            { provide: ICommandBus, useClass: MockCommandBus },
            { provide: IQueryBus, useClass: MockQueryBus },
            { provide: IEventBus, useClass: MockEventBus },
          ],
          autoRegisterHandlers: true, // Enable auto-registration
          isGlobal: true,
        }),
      ],
      providers: [CreateUserHandler, GetUserHandler],
    })
    class TestModule {}

    module = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    // Initialize module to trigger auto-registration
    await module.init();
  });

  it('should have auto-registration enabled in configuration', () => {
    const options = module.get(VYTCHES_DDD_OPTIONS);
    expect(options.autoRegisterHandlers).toBe(true);
  });
});
