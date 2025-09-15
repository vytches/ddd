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
