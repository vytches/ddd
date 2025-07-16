/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import 'reflect-metadata';
import type { IDependencyContainer, ServiceToken } from '@vytches-ddd/di';

import { ICommandBus } from '../abstracts';
import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext } from '../middleware';
import type { ICqrsValidatable } from '../validation';
import { HandlerNotFoundError, CQRSConfigurationError } from '../errors';

/**
 * @llm-summary CommandBus class for command bus operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * CommandBus class implementing architectural component for command bus operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CommandBus();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new CommandBus());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class CommandBus extends ICommandBus {
  private middlewares: ICQRSMiddleware[] = [];

  constructor(private container: IDependencyContainer) {
    super();
  }

  register<T extends ICommand>(_commandType: unknown, _handler: ICommandHandler<T>): void {
    // Legacy method - deprecated in favor of DI container registration
    throw new CQRSConfigurationError(
      'Manual registration is deprecated. Use @CommandHandler decorator and DI container instead.',
      'CommandBus'
    );
  }

  registerFactory<T extends ICommand>(
    _commandType: unknown,
    _factory: () => ICommandHandler<T>
  ): void {
    // Legacy method - deprecated in favor of DI container registration
    throw new CQRSConfigurationError(
      'Manual factory registration is deprecated. Use @CommandHandler decorator and DI container instead.',
      'CommandBus'
    );
  }

  use(middleware: ICQRSMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  discoverHandlers(): void {
    // Legacy method - discovery is now handled by DI container auto-discovery
    // This method is kept for backward compatibility but does nothing
    // Suppress deprecation warnings in CI to avoid stderr confusion
    if (!process.env.CI) {
      console.warn(
        'CommandBus.discoverHandlers() is deprecated. Handler discovery is now automatic through DI container.'
      );
    }
  }

  async execute<T extends ICommand>(command: T): Promise<void> {
    // Direct resolution through DI container using metadata
    const handlerToken = this.getHandlerToken(command.constructor);

    let handler: ICommandHandler<T>;
    try {
      handler = this.container.resolve<ICommandHandler<T>>(handlerToken);
    } catch (_error) {
      throw new HandlerNotFoundError(command.constructor.name, 'command');
    }

    // Optional validation
    if (this.isValidatable(command) && 'validate' in command) {
      await command.validate();
    }

    // Execute with middleware pipeline
    const context = new CQRSExecutionContext(command, handler, 'command');
    await this.executeWithMiddleware(context, () => handler.execute(command));
  }

  private getHandlerToken(commandClass: Function): ServiceToken {
    // Get handler metadata from command class
    const handlerMetadata = Reflect.getMetadata('di:command-handler', commandClass);
    if (!handlerMetadata) {
      throw new CQRSConfigurationError(
        `No handler registered for command ${commandClass.name}. Did you forget @CommandHandler decorator?`,
        'CommandBus'
      );
    }

    return handlerMetadata.serviceId || handlerMetadata.handlerType.name;
  }

  private async executeWithMiddleware(
    context: CQRSExecutionContext,
    handlerExecution: () => Promise<unknown>
  ): Promise<unknown> {
    if (this.middlewares.length === 0) {
      return handlerExecution();
    }

    let index = 0;

    const next = async (): Promise<unknown> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware?.handle(context, next);
      } else {
        return handlerExecution();
      }
    };

    return next();
  }

  private isValidatable(obj: unknown): obj is ICqrsValidatable {
    return (
      obj != null &&
      typeof obj === 'object' &&
      'validate' in obj &&
      typeof (obj as Record<string, unknown>).validate === 'function'
    );
  }
}
