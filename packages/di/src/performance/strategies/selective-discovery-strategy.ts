/**
 * VP-012: Selective Discovery Strategy - Context-Based Optimization
 * Eliminates performance theater with real context filtering
 */

import type {
  HandlerInfo,
  IHandlerDiscoveryPlugin,
} from '../../discovery/handler-discovery.interface';
import type {
  IPerformanceContext,
  IPerformanceMetrics,
  IPerformanceStrategy,
} from '../abstractions/performance-strategy.interface';

/**
 * Selective discovery strategy using context-based filtering
 * OPTIMIZATION: Only discovers handlers for specified contexts
 */
export class SelectiveDiscoveryStrategy implements IPerformanceStrategy {
  readonly strategyId = 'selective-discovery';
  readonly displayName = 'Selective Discovery';
  readonly description =
    'Context-based discovery optimization - only processes specified bounded contexts';

  /**
   * Selective strategy can handle contexts with specified target contexts
   */
  canHandle(context: IPerformanceContext): boolean {
    return context && context.contexts !== undefined && context.contexts.length > 0;
  }

  /**
   * Execute selective discovery with REAL context filtering
   * CRITICAL: Only processes plugins/handlers for specified contexts
   */
  async optimize(context: IPerformanceContext): Promise<{
    handlers: HandlerInfo[];
    metrics: IPerformanceMetrics;
  }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    let handlers: HandlerInfo[] = [];
    let error: string | undefined;
    let contextsProcessed = 0;
    let pluginsSkipped = 0;

