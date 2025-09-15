/**
 * VP-012: Pre-Compiled Registry Strategy - Enterprise Zero-Discovery Mode
 * Eliminates performance theater with real pre-compiled handler registry
 */

import type { HandlerInfo } from '../../discovery/handler-discovery.interface';
import type {
  IPerformanceContext,
  IPerformanceMetrics,
  IPerformanceStrategy,
} from '../abstractions/performance-strategy.interface';
import type { HandlerRegistry } from '../performance-types';

/**
 * Pre-compiled registry strategy using zero-discovery approach
 * OPTIMIZATION: Uses compile-time generated handler registry to skip all runtime discovery
 */
export class PreCompiledRegistryStrategy implements IPerformanceStrategy {
  readonly strategyId = 'pre-compiled-registry';
  readonly displayName = 'Pre-Compiled Registry';
  readonly description =
    'Zero-discovery enterprise mode - uses compile-time generated handler registry for maximum performance';

  /**
   * Pre-compiled strategy requires skipDiscovery and valid registry
   */
  canHandle(context: IPerformanceContext): boolean {
    return (
      context.skipDiscovery === true &&
      context.preCompiledRegistry != null &&
      this.validateRegistryStructure(context.preCompiledRegistry)
    );
  }

  /**
   * Execute pre-compiled registry loading with ZERO discovery work
   * CRITICAL: No reflection, no plugin execution - pure registry transformation
   */
  async optimize(context: IPerformanceContext): Promise<{
    handlers: HandlerInfo[];
    metrics: IPerformanceMetrics;
  }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    let handlers: HandlerInfo[] = [];
    let error: string | undefined;
    let registryStats: RegistryStatistics = {
      totalEntries: 0,
      commandEntries: 0,
      queryEntries: 0,
      eventEntries: 0,
      serviceEntries: 0,
      contextDistribution: new Map(),
    };

