import type { IQuery, IQueryHandler } from '../interfaces';
import type { ICQRSMiddleware } from '../middleware';

type QueryConstructor<T extends IQuery<R>, R = unknown> = new (...args: unknown[]) => T;

/**
 * Stable DI injection token for IQueryBus.
 *
 * Use `Symbol.for` so the token resolves to the same reference regardless of
 * whether the consumer imports from the ESM or CJS build of this package
 * (dual-package hazard). The string key `'vytches:cqrs:query-bus'` is a
 * public contract — do not change it across minor versions.
 *
 * @example
 * ```typescript
 * import { QUERY_BUS_TOKEN } from '@vytches/ddd-cqrs';
 * // In a NestJS provider:
 * @Inject(QUERY_BUS_TOKEN) private readonly queryBus: IQueryBus
 * ```
 */
export const QUERY_BUS_TOKEN: unique symbol = Symbol.for('vytches:cqrs:query-bus');

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
