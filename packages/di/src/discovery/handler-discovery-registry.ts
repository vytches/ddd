import { Logger } from '@vytches/ddd-logging';
import type {
  HandlerInfo,
  IHandlerDiscoveryPlugin,
  IHandlerDiscoveryRegistry,
} from './handler-discovery.interface';

export class HandlerDiscoveryRegistry implements IHandlerDiscoveryRegistry {
  private readonly logger = Logger.forContext('HandlerDiscoveryRegistry');
  private plugins = new Map<string, IHandlerDiscoveryPlugin>();

  /**
   * Register a discovery plugin
   */
  registerPlugin(plugin: IHandlerDiscoveryPlugin): void {
    if (plugin.isAvailable()) {
      this.plugins.set(plugin.name, plugin);
      this.logger.debug('Registered handler discovery plugin', { pluginName: plugin.name });
    } else {
      this.logger.debug('Plugin not available, skipping registration', { pluginName: plugin.name });
    }
  }

  /**
   * Discover handlers from all registered plugins
   */
  async discoverAllHandlers(assemblies?: unknown[]): Promise<HandlerInfo[]> {
    const allHandlers: HandlerInfo[] = [];

    for (const [name, plugin] of this.plugins) {
      try {
        this.logger.debug('Discovering handlers with plugin', { pluginName: name });
        const handlers = await plugin.discoverHandlers(assemblies);
        allHandlers.push(...handlers);
        this.logger.debug('Plugin discovered handlers', {
          pluginName: name,
          handlerCount: handlers.length,
        });
      } catch (error) {
        this.logger.warn('Plugin failed to discover handlers', {
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
