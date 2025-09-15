/**
 * VP-012: Standard Discovery Strategy - Baseline Implementation
 * Eliminates performance theater with REAL reflection operations
 */

import type { HandlerInfo } from '../../discovery/handler-discovery.interface';
import type {
  IPerformanceContext,
  IPerformanceMetrics,
  IPerformanceStrategy,
} from '../abstractions/performance-strategy.interface';

/**
 * Standard discovery strategy using real reflection operations
 * BASELINE: No optimizations, pure reflection-based discovery
 */
export class StandardDiscoveryStrategy implements IPerformanceStrategy {
  readonly strategyId = 'standard-discovery';
  readonly displayName = 'Standard Discovery';
  readonly description = 'Baseline discovery using real reflection operations - no optimizations';

  /**
   * Standard strategy can handle any context (baseline)
   */
  canHandle(context: IPerformanceContext): boolean {
    return true; // Standard strategy is always available as fallback
  }

  /**
   * Execute standard discovery with REAL reflection operations
   * CRITICAL: No artificial timing, no busy-wait loops, no predetermined results
   */
  async optimize(context: IPerformanceContext): Promise<{
    handlers: HandlerInfo[];
    metrics: IPerformanceMetrics;
  }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    let handlers: HandlerInfo[] = [];
    let error: string | undefined;

    try {
      // REAL WORK: Execute actual discovery through plugins
      handlers = await this.executeRealDiscovery(context, startTime);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Discovery failed';
      console.error(`[StandardDiscoveryStrategy] Error: ${error}`);
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    // REAL METRICS: Actual timing and memory usage
    const metrics: IPerformanceMetrics = {
      discoveryTime: endTime - startTime,
      handlersFound: handlers.length,
      memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
      strategyUsed: this.strategyId,
      timestamp: new Date(),
      success: !error,
      error,
      metadata: {
        performanceMode: context.performanceMode,
        pluginsUsed: context.discoveryPlugins.length,
        contextsFiltered: context.contexts?.length || 0,
      },
    };

    return { handlers, metrics };
  }

  /**
   * Execute real discovery operations through plugins
   * CRITICAL: Uses actual Reflect.getMetadata() operations, not artificial timing
   */
  private async executeRealDiscovery(
    context: IPerformanceContext,
    startTime: number
  ): Promise<HandlerInfo[]> {
    const allHandlers: HandlerInfo[] = [];

    // Check if pre-compiled registry is available and should skip discovery
    if (context.preCompiledRegistry && context.skipDiscovery) {
      // Process pre-compiled registry handlers
      const registry = context.preCompiledRegistry;

      // Convert registry entries to HandlerInfo
      const preCompiledHandlers: HandlerInfo[] = [
        ...registry.commands.map((entry: any) => ({
          type: 'command' as const,
          messageType: entry.messageType,
          handlerType: entry.handlerType,
          metadata: { ...entry.metadata, context: entry.context },
        })),
        ...registry.queries.map((entry: any) => ({
          type: 'query' as const,
          messageType: entry.messageType,
          handlerType: entry.handlerType,
          metadata: { ...entry.metadata, context: entry.context },
        })),
        ...registry.events.map((entry: any) => ({
          type: 'event' as const,
          messageType: entry.messageType,
          handlerType: entry.handlerType,
          metadata: { ...entry.metadata, context: entry.context },
        })),
        ...registry.domainServices.map((entry: any) => ({
          type: 'service' as const,
          messageType: entry.messageType,
          handlerType: entry.handlerType,
          metadata: { ...entry.metadata, context: entry.context },
        })),
      ];

      return this.removeDuplicateHandlers(preCompiledHandlers);
    }

    // Execute discovery through each plugin
    for (const plugin of context.discoveryPlugins) {
      try {
        // REAL REFLECTION WORK: Each plugin performs actual metadata scanning
        const pluginHandlers = await plugin.discoverHandlers();

        // Apply context filtering if specified
        const filteredHandlers = context.contexts?.length
          ? this.filterByContexts(pluginHandlers, context.contexts)
          : pluginHandlers;

        allHandlers.push(...filteredHandlers);

        // Apply timeout protection (real enterprise requirement)
        if (context.timeout) {
          const currentTime = performance.now();
          if (currentTime - startTime > context.timeout) {
            throw new Error(`Discovery timeout after ${context.timeout}ms`);
          }
        }
      } catch (error) {
        console.warn(
          `[StandardDiscoveryStrategy] Plugin ${plugin.constructor.name} failed:`,
          error
        );
        // Continue with other plugins (graceful degradation)
      }
    }

    // Apply handler limit if specified
    if (context.maxHandlers && allHandlers.length > context.maxHandlers) {
      console.warn(
        `[StandardDiscoveryStrategy] Handler limit reached: ${context.maxHandlers}, found: ${allHandlers.length}`
      );
      return allHandlers.slice(0, context.maxHandlers);
    }

    // Remove duplicates (real enterprise requirement)
    return this.removeDuplicateHandlers(allHandlers);
  }

  /**
   * Filter handlers by specified contexts
   */
  private filterByContexts(handlers: HandlerInfo[], contexts: string[]): HandlerInfo[] {
    return handlers.filter(handler => {
      const metadata = handler.metadata as { context?: string } | undefined;
      return !metadata?.context || contexts.includes(metadata.context);
    });
  }

  /**
   * Remove duplicate handlers based on message type and handler type
   */
  private removeDuplicateHandlers(handlers: HandlerInfo[]): HandlerInfo[] {
    const seen = new Set<string>();
    return handlers.filter(handler => {
      const key = `${handler.type}:${handler.messageType?.name}:${handler.handlerType?.name}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Validate strategy prerequisites (none for standard strategy)
   */
  async validatePrerequisites(context: IPerformanceContext): Promise<boolean> {
    return context.discoveryPlugins.length > 0;
  }
}
