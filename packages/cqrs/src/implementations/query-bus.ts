/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import type { IDependencyContainer, ServiceToken } from '@vytches/ddd-di';
import { MiddlewarePipelineExecutor } from '@vytches/ddd-utils';
import 'reflect-metadata';

import { IQueryBus } from '../abstracts';
import { CQRSConfigurationError, HandlerNotFoundError } from '../errors';
import type { IQuery, IQueryHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext } from '../middleware';
import type { ICqrsValidatable } from '../validation';

export class QueryBus extends IQueryBus {
  private middlewares: ICQRSMiddleware[] = [];
  private handlers: Map<
    string,
    IQueryHandler<IQuery<unknown>, unknown> | (() => IQueryHandler<IQuery<unknown>, unknown>)
  > = new Map();

  constructor(private container: IDependencyContainer) {
    super();
  }

  register<T extends IQuery<R>, R>(queryType: unknown, handler: IQueryHandler<T, R>): void {
    // Support manual registration for flexibility
    const queryName = typeof queryType === 'string' ? queryType : (queryType as Function).name;

    this.handlers.set(queryName, handler);
  }

  registerFactory<T extends IQuery<R>, R>(
    queryType: unknown,
    factory: () => IQueryHandler<T, R>
  ): void {
    // Support factory registration for lazy initialization
    const queryName = typeof queryType === 'string' ? queryType : (queryType as Function).name;

    this.handlers.set(queryName, factory);
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
        'QueryBus.discoverHandlers() is deprecated. Handler discovery is now automatic through DI container.'
      );
    }
  }

  async execute<T extends IQuery<R>, R>(query: T): Promise<R> {
    const queryName = query.constructor.name;
    let handler: IQueryHandler<T, R>;

    // First, check manual registrations
    const registeredHandler = this.handlers.get(queryName);
    if (registeredHandler) {
      // Check if it's a factory function or direct handler
      if (typeof registeredHandler === 'function' && !('execute' in registeredHandler)) {
        // It's a factory function
        handler = (registeredHandler as () => IQueryHandler<T, R>)();
      } else {
        // It's a direct handler
        handler = registeredHandler as IQueryHandler<T, R>;
      }
    } else {
      // Fall back to DI container resolution
      try {
        const handlerToken = this.getHandlerToken(query.constructor);
        handler = this.container.resolve<IQueryHandler<T, R>>(handlerToken);
      } catch (_error) {
        throw new HandlerNotFoundError(query.constructor.name, 'query');
      }
    }

    // Optional validation
    if (this.isValidatable(query) && 'validate' in query) {
      await query.validate();
    }

    // Execute with middleware pipeline
    const context = new CQRSExecutionContext(query, handler, 'query');
    return this.executeWithMiddleware(context, () => handler.execute(query));
  }

  private getHandlerToken(queryClass: Function): ServiceToken {
    // Get handler metadata from query class
    const handlerMetadata = Reflect.getMetadata('di:query-handler', queryClass);
    if (!handlerMetadata) {
      throw new CQRSConfigurationError(
        `No handler registered for query ${queryClass.name}. Did you forget @QueryHandler decorator?`,
        'QueryBus'
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
