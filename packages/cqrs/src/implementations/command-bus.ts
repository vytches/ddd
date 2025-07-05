import { VytchesDDD } from '@vytches-ddd/di';

import { ICommandBus } from '../abstracts';
import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext } from '../middleware';
import type { ICqrsValidatable } from '../validation';
import { HandlerNotFoundError, CQRSConfigurationError } from '../errors';
import { CQRSMetadataRegistry } from '../registry';

export class CommandBus extends ICommandBus {
  private handlers = new Map<
    unknown,
    ICommandHandler<ICommand> | (() => ICommandHandler<ICommand>)
  >();
  private middlewares: ICQRSMiddleware[] = [];
  private handlerResolver: ((handlerClass: unknown) => ICommandHandler<ICommand>) | undefined;
  private useDI: boolean;

  constructor(handlerResolver?: (handlerClass: unknown) => ICommandHandler<ICommand>, useDI = true) {
    super();
    this.handlerResolver = handlerResolver ?? undefined;
    this.useDI = useDI && !!VytchesDDD;
  }

  register<T extends ICommand>(commandType: unknown, handler: ICommandHandler<T>): void {
    this.handlers.set(commandType, handler);
  }

  registerFactory<T extends ICommand>(
    commandType: unknown,
    factory: () => ICommandHandler<T>
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

      try {
        const DI = VytchesDDD;
        if (this.useDI && DI) {
          // Phase 2: Use DI container for handler resolution
          this.registerFactory(commandClass, () => {
            try {
              // Try to resolve from DI container first
              return DI.resolve(handlerClass);
            } catch {
              // Fallback to direct instantiation if not registered in DI
              return new handlerClass();
            }
          });
        } else if (this.handlerResolver) {
          // Phase 1: Use provided handler resolver
          const handler = this.handlerResolver(handlerClass);
          this.register(commandClass, handler);
        } else {
          // Fallback: Direct instantiation
          const handler = new handlerClass();
          this.register(commandClass, handler);
        }
      } catch (error) {
        throw new CQRSConfigurationError(
          `Failed to resolve handler ${handlerClass.name}: ${error}`,
          'CommandBus'
        );
      }
    });
  }

  async execute<T extends ICommand>(command: T): Promise<void> {
    const handlerOrFactory = this.handlers.get(command.constructor);
    if (!handlerOrFactory) {
      throw new HandlerNotFoundError(command.constructor.name, 'command');
    }

    const handler = typeof handlerOrFactory === 'function' ? handlerOrFactory() : handlerOrFactory;

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
