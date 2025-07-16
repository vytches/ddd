/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Constructor } from '../types';

/**
 * @llm-summary Contract for handler info functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * HandlerInfo interface implementing infrastructure service for handler info operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteHandlerInfo implements HandlerInfo {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for handler discovery plugin functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * HandlerDiscoveryPlugin interface implementing infrastructure service for handler discovery plugin operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteHandlerDiscoveryPlugin implements IHandlerDiscoveryPlugin {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary Contract for handler discovery registry functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * HandlerDiscoveryRegistry interface implementing infrastructure service for handler discovery registry operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteHandlerDiscoveryRegistry implements IHandlerDiscoveryRegistry {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
