/* eslint-disable @typescript-eslint/no-explicit-any */
import { ICommandBus } from '../abstracts';
import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware} from '../middleware';
import { CQRSExecutionContext } from '../middleware';
import type { ICqrsValidatable } from '../validation';
import { HandlerNotFoundError, CQRSConfigurationError } from '../errors';
import { CQRSMetadataRegistry } from '../registry';

export class CommandBus extends ICommandBus {
  private handlers = new Map<
    any,
    ICommandHandler<any> | (() => ICommandHandler<any>)
  >();
  private middlewares: ICQRSMiddleware[] = [];
  private handlerResolver: ((handlerClass: any) => any) | undefined;

  constructor(handlerResolver?: (handlerClass: any) => any) {
    super();
    this.handlerResolver = handlerResolver ?? undefined;
  }

  register<T extends ICommand>(
    commandType: any,
    handler: ICommandHandler<T>,
  ): void {
    this.handlers.set(commandType, handler);
  }

  registerFactory<T extends ICommand>(
    commandType: any,
    factory: () => ICommandHandler<T>,
  ): void {
    this.handlers.set(commandType, factory);
  }

  use(middleware: ICQRSMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  discoverHandlers(): void {
    const metadata = CQRSMetadataRegistry.getCommandHandlers();

    metadata.forEach((handlerClass, commandClass) => {
      // Skip if already manually registered
      if (this.handlers.has(commandClass)) return;

      if (!this.handlerResolver) {
        throw new CQRSConfigurationError(
          'Handler resolver required for auto-discovery',
          'CommandBus',
        );
      }

      try {
        const handler = this.handlerResolver(handlerClass);
        this.register(commandClass, handler);
      } catch (error) {
        throw new CQRSConfigurationError(
          `Failed to resolve handler ${handlerClass.name}: ${error}`,
          'CommandBus',
        );
      }
    });
  }

  async execute<T extends ICommand>(command: T): Promise<void> {
    const handlerOrFactory = this.handlers.get(command.constructor);
    if (!handlerOrFactory) {
      throw new HandlerNotFoundError(command.constructor.name, 'command');
    }

    const handler =
      typeof handlerOrFactory === 'function'
        ? handlerOrFactory()
        : handlerOrFactory;

    // Optional validation
    if (this.isValidatable(command) && 'validate' in command) {
      await command.validate();
    }

    // Execute with middleware pipeline
    const context = new CQRSExecutionContext(command, handler, 'command');
    await this.executeWithMiddleware(context, () => handler.execute(command));
  }

  private async executeWithMiddleware(
    context: CQRSExecutionContext,
    handlerExecution: () => Promise<any>,
  ): Promise<any> {
    if (this.middlewares.length === 0) {
      return handlerExecution();
    }

    let index = 0;

    const next = async (): Promise<any> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware?.handle(context, next);
      } else {
        return handlerExecution();
      }
    };

    return next();
  }

  private isValidatable(obj: any): obj is ICqrsValidatable {
    return obj && typeof obj.validate === 'function';
  }
}
