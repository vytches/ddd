/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Constructor } from '../types';

export interface HandlerInfo {
  /** Handler type (command/query/event/domain-service) */
  type: 'command' | 'query' | 'event' | 'domain-service';

  /** Message type constructor (for handlers) or service constructor (for domain services) */
  messageType: Constructor;

  /** Handler constructor */
  handlerType: Constructor;

  /** DI metadata from decorator */
  metadata: unknown;
}

export interface IHandlerDiscoveryPlugin {
  /**
   * Plugin name for identification
   */
  readonly name: string;

  /**
   * Discover handlers from the plugin's domain
   * @param assemblies - Optional assemblies to scan
   * @returns Array of discovered handlers
   */
  discoverHandlers(assemblies?: unknown[]): Promise<HandlerInfo[]> | HandlerInfo[];

  /**
   * Check if the plugin is available (dependencies installed)
   * @returns True if plugin can be used
   */
  isAvailable(): boolean;
}

export interface IHandlerDiscoveryRegistry {
  /**
   * Register a discovery plugin
   * @param plugin - The plugin to register
   */
  registerPlugin(plugin: IHandlerDiscoveryPlugin): void;

  /**
   * Discover handlers from all registered plugins
   * @param assemblies - Optional assemblies to scan
   * @returns Array of all discovered handlers
   */
  discoverAllHandlers(assemblies?: unknown[]): Promise<HandlerInfo[]>;

  /**
   * Get all registered plugins
   * @returns Array of plugin names
   */
  getRegisteredPlugins(): string[];
}