    try {
      // REAL WORK: Execute selective discovery through context filtering
      const result = await this.executeSelectiveDiscovery(context, startTime);
      handlers = result.handlers;
      contextsProcessed = result.contextsProcessed;
      pluginsSkipped = result.pluginsSkipped;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Selective discovery failed';
      console.error(`[SelectiveDiscoveryStrategy] Error: ${error}`);
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    // REAL METRICS: Actual timing and memory usage with context optimization info
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
        contextsRequested: context.contexts?.length || 0,
        contextsProcessed,
        pluginsSkipped,
        optimizationRatio:
          pluginsSkipped > 0 ? pluginsSkipped / context.discoveryPlugins.length : 0,
        avgHandlersPerContext: contextsProcessed > 0 ? handlers.length / contextsProcessed : 0,
      },
    };

    return { handlers, metrics };
  }

  /**
   * Execute selective discovery operations with context filtering
   * CRITICAL: Real context-based optimization, skips irrelevant plugins/handlers
   */
  private async executeSelectiveDiscovery(
    context: IPerformanceContext,
    _startTime: number
  ): Promise<{
    handlers: HandlerInfo[];
    contextsProcessed: number;
    pluginsSkipped: number;
  }> {
    const targetContexts = context.contexts || [];
    const allHandlers: HandlerInfo[] = [];
    let contextsProcessed = 0;
    let pluginsSkipped = 0;

    // Create timeout controller if timeout is specified
    const timeoutController = context.timeout ? new AbortController() : null;
    let timeoutId: NodeJS.Timeout | null = null;

    if (timeoutController && context.timeout) {
      timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, context.timeout);
    }

    try {
      // Context-based plugin filtering for enterprise optimization
      const contextSet = new Set(targetContexts);

      for (const plugin of context.discoveryPlugins) {
        try {
          // Check if already aborted
          if (timeoutController?.signal.aborted) {
            throw new Error(`Selective discovery timeout after ${context.timeout}ms`);
          }

          // OPTIMIZATION: Pre-filter plugins if they support context hints
          if (
            this.canSkipPlugin(
              plugin as IHandlerDiscoveryPlugin & { supportedContexts?: string[] },
              contextSet
            )
          ) {
            pluginsSkipped++;
            continue;
          }

          // REAL REFLECTION WORK: Execute discovery through plugin with timeout race
          const pluginPromise = plugin.discoverHandlers();
          const abortPromise = timeoutController
            ? new Promise<never>((_, reject) => {
                timeoutController.signal.addEventListener('abort', () => {
                  reject(new Error(`Selective discovery timeout after ${context.timeout}ms`));
                });
              })
            : Promise.resolve(null);

          const pluginHandlers = timeoutController
            ? await Promise.race([pluginPromise, abortPromise])
            : await pluginPromise;

          // Handle null response from abort promise
          if (pluginHandlers) {
            // SELECTIVE FILTERING: Only include handlers from target contexts
            const contextFilteredHandlers = this.filterHandlersByContexts(
              pluginHandlers,
              targetContexts
            );

            if (contextFilteredHandlers.length > 0) {
              allHandlers.push(...contextFilteredHandlers);
              contextsProcessed++;
            }
          }
        } catch (error) {
          console.warn(
            `[SelectiveDiscoveryStrategy] Plugin ${plugin.constructor.name} failed:`,
            error
          );
          // If it's a timeout error, propagate it up
          if (error instanceof Error && error.message.includes('timeout')) {
            throw error;
          }
          // Continue with other plugins for other errors (graceful degradation)
        }
      }
    } finally {
      // Cleanup timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    // Apply handler limit if specified (enterprise resource management)
    if (context.maxHandlers && allHandlers.length > context.maxHandlers) {
      console.warn(
        `[SelectiveDiscoveryStrategy] Handler limit reached: ${context.maxHandlers}, found: ${allHandlers.length}`
      );
      return {
        handlers: this.prioritizeHandlersByContext(
          allHandlers,
          targetContexts,
          context.maxHandlers
        ),
        contextsProcessed,
        pluginsSkipped,
      };
    }

    // Remove duplicates (enterprise requirement)
    return {
      handlers: this.removeDuplicateHandlers(allHandlers),
      contextsProcessed,
      pluginsSkipped,
    };
  }

  /**
   * Check if plugin can be skipped based on context hints
   * OPTIMIZATION: Avoid unnecessary reflection work
   */
  private canSkipPlugin(
    plugin: { supportedContexts?: string[] },
    targetContexts: Set<string>
  ): boolean {
    // If plugin provides context hints, use them for optimization
    if (plugin.supportedContexts && Array.isArray(plugin.supportedContexts)) {
      return !plugin.supportedContexts.some((ctx: string) => targetContexts.has(ctx));
    }

    // For testing and unknown plugins, always process them
    // Only skip plugins that explicitly declare supported contexts
    return false; // Conservative: process plugin by default to ensure correctness
  }

  /**
   * Filter handlers by specified contexts
   */
  private filterHandlersByContexts(handlers: HandlerInfo[], contexts: string[]): HandlerInfo[] {
    const contextSet = new Set(contexts);

    return handlers.filter(handler => {
      const metadata = handler.metadata as { context?: string } | undefined;

      // Include handler if:
      // 1. No context specified on handler (default handlers)
      // 2. Handler context matches one of target contexts
      // 3. Handler context is 'core' or 'common' (always include infrastructure)
      return (
        !metadata?.context ||
        contextSet.has(metadata.context) ||
        metadata.context === 'core' ||
        metadata.context === 'common'
      );
    });
  }

  /**
   * Prioritize handlers by context when applying limits
   * ENTERPRISE: Ensure critical contexts are preserved when limiting
   */
  private prioritizeHandlersByContext(
    handlers: HandlerInfo[],
    contexts: string[],
    maxHandlers: number
  ): HandlerInfo[] {
    const contextSet = new Set(contexts);
    const prioritized: HandlerInfo[] = [];

    // Priority 1: Core/common handlers
    const coreHandlers = handlers.filter(h => {
      const metadata = h.metadata as { context?: string } | undefined;
      return metadata?.context === 'core' || metadata?.context === 'common';
    });
    prioritized.push(...coreHandlers.slice(0, Math.floor(maxHandlers * 0.2))); // 20% for core

    // Priority 2: Target context handlers
    const contextHandlers = handlers.filter(h => {
      const metadata = h.metadata as { context?: string } | undefined;
      return metadata?.context && contextSet.has(metadata.context);
    });
    const remainingSlots = maxHandlers - prioritized.length;
    prioritized.push(...contextHandlers.slice(0, remainingSlots));

    return this.removeDuplicateHandlers(prioritized);
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
   * Validate strategy prerequisites
   */
  async validatePrerequisites(context: IPerformanceContext): Promise<boolean> {
    return (
      context.discoveryPlugins.length > 0 &&
      context.contexts !== undefined &&
      context.contexts.length > 0
    );
  }
}
