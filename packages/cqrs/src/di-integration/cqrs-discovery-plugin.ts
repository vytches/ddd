/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import 'reflect-metadata';

// Local type definitions to avoid hard dependency on DI package
interface HandlerInfo {
  type: 'command' | 'query' | 'event';
  messageType: unknown;
  handlerType: Function;
  metadata: Record<string, unknown>;
}

interface IHandlerDiscoveryPlugin {
  readonly name: string;
  discoverHandlers(assemblies?: unknown[]): Promise<HandlerInfo[]> | HandlerInfo[];
  isAvailable(): boolean;
}

export class CQRSDiscoveryPlugin implements IHandlerDiscoveryPlugin {
  readonly name = 'CQRS';

  /**
   * Check if CQRS package is available
   */
  isAvailable(): boolean {
    return true; // We're in the CQRS package, so always available
  }

  /**
   * Discover CQRS handlers using pure metadata approach
   */
  async discoverHandlers(assemblies?: unknown[]): Promise<HandlerInfo[]> {
    const handlers: HandlerInfo[] = [];

    // Scan provided assemblies for handlers
    if (assemblies && assemblies.length > 0) {
      for (const assembly of assemblies) {
        const moduleHandlers = this.scanModule(assembly);
        handlers.push(...moduleHandlers);
      }
    }

    return handlers;
  }

  /**
   * Scan a module for CQRS handlers
   */
  private scanModule(module: unknown): HandlerInfo[] {
    const handlers: HandlerInfo[] = [];

    // Handle null/undefined modules
    if (!module || typeof module !== 'object') {
      return handlers;
    }

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
              handlerType: value as Function,
              metadata: { ...metadata },
            });
          }
        }
      }
    }

    return handlers;
  }
}
