/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import type { IQuery, IQueryHandler } from '../interfaces';
import type { DIHandlerMetadata, QueryHandlerOptions } from './di-types';

/**
 * Class decorator that binds a handler class to a query type and registers
 * it for DI auto-discovery via the {@link CQRSDiscoveryPlugin}.
 *
 * Mirrors {@link CommandHandler} but for queries. The decorator stores
 * `di:query-handler` metadata on the query class and `di:handler-metadata` /
 * `di:handler-type` on the handler class. {@link QueryBus.execute} reads
 * the query-side metadata at runtime to resolve the handler from the DI
 * container.
 *
 * @example Basic decorator usage
 * ```typescript
 * import { QueryHandler } from '@vytches/ddd-cqrs';
 *
 * class GetOrderById implements IQuery<Order | null> {
 *   constructor(public id: string) {}
 * }
 *
 * @QueryHandler(GetOrderById)
 * export class GetOrderByIdHandler
 *   implements IQueryHandler<GetOrderById, Order | null>
 * {
 *   constructor(@Inject('OrderRepository') private repo: IOrderRepo) {}
 *   async execute(q: GetOrderById): Promise<Order | null> {
 *     return this.repo.findById(q.id);
 *   }
 * }
 *
 * const order = await queryBus.execute(new GetOrderById('o-1'));
 * ```
 *
 * @example Manual wiring (no auto-registration)
 * ```typescript
 * @QueryHandler(GetOrderById, { autoRegister: false })
 * export class GetOrderByIdHandler { ... }
 *
 * queryBus.register(GetOrderById, new GetOrderByIdHandler(repo));
 * ```
 *
 * @param queryType - The query class this handler responds to
 * @param options - DI / registration options
 * @returns Class decorator preserving handler type
 *
 * @public
 * @stable
 * @since 0.1.0
 */
export function QueryHandler<T extends IQuery<R>, R>(
  queryType: new (...args: any[]) => T,
  options?: QueryHandlerOptions
) {
  return function <K extends IQueryHandler<T, R>>(target: new (...args: any[]) => K) {
    const diOptions = options || {};
    const metadata: DIHandlerMetadata = {
      type: 'query',
      messageType: queryType,
      handlerType: target,
      options: diOptions,
      registeredAt: new Date(),
      registeredWithDI: false,
    };

    // Store metadata in query class (for resolution)
    Reflect.defineMetadata(
      'di:query-handler',
      {
        ...metadata,
        serviceId: diOptions.serviceId || target.name,
      },
      queryType
    );

    // Store metadata in handler class (for auto-discovery)
    Reflect.defineMetadata('di:handler-metadata', metadata, target);
    Reflect.defineMetadata('di:handler-type', 'query', target);
    Reflect.defineMetadata('di:handler-scope', diOptions.scope ?? 'context', target);

    // Mark for DI auto-registration
    if (diOptions.autoRegister !== false) {
      Reflect.defineMetadata('di:registration-pending', true, target);
    }

    return target;
  };
}
