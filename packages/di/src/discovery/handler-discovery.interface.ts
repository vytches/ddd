/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Constructor } from '../types';

/**
 * Information about a discovered handler for DI registration
 */
export interface HandlerInfo {
  /** Handler type (command/query/event/domain-service) */
  type: 'command' | 'query' | 'event' | 'domain-service';

  /** Message type constructor (for handlers) or service constructor (for domain services) */
  messageType: Constructor;

  /** Handler constructor */
  handlerType: Constructor;

  /** DI metadata from decorator */
  metadata: any;
}

/**
 * Plugin interface for discovering handlers in specific packages
 */
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
  discoverHandlers(assemblies?: any[]): Promise<HandlerInfo[]> | HandlerInfo[];

  /**
   * Check if the plugin is available (dependencies installed)
   * @returns True if plugin can be used
   */
  isAvailable(): boolean;
}

/**
 * Registry for handler discovery plugins
 */
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
  discoverAllHandlers(assemblies?: any[]): Promise<HandlerInfo[]>;

  /**
   * Get all registered plugins
   * @returns Array of plugin names
   */
  getRegisteredPlugins(): string[];
}
