/* eslint-disable @typescript-eslint/no-explicit-any */
import { IQueryBus } from '../abstracts';
import type { IQuery, IQueryHandler } from '../interfaces';
import type { ICQRSMiddleware} from '../middleware';
import { CQRSExecutionContext } from '../middleware';
import type { ICqrsValidatable } from '../validation';
import { HandlerNotFoundError, CQRSConfigurationError } from '../errors';
import { CQRSMetadataRegistry } from '../registry';

export class QueryBus extends IQueryBus {
  private handlers = new Map<
    any,
    IQueryHandler<any, any> | (() => IQueryHandler<any, any>)
  >();
  private middlewares: ICQRSMiddleware[] = [];
  private handlerResolver: ((handlerClass: any) => any) | undefined;

  constructor(handlerResolver?: (handlerClass: any) => any) {
    super();
    this.handlerResolver = handlerResolver ?? undefined;
  }

  register<T extends IQuery<R>, R>(
    queryType: any,
    handler: IQueryHandler<T, R>,
  ): void {
    this.handlers.set(queryType, handler);
  }

  registerFactory<T extends IQuery<R>, R>(
    queryType: any,
    factory: () => IQueryHandler<T, R>,
  ): void {
    this.handlers.set(queryType, factory);
  }

  use(middleware: ICQRSMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  discoverHandlers(): void {
    const metadata = CQRSMetadataRegistry.getQueryHandlers();

    metadata.forEach((handlerClass, queryClass) => {
      // Skip if already manually registered
      if (this.handlers.has(queryClass)) return;

      if (!this.handlerResolver) {
        throw new CQRSConfigurationError(
          'Handler resolver required for auto-discovery',
          'QueryBus',
        );
      }

      try {
        const handler = this.handlerResolver(handlerClass);
        this.register(queryClass, handler);
      } catch (error) {
        throw new CQRSConfigurationError(
          `Failed to resolve handler ${handlerClass.name}: ${error}`,
          'QueryBus',
        );
      }
    });
  }

  async execute<T extends IQuery<R>, R>(query: T): Promise<R> {
    const handlerOrFactory = this.handlers.get(query.constructor);
    if (!handlerOrFactory) {
      throw new HandlerNotFoundError(query.constructor.name, 'query');
    }

    const handler =
      typeof handlerOrFactory === 'function'
        ? handlerOrFactory()
        : handlerOrFactory;

    // Optional validation
    if (this.isValidatable(query) && 'validate' in query) {
      await query.validate();
    }

    // Execute with middleware pipeline
    const context = new CQRSExecutionContext(query, handler, 'query');
    return this.executeWithMiddleware(context, () => handler.execute(query));
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
