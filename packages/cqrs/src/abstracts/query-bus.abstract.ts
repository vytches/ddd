import type { IQuery, IQueryHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';

type QueryConstructor<T extends IQuery<R>, R = unknown> = new (...args: unknown[]) => T;

export abstract class IQueryBus {
  abstract register<T extends IQuery<R>, R>(
    queryType: QueryConstructor<T, R>,
    handler: IQueryHandler<T, R>
  ): void;
  abstract registerFactory<T extends IQuery<R>, R>(
    queryType: QueryConstructor<T, R>,
    factory: () => IQueryHandler<T, R>
  ): void;
  abstract use(middleware: ICQRSMiddleware): this;
  abstract discoverHandlers(): void;
  abstract execute<T extends IQuery<R>, R>(query: T): Promise<R>;
}
