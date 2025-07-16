import type {
  HandlerInfo,
  IHandlerDiscoveryPlugin,
  IHandlerDiscoveryRegistry,
} from './handler-discovery.interface';

/**
 * @llm-summary HandlerDiscoveryRegistry class for handler discovery registry operations
 * @llm-domain Infrastructure
 * @llm-complexity Simple
 *
 * @description
 * HandlerDiscoveryRegistry class implementing infrastructure service for handler discovery registry operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new HandlerDiscoveryRegistry();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new HandlerDiscoveryRegistry());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class HandlerDiscoveryRegistry implements IHandlerDiscoveryRegistry {
  private plugins = new Map<string, IHandlerDiscoveryPlugin>();

  /**
   * Register a discovery plugin
   */
  registerPlugin(plugin: IHandlerDiscoveryPlugin): void {
    if (plugin.isAvailable()) {
      this.plugins.set(plugin.name, plugin);
      console.debug(`Registered handler discovery plugin: ${plugin.name}`);
    } else {
      console.debug(`Plugin ${plugin.name} not available, skipping registration`);
    }
  }

  /**
   * Discover handlers from all registered plugins
   */
  async discoverAllHandlers(assemblies?: any[]): Promise<HandlerInfo[]> {
    const allHandlers: HandlerInfo[] = [];

    for (const [name, plugin] of this.plugins) {
      try {
        console.debug(`Discovering handlers with plugin: ${name}`);
        const handlers = await plugin.discoverHandlers(assemblies);
        allHandlers.push(...handlers);
        console.debug(`Plugin ${name} discovered ${handlers.length} handlers`);
      } catch (error) {
        console.warn(`Plugin ${name} failed to discover handlers:`, error);
      }
    }

    return allHandlers;
  }

  /**
   * Get all registered plugins
   */
  getRegisteredPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Clear all registered plugins (useful for testing)
   */
  clear(): void {
    this.plugins.clear();
  }
}
