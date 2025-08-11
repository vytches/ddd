import { describe, it, expect } from 'vitest';
import 'reflect-metadata';
import type { ICommand, ICommandHandler } from '../../src';
import { CommandHandler } from '../../src';

describe('CommandHandler decorator with type inference', () => {
  // Test command with result
  class CreateUserCommand implements ICommand {
    constructor(public readonly email: string) {}
  }

  // Result DTO
  interface UserDto {
    id: string;
    email: string;
    createdAt: Date;
  }

  describe('Type inference', () => {
    it('should infer result type from handler implementation', () => {
      // The decorator should work without explicit type parameters
      @CommandHandler(CreateUserCommand)
      class CreateUserHandler implements ICommandHandler<CreateUserCommand, UserDto> {
        async execute(command: CreateUserCommand): Promise<UserDto> {
          return {
            id: '123',
            email: command.email,
            createdAt: new Date(),
          };
        }
      }

      // Check metadata is stored correctly
      const commandMetadata = Reflect.getMetadata('di:command-handler', CreateUserCommand);
      expect(commandMetadata).toBeDefined();
      expect(commandMetadata.handlerType).toBe(CreateUserHandler);
      expect(commandMetadata.serviceId).toBe('CreateUserHandler');

      // Check handler metadata
      const handlerMetadata = Reflect.getMetadata('di:handler-metadata', CreateUserHandler);
      expect(handlerMetadata).toBeDefined();
      expect(handlerMetadata.type).toBe('command');
      expect(handlerMetadata.messageType).toBe(CreateUserCommand);
    });

    it('should work with void result type', () => {
      class DeleteUserCommand implements ICommand {
        constructor(public readonly userId: string) {}
      }

      @CommandHandler(DeleteUserCommand)
      class DeleteUserHandler implements ICommandHandler<DeleteUserCommand, void> {
        async execute(_command: DeleteUserCommand): Promise<void> {
          // Delete user logic
        }
      }

      const metadata = Reflect.getMetadata('di:command-handler', DeleteUserCommand);
      expect(metadata).toBeDefined();
      expect(metadata.handlerType).toBe(DeleteUserHandler);
    });

    it('should work with complex result types', () => {
      interface AuthenticationResultDto {
        user: UserDto;
        token: string;
        refreshToken: string;
        expiresIn: number;
      }

      class RegisterUserCommand implements ICommand {
        constructor(
          public readonly email: string,
          public readonly password: string
        ) {}
      }

      // No type duplication needed - result type inferred from handler
      @CommandHandler(RegisterUserCommand)
      class RegisterUserHandler
        implements ICommandHandler<RegisterUserCommand, AuthenticationResultDto>
      {
        async execute(command: RegisterUserCommand): Promise<AuthenticationResultDto> {
          return {
            user: {
              id: '123',
              email: command.email,
              createdAt: new Date(),
            },
            token: 'jwt-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
          };
        }
      }

      const metadata = Reflect.getMetadata('di:command-handler', RegisterUserCommand);
      expect(metadata).toBeDefined();
      expect(metadata.handlerType).toBe(RegisterUserHandler);
    });

    it('should support custom options', () => {
      @CommandHandler(CreateUserCommand, {
        serviceId: 'customCreateUserHandler',
        timeout: 5000,
        context: 'user-management',
      })
      class _CustomCreateUserHandler implements ICommandHandler<CreateUserCommand, UserDto> {
        async execute(command: CreateUserCommand): Promise<UserDto> {
          return {
            id: '456',
            email: command.email,
            createdAt: new Date(),
          };
        }
      }

      const metadata = Reflect.getMetadata('di:command-handler', CreateUserCommand);
      expect(metadata).toBeDefined();
      expect(metadata.serviceId).toBe('customCreateUserHandler');
      expect(metadata.options.timeout).toBe(5000);
      expect(metadata.options.context).toBe('user-management');
    });
  });

  describe('Functionality preservation', () => {
    it('should not modify the handler class', async () => {
      @CommandHandler(CreateUserCommand)
      class TestHandler implements ICommandHandler<CreateUserCommand, UserDto> {
        public testProperty = 'test';

        async execute(command: CreateUserCommand): Promise<UserDto> {
          return {
            id: 'test',
            email: command.email,
            createdAt: new Date(),
          };
        }

        public testMethod(): string {
          return 'test method';
        }
      }

      const instance = new TestHandler();
      expect(instance.testProperty).toBe('test');
      expect(instance.testMethod()).toBe('test method');
      expect(typeof instance.execute).toBe('function');

      // Should be able to execute the handler
      const result = await instance.execute(new CreateUserCommand('test@test.com'));
      expect(result.email).toBe('test@test.com');
    });
  });

  describe('Type safety', () => {
    it('should maintain type safety with handler implementation', async () => {
      interface OrderDto {
        orderId: string;
        status: 'pending' | 'completed';
        total: number;
      }

      class CreateOrderCommand implements ICommand {
        constructor(
          public readonly items: string[],
          public readonly total: number
        ) {}
      }

      @CommandHandler(CreateOrderCommand)
      class CreateOrderHandler implements ICommandHandler<CreateOrderCommand, OrderDto> {
        async execute(command: CreateOrderCommand): Promise<OrderDto> {
          return {
            orderId: 'order-123',
            status: 'pending',
            total: command.total,
          };
        }
      }

      const handler = new CreateOrderHandler();
      const result = await handler.execute(new CreateOrderCommand(['item1'], 100));

      // TypeScript should know the exact type of result
      expect(result.orderId).toBe('order-123');
      expect(result.status).toBe('pending');
      expect(result.total).toBe(100);
    });
  });
});
