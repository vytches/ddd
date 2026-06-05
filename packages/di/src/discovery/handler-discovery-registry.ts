import { internalLogger } from '@vytches/ddd-contracts';
import type {
  HandlerInfo,
  IHandlerDiscoveryPlugin,
  IHandlerDiscoveryRegistry,
} from './handler-discovery.interface';

export class HandlerDiscoveryRegistry implements IHandlerDiscoveryRegistry {
  private plugins = new Map<string, IHandlerDiscoveryPlugin>();

  /**
   * Register a discovery plugin
   */
  registerPlugin(plugin: IHandlerDiscoveryPlugin): void {
    if (plugin.isAvailable()) {
      this.plugins.set(plugin.name, plugin);
    }
  }

  /**
   * Discover handlers from all registered plugins
   */
  async discoverAllHandlers(assemblies?: unknown[]): Promise<HandlerInfo[]> {
    const allHandlers: HandlerInfo[] = [];

    for (const [name, plugin] of this.plugins) {
      try {
        const handlers = await plugin.discoverHandlers(assemblies);
        allHandlers.push(...handlers);
      } catch (error) {
        internalLogger.warn('HandlerDiscoveryRegistry: plugin failed to discover handlers', {
          pluginName: name,
          error: String(error),
        });
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
   * Get a specific plugin by name
   */
  getPlugin(name: string): IHandlerDiscoveryPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Clear all registered plugins (useful for testing)
   */
  clear(): void {
    this.plugins.clear();
  }
}
