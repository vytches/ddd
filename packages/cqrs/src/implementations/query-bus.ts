import 'reflect-metadata';
import type { IDependencyContainer, ServiceToken } from '@vytches-ddd/di';
import { IQueryBus } from '../abstracts';
import type { IQuery, IQueryHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';
import { CQRSExecutionContext } from '../middleware';
import type { ICqrsValidatable } from '../validation';
import { HandlerNotFoundError, CQRSConfigurationError } from '../errors';

export class QueryBus extends IQueryBus {
  private middlewares: ICQRSMiddleware[] = [];

  constructor(private container: IDependencyContainer) {
    super();
  }

  register<T extends IQuery<R>, R>(_queryType: unknown, _handler: IQueryHandler<T, R>): void {
    // Legacy method - deprecated in favor of DI container registration
    throw new CQRSConfigurationError(
      'Manual registration is deprecated. Use @QueryHandler decorator and DI container instead.',
      'QueryBus'
    );
  }

  registerFactory<T extends IQuery<R>, R>(
    _queryType: unknown,
    _factory: () => IQueryHandler<T, R>
  ): void {
    // Legacy method - deprecated in favor of DI container registration
    throw new CQRSConfigurationError(
      'Manual factory registration is deprecated. Use @QueryHandler decorator and DI container instead.',
      'QueryBus'
    );
  }

  use(middleware: ICQRSMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  discoverHandlers(): void {
    // Legacy method - discovery is now handled by DI container auto-discovery
    // This method is kept for backward compatibility but does nothing
    console.warn(
      'QueryBus.discoverHandlers() is deprecated. Handler discovery is now automatic through DI container.'
    );
  }

  async execute<T extends IQuery<R>, R>(query: T): Promise<R> {
    // Direct resolution through DI container using metadata
    const handlerToken = this.getHandlerToken(query.constructor);

    let handler: IQueryHandler<T, R>;
    try {
      handler = this.container.resolve<IQueryHandler<T, R>>(handlerToken);
    } catch (error) {
      throw new HandlerNotFoundError(query.constructor.name, 'query');
    }

    // Optional validation
    if (this.isValidatable(query) && 'validate' in query) {
      await query.validate();
    }

    // Execute with middleware pipeline
    const context = new CQRSExecutionContext(query, handler, 'query');
    return this.executeWithMiddleware(context, () => handler.execute(query)) as Promise<R>;
  }

  private getHandlerToken(queryClass: any): ServiceToken {
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
