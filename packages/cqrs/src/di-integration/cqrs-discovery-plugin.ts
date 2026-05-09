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
   * VP-NEW-001 (2026-05-09): memoize scan results per module reference.
   *
   * Modules don't mutate after load, so re-scanning the same module twice
   * is wasted work. WeakMap keyed by module object ensures cache entries
   * are GC'd if the module is unloaded.
   *
   * Impact: in apps with many bounded contexts each calling
   * `discoverHandlers([sameModule])` the cost goes from O(N×K) to O(N+K)
   * where N = number of exports, K = number of context lookups.
   *
   * @internal
   */
  private readonly scanCache = new WeakMap<object, HandlerInfo[]>();

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
   * Scan a module for CQRS handlers (memoized — see `scanCache`).
   */
  private scanModule(module: unknown): HandlerInfo[] {
    // Handle null/undefined modules
    if (!module || typeof module !== 'object') {
      return [];
    }

    // VP-NEW-001: cache hit short-circuits expensive Object.entries +
    // Reflect.getMetadata loop.
    const cached = this.scanCache.get(module as object);
    if (cached) return cached;

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
              handlerType: value as Function,
              metadata: { ...metadata },
            });
          }
        }
      }
    }

    // VP-NEW-001: store result so subsequent scans of the same module
    // skip the loop entirely.
    this.scanCache.set(module as object, handlers);
    return handlers;
  }
}
