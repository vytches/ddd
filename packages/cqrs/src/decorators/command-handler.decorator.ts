/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import type { ICommand, ICommandHandler } from '../interfaces';
import type { CommandHandlerOptions, DIHandlerMetadata } from './di-types';

/**
 * @description
 * CommandHandler decorator that automatically infers types from the handler class implementation.
 * When type parameters are not provided, it will infer them from the handler's ICommandHandler interface.
 *
 * @param {new (...args: unknown[]} commandType - commandType parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage with explicit types (when handler returns void)
 * @CommandHandler(CreateUserCommand)
 * class CreateUserHandler implements ICommandHandler<CreateUserCommand, void> {
 *   async execute(command: CreateUserCommand): Promise<void> {
 *     // implementation
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Auto-inferred types (when handler returns a value)
 * @CommandHandler(RegisterUserCommand)
 * class RegisterUserHandler implements ICommandHandler<RegisterUserCommand, AuthenticationResultDto> {
 *   async execute(command: RegisterUserCommand): Promise<AuthenticationResultDto> {
 *     // implementation - result type is automatically inferred
 *   }
 * }
 * ```
 */
export function CommandHandler<TCommand extends ICommand>(
  commandType: new (...args: any[]) => TCommand,
  options?: CommandHandlerOptions
): <THandler extends ICommandHandler<TCommand, any>>(
  target: new (...args: any[]) => THandler
) => new (...args: any[]) => THandler;

export function CommandHandler<TCommand extends ICommand, TResult>(
  commandType: new (...args: any[]) => TCommand,
  options?: CommandHandlerOptions
): <THandler extends ICommandHandler<TCommand, TResult>>(
  target: new (...args: any[]) => THandler
) => new (...args: any[]) => THandler;

export function CommandHandler<TCommand extends ICommand, TResult = any>(
  commandType: new (...args: any[]) => TCommand,
  options?: CommandHandlerOptions
) {
  return function <THandler extends ICommandHandler<TCommand, TResult>>(
    target: new (...args: any[]) => THandler
  ) {
    const diOptions = options || {};
    const metadata: DIHandlerMetadata = {
      type: 'command',
      messageType: commandType,
      handlerType: target,
      options: diOptions,
      registeredAt: new Date(),
      registeredWithDI: false,
    };

    // Store metadata in command class (for resolution)
    Reflect.defineMetadata(
      'di:command-handler',
      {
        ...metadata,
        serviceId: diOptions.serviceId || target.name,
      },
      commandType
    );

    // Store metadata in handler class (for auto-discovery)
    Reflect.defineMetadata('di:handler-metadata', metadata, target);
    Reflect.defineMetadata('di:handler-type', 'command', target);

    // Mark for DI auto-registration
    if (diOptions.autoRegister !== false) {
      Reflect.defineMetadata('di:registration-pending', true, target);
    }

    return target;
  };
}
