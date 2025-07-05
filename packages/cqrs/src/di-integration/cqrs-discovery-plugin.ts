/* eslint-disable @typescript-eslint/no-explicit-any */
import { CQRSMetadataRegistry } from '../registry';
import 'reflect-metadata';

// Local type definitions to avoid hard dependency on DI package
interface HandlerInfo {
  type: 'command' | 'query' | 'event';
  messageType: any;
  handlerType: any;
  metadata: any;
}

interface IHandlerDiscoveryPlugin {
  readonly name: string;
  discoverHandlers(assemblies?: any[]): Promise<HandlerInfo[]> | HandlerInfo[];
  isAvailable(): boolean;
}

/**
 * CQRS Handler Discovery Plugin for DI container
 * Discovers command and query handlers decorated with enhanced DI metadata
 */
export class CQRSDiscoveryPlugin implements IHandlerDiscoveryPlugin {
  readonly name = 'CQRS';

  /**
   * Check if CQRS package is available
   */
  isAvailable(): boolean {
    return true; // We're in the CQRS package, so always available
  }

  /**
   * Discover CQRS handlers from the metadata registry
   */
  async discoverHandlers(assemblies?: any[]): Promise<HandlerInfo[]> {
    const handlers: HandlerInfo[] = [];

    if (assemblies && assemblies.length > 0) {
      // Scan provided modules
      for (const assembly of assemblies) {
        const moduleHandlers = this.scanModule(assembly);
        handlers.push(...moduleHandlers);
      }
    } else {
      // Scan existing registries for handlers with DI metadata
      const cqrsHandlers = CQRSMetadataRegistry.getAllHandlers();
      
      // Check command handlers for DI metadata
      for (const [commandType, handlerType] of cqrsHandlers.commands) {
        const metadata = Reflect.getMetadata('di:command-handler', handlerType);
        if (metadata && Reflect.getMetadata('di:registration-pending', handlerType)) {
          handlers.push({
            type: 'command',
            messageType: commandType,
            handlerType,
            metadata
          });
        }
      }
      
      // Check query handlers for DI metadata
      for (const [queryType, handlerType] of cqrsHandlers.queries) {
        const metadata = Reflect.getMetadata('di:query-handler', handlerType);
        if (metadata && Reflect.getMetadata('di:registration-pending', handlerType)) {
          handlers.push({
            type: 'query',
            messageType: queryType,
            handlerType,
            metadata
          });
        }
      }
    }

    return handlers;
  }

  /**
   * Scan a module for CQRS handlers
   */
  private scanModule(module: any): HandlerInfo[] {
    const handlers: HandlerInfo[] = [];
    
    // Get all exported classes from module
    for (const [, value] of Object.entries(module)) {
      if (typeof value === 'function' && value.prototype) {
        // Check for DI handler metadata
        const handlerType = Reflect.getMetadata('di:handler-type', value);
        if (handlerType === 'command' || handlerType === 'query') {
          const metadata = Reflect.getMetadata(`di:${handlerType}-handler`, value);
          if (metadata && Reflect.getMetadata('di:registration-pending', value)) {
            handlers.push({
              type: handlerType as 'command' | 'query',
              messageType: metadata.messageType,
              handlerType: value as any,
              metadata
            });
          }
        }
      }
    }
    
    return handlers;
  }
}