/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { IDependencyContainer, ServiceToken } from '@vytches/ddd-di';
import { Logger } from '@vytches/ddd-logging';
import { MiddlewarePipelineExecutor, Result } from '@vytches/ddd-utils';
import 'reflect-metadata';

import { ICommandBus } from '../abstracts';
import { CQRSConfigurationError, HandlerNotFoundError } from '../errors';
import type { ICommand, ICommandHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext } from '../middleware';
import type { ICqrsValidatable } from '../validation';

/**
 * Default `ICommandBus` implementation — routes commands to their registered
 * handler, runs configured middleware in order, and resolves handlers either
 * from manual registrations or from the DI container.
 *
 * Two registration paths exist; the bus tries them in this order:
 *
 * 1. **Manual** — `register(commandType, handler)` or
 *    `registerFactory(commandType, () => handler)` for tests, scripts, and
 *    cases where DI is not desirable.
 * 2. **DI auto-discovery** — apply `@CommandHandler(MyCommand)` on a class
 *    and the {@link CQRSDiscoveryPlugin} wires it into the container during
 *    bootstrap. `execute()` resolves the handler via reflection metadata.
 *
 * Use {@link tryExecute} when you want a `Result<TResult, Error>` instead
 * of a throwing call — useful for application services that already speak
 * `Result<T>`.
 *
 * @example Manual registration (no DI)
 * ```typescript
 * import { CommandBus } from '@vytches/ddd-cqrs';
 *
 * class CreateOrder { constructor(public customerId: string) {} }
 * class CreateOrderHandler {
 *   async execute(cmd: CreateOrder) { return { id: 'o-1' }; }
 * }
 *
 * const bus = new CommandBus(container);
 * bus.register(CreateOrder, new CreateOrderHandler());
 * const result = await bus.execute(new CreateOrder('c-1')); // { id: 'o-1' }
 * ```
 *
 * @example With middleware and validation
 * ```typescript
 * import { LoggingMiddleware } from '@vytches/ddd-cqrs';
 * bus.use(new LoggingMiddleware()); // chain .use(...) for additional middleware
 *
 * class CreateOrder implements ICqrsValidatable {
 *   constructor(public amount: number) {}
 *   async validate() {
 *     if (this.amount <= 0) throw new Error('amount must be positive');
 *   }
 * }
 * await bus.execute(new CreateOrder(-5)); // throws before reaching handler
 * ```
 *
 * @example tryExecute returns Result instead of throwing
 * ```typescript
 * const r = await bus.tryExecute(new CreateOrder('c-1'));
 * if (r.isSuccess) console.log('created:', r.value);
 * else console.error('failed:', r.error);
 * ```
 *
 * @public
 * @stable
 * @since 0.1.0
 */
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
        const handlerToken = this.getHandlerToken(command.constructor) as ServiceToken<
          ICommandHandler<T, TResult>
        >;
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

  /**
   * Execute a command, returning Result instead of throwing.
   * @public
   * @stable
   * @since 0.24.0
   */
  async tryExecute<T extends ICommand, TResult = void>(
    command: T
  ): Promise<Result<TResult, Error>> {
    return Result.tryAsync(async () => {
      return await this.execute<T, TResult>(command);
    });
  }

  private getHandlerToken(commandClass: Function): ServiceToken {
    // Get handler metadata from command class
    const handlerMetadata = Reflect.getMetadata('di:command-handler', commandClass);
    if (!handlerMetadata) {
      // REL-009 (2026-05-08): align with QueryBus.getHandlerToken — throw a
      // typed CQRSConfigurationError with a decorator hint instead of a
      // generic Error. The outer execute() still catches and re-throws as
      // HandlerNotFoundError for the "no manual registration AND no
      // decorator" case, but if this method is called directly (e.g. from
      // diagnostics), consumers now see the same actionable message in both
      // buses.
      throw new CQRSConfigurationError(
        `No handler registered for command ${commandClass.name}. Did you forget @CommandHandler decorator?`,
        'CommandBus'
      );
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
