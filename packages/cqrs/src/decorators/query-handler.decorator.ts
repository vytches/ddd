/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';
import type { IQuery, IQueryHandler } from '../interfaces';
import { CQRSMetadataRegistry } from '../registry';
import type { QueryHandlerOptions, DIHandlerMetadata } from './di-types';

/**
 * Enhanced QueryHandler decorator with DI integration
 * Maintains backward compatibility while adding Phase 2 DI features
 */
export function QueryHandler<T extends IQuery<R>, R>(
  queryType: new (...args: any[]) => T,
  options?: QueryHandlerOptions
) {
  return function <K extends IQueryHandler<T, R>>(target: new (...args: any[]) => K) {
    // Phase 1: Maintain existing functionality
    CQRSMetadataRegistry.registerQueryHandler(queryType, target);

    // Phase 2: Enhanced DI integration
    const diOptions = options || {};
    const metadata: DIHandlerMetadata = {
      type: 'query',
      messageType: queryType,
      handlerType: target,
      options: diOptions,
      registeredAt: new Date(),
      registeredWithDI: false
    };

    // Store enhanced metadata for auto-discovery
    Reflect.defineMetadata('di:query-handler', metadata, target);
    Reflect.defineMetadata('di:handler-type', 'query', target);

    // Phase 2: Auto-register with DI container if available and enabled
    // Note: Registration is deferred to avoid circular dependencies
    // Actual DI registration happens during VytchesDDD.discoverAndRegisterHandlers()
    if (diOptions.autoRegister !== false) {
      // Mark as pending DI registration for auto-discovery
      metadata.registeredWithDI = false; // Will be updated by auto-discovery
      Reflect.defineMetadata('di:registration-pending', true, target);
    }

    return target;
  };
}
