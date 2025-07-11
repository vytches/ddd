/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import type { IQuery, IQueryHandler } from '../interfaces';
import type { QueryHandlerOptions, DIHandlerMetadata } from './di-types';

/**
 * QueryHandler decorator - pure metadata, no registry
 * Framework agnostic - works with any DI container
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

    // Mark for DI auto-registration
    if (diOptions.autoRegister !== false) {
      Reflect.defineMetadata('di:registration-pending', true, target);
    }

    return target;
  };
}
