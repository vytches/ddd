/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { IDependencyContainer, ServiceToken } from '@vytches/ddd-di';
import { Logger } from '@vytches/ddd-logging';
import { MiddlewarePipelineExecutor } from '@vytches/ddd-utils';
import 'reflect-metadata';

import { ICommandBus } from '../abstracts';
import { HandlerNotFoundError } from '../errors';
import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext } from '../middleware';
import type { ICqrsValidatable } from '../validation';

export class CommandBus extends ICommandBus {
  private readonly logger = Logger.forContext('CommandBus');
  private middlewares: ICQRSMiddleware[] = [];
  private handlers: Map<
    string,
    ICommandHandler<ICommand, unknown> | (() => ICommandHandler<ICommand, unknown>)
  > = new Map();

  constructor(private container: IDependencyContainer) {
    super();
  }

  register<T extends ICommand, TResult = void>(
    commandType: unknown,
    handler: ICommandHandler<T, TResult>
  ): void {
    // Support manual registration for flexibility
    const commandName =
      typeof commandType === 'string' ? commandType : (commandType as Function).name;

    this.handlers.set(commandName, handler);
  }

  registerFactory<T extends ICommand, TResult = void>(
    commandType: unknown,
    factory: () => ICommandHandler<T, TResult>
  ): void {
    // Support factory registration for lazy initialization
    const commandName =
      typeof commandType === 'string' ? commandType : (commandType as Function).name;

    this.handlers.set(commandName, factory);
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
      this.logger.warn(
        'CommandBus.discoverHandlers() is deprecated. Handler discovery is now automatic through DI container.'
      );
    }
  }

  async execute<T extends ICommand, TResult = void>(command: T): Promise<TResult> {
    const commandName = command.constructor.name;
    let handler: ICommandHandler<T, TResult>;

    // First, check manual registrations
    const registeredHandler = this.handlers.get(commandName);
    if (registeredHandler) {
      // Check if it's a factory function or direct handler
      if (typeof registeredHandler === 'function' && !('execute' in registeredHandler)) {
        // It's a factory function
        handler = (registeredHandler as () => ICommandHandler<T, TResult>)();
      } else {
        // It's a direct handler
        handler = registeredHandler as ICommandHandler<T, TResult>;
      }
    } else {
      // Fall back to DI container resolution
      try {
        const handlerToken = this.getHandlerToken(command.constructor) as ServiceToken<ICommandHandler<T, TResult>>;
        handler = this.container.resolve<ICommandHandler<T, TResult>>(handlerToken);
      } catch (_error) {
        throw new HandlerNotFoundError(command.constructor.name, 'command');
      }
    }

    // Optional validation
    if (this.isValidatable(command) && 'validate' in command) {
      await command.validate();
    }

    // Execute with middleware pipeline
    const context = new CQRSExecutionContext(command, handler, 'command');
    return await this.executeWithMiddleware(context, () => handler.execute(command));
  }

  private getHandlerToken(commandClass: Function): ServiceToken {
    // Get handler metadata from command class
    const handlerMetadata = Reflect.getMetadata('di:command-handler', commandClass);
    if (!handlerMetadata) {
      // For manual registration, we don't have metadata, so throw to trigger fallback
      throw new Error(`No metadata for ${commandClass.name}`);
    }

    return handlerMetadata.serviceId || handlerMetadata.handlerType.name;
  }

  private async executeWithMiddleware<T>(
    context: CQRSExecutionContext,
    handlerExecution: () => Promise<T>
  ): Promise<T> {
    const pipeline = new MiddlewarePipelineExecutor<CQRSExecutionContext, unknown>(
      this.middlewares
    );
    return pipeline.executeSimple(context, handlerExecution) as Promise<T>;
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