    try {
      // ZERO DISCOVERY: Transform pre-compiled registry to handlers
      const result = await this.transformRegistryToHandlers(context);
      handlers = result.handlers;
      registryStats = result.stats;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Pre-compiled registry processing failed';
      console.error(`[PreCompiledRegistryStrategy] Error: ${error}`);
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    // REAL METRICS: Actual transformation timing (should be extremely fast)
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
        registryTransformation: 'pre-compiled',
        totalRegistryEntries: registryStats.totalEntries,
        handlerTypeDistribution: {
          commands: registryStats.commandEntries,
          queries: registryStats.queryEntries,
          events: registryStats.eventEntries,
          services: registryStats.serviceEntries,
        },
        contextDistribution: Object.fromEntries(registryStats.contextDistribution),
        discoverySkipped: true,
        pluginsSkipped: context.discoveryPlugins.length,
        performanceGain: 'maximum', // Pre-compiled is always maximum performance
      },
    };

    return { handlers, metrics };
  }

  /**
   * Validate registry structure before processing
   */
  private validateRegistryStructure(registry: any): boolean {
    try {
      const handlerRegistry = registry as HandlerRegistry;

      return (
        Array.isArray(handlerRegistry.commands) &&
        Array.isArray(handlerRegistry.queries) &&
        Array.isArray(handlerRegistry.events) &&
        Array.isArray(handlerRegistry.domainServices)
      );
    } catch {
      return false;
    }
  }

  /**
   * Transform pre-compiled registry to HandlerInfo array
   * ENTERPRISE: Pure data transformation, no reflection or plugin execution
   */
  private async transformRegistryToHandlers(context: IPerformanceContext): Promise<{
    handlers: HandlerInfo[];
    stats: RegistryStatistics;
  }> {
    const registry = context.preCompiledRegistry as HandlerRegistry;
    const allHandlers: HandlerInfo[] = [];
    const stats: RegistryStatistics = {
      totalEntries: 0,
      commandEntries: 0,
      queryEntries: 0,
      eventEntries: 0,
      serviceEntries: 0,
      contextDistribution: new Map(),
    };

    // Validate registry structure before processing
    if (!registry || typeof registry !== 'object') {
      throw new Error('Invalid registry structure');
    }

    // Transform command entries (handle invalid arrays gracefully)
    if (Array.isArray(registry.commands)) {
      for (const entry of registry.commands) {
        const handler = this.transformRegistryEntryToHandler(entry, 'command');
        if (handler) {
          allHandlers.push(handler);
          stats.commandEntries++;
          this.updateContextStats(stats, handler);
        }
      }
    } else if (registry.commands !== undefined) {
      throw new Error('Invalid registry structure: commands must be an array');
    }

    // Transform query entries (handle invalid arrays gracefully)
    if (Array.isArray(registry.queries)) {
      for (const entry of registry.queries) {
        const handler = this.transformRegistryEntryToHandler(entry, 'query');
        if (handler) {
          allHandlers.push(handler);
          stats.queryEntries++;
          this.updateContextStats(stats, handler);
        }
      }
    } else if (registry.queries !== undefined) {
      throw new Error('Invalid registry structure: queries must be an array');
    }

    // Transform event entries (handle invalid arrays gracefully)
    if (Array.isArray(registry.events)) {
      for (const entry of registry.events) {
        const handler = this.transformRegistryEntryToHandler(entry, 'event');
        if (handler) {
          allHandlers.push(handler);
          stats.eventEntries++;
          this.updateContextStats(stats, handler);
        }
      }
    } else if (registry.events !== undefined) {
      throw new Error('Invalid registry structure: events must be an array');
    }

    // Transform domain service entries (handle invalid arrays gracefully)
    if (Array.isArray(registry.domainServices)) {
      for (const entry of registry.domainServices) {
        const handler = this.transformRegistryEntryToHandler(entry, 'domain-service');
        if (handler) {
          allHandlers.push(handler);
          stats.serviceEntries++;
          this.updateContextStats(stats, handler);
        }
      }
    } else if (registry.domainServices !== undefined) {
      throw new Error('Invalid registry structure: domainServices must be an array');
    }

    stats.totalEntries = allHandlers.length;

    // Apply context filtering if specified (enterprise requirement)
    let filteredHandlers = allHandlers;
    if (context.contexts && context.contexts.length > 0) {
      filteredHandlers = this.filterHandlersByContexts(allHandlers, context.contexts);
    }

    // Apply handler limit if specified (enterprise resource management)
    if (context.maxHandlers && filteredHandlers.length > context.maxHandlers) {
      console.warn(
        `[PreCompiledRegistryStrategy] Handler limit reached: ${context.maxHandlers}, found: ${filteredHandlers.length}`
      );
      filteredHandlers = this.prioritizeHandlersByImportance(filteredHandlers, context.maxHandlers);
    }

    // No need to remove duplicates - pre-compiled registry should be clean
    // But add validation to ensure quality
    const finalHandlers = this.validateAndCleanHandlers(filteredHandlers);

    return {
      handlers: finalHandlers,
      stats,
    };
  }

  /**
   * Transform single registry entry to HandlerInfo
   */
  private transformRegistryEntryToHandler(
    entry: any,
    type: 'command' | 'query' | 'event' | 'domain-service'
  ): HandlerInfo | null {
    try {
      // Validate entry structure
      if (!entry.messageType || !entry.handlerType) {
        console.warn(
          `[PreCompiledRegistryStrategy] Invalid registry entry missing messageType or handlerType`
        );
        return null;
      }

      return {
        type,
        messageType: entry.messageType,
        handlerType: entry.handlerType,
        metadata: {
          ...entry.metadata,
          preCompiled: true,
          registryId: entry.id,
          source: 'pre-compiled-registry',
        },
      };
    } catch (error) {
      console.warn(`[PreCompiledRegistryStrategy] Failed to transform registry entry:`, error);
      return null;
    }
  }

  /**
   * Update context distribution statistics
   */
  private updateContextStats(stats: RegistryStatistics, handler: HandlerInfo): void {
    const metadata = handler.metadata as { context?: string } | undefined;
    const context = metadata?.context || 'default';

    const current = stats.contextDistribution.get(context) || 0;
    stats.contextDistribution.set(context, current + 1);
  }

  /**
   * Filter handlers by specified contexts
   */
  private filterHandlersByContexts(handlers: HandlerInfo[], contexts: string[]): HandlerInfo[] {
    const contextSet = new Set(contexts);

    return handlers.filter(handler => {
      const metadata = handler.metadata as { context?: string } | undefined;

      // Include handler if:
      // 1. No context specified (default handlers)
      // 2. Handler context matches target contexts
      // 3. Core/common handlers (always included)
      return (
        !metadata?.context ||
        contextSet.has(metadata.context) ||
        metadata.context === 'core' ||
        metadata.context === 'common'
      );
    });
  }

  /**
   * Prioritize handlers when applying limits (enterprise requirement)
   */
  private prioritizeHandlersByImportance(
    handlers: HandlerInfo[],
    maxHandlers: number
  ): HandlerInfo[] {
    // Priority system for enterprise environments
    const priorityGroups = {
      core: handlers.filter(h => {
        const metadata = h.metadata as { context?: string } | undefined;
        return metadata?.context === 'core';
      }),
      commands: handlers.filter(h => h.type === 'command'),
      queries: handlers.filter(h => h.type === 'query'),
      events: handlers.filter(h => h.type === 'event'),
      services: handlers.filter(h => h.type === 'domain-service'),
    };

    const prioritized: HandlerInfo[] = [];
    const seen = new Set<string>();

    // Add handlers by priority, avoiding duplicates
    const addHandlers = (handlers: HandlerInfo[], limit: number) => {
      for (const handler of handlers) {
        if (prioritized.length >= maxHandlers) break;

        const key = `${handler.type}:${handler.messageType?.name}:${handler.handlerType?.name}`;
        if (!seen.has(key)) {
          prioritized.push(handler);
          seen.add(key);
        }
      }
    };

    // Priority order: core > commands > queries > events > services
    addHandlers(priorityGroups.core, Math.ceil(maxHandlers * 0.1)); // 10% for core
    addHandlers(priorityGroups.commands, Math.ceil(maxHandlers * 0.3)); // 30% for commands
    addHandlers(priorityGroups.queries, Math.ceil(maxHandlers * 0.25)); // 25% for queries
    addHandlers(priorityGroups.events, Math.ceil(maxHandlers * 0.25)); // 25% for events
    addHandlers(priorityGroups.services, Math.ceil(maxHandlers * 0.1)); // 10% for services

    return prioritized.slice(0, maxHandlers);
  }

  /**
   * Validate and clean handler list
   */
  private validateAndCleanHandlers(handlers: HandlerInfo[]): HandlerInfo[] {
    const validHandlers: HandlerInfo[] = [];
    const seen = new Set<string>();

    for (const handler of handlers) {
      // Validate handler structure
      if (!handler.messageType || !handler.handlerType) {
        console.warn(`[PreCompiledRegistryStrategy] Invalid handler structure, skipping`);
        continue;
      }

      // Remove duplicates (safety check for pre-compiled registry quality)
      const key = `${handler.type}:${handler.messageType.name}:${handler.handlerType.name}`;
      if (seen.has(key)) {
        console.warn(
          `[PreCompiledRegistryStrategy] Duplicate handler detected in registry: ${key}`
        );
        continue;
      }

      validHandlers.push(handler);
      seen.add(key);
    }

    return validHandlers;
  }

  /**
   * Validate strategy prerequisites
   */
  async validatePrerequisites(context: IPerformanceContext): Promise<boolean> {
    return (
      context.skipDiscovery === true &&
      context.preCompiledRegistry != null &&
      this.validateRegistryStructure(context.preCompiledRegistry)
    );
  }
}

// Supporting types for registry processing
interface RegistryStatistics {
  totalEntries: number;
  commandEntries: number;
  queryEntries: number;
  eventEntries: number;
  serviceEntries: number;
  contextDistribution: Map<string, number>;
}
