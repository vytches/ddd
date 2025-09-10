/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/**
 * Plugin-Based Discovery Registry
 *
 * Coordinates discovery across all VytchesDDD packages while maintaining
 * bounded context isolation and DDD principles.
 */

import type { IDependencyContainer } from '../types';

// Type alias for backward compatibility
type IContainer = IDependencyContainer;

/**
 * Discovery plugin interface for package-specific discovery
 */
export interface IDiscoveryPlugin {
  /**
   * Unique name for this plugin
   */
  readonly name: string;

  /**
   * Package this plugin discovers from
   */
  readonly packageName: string;

  /**
   * Priority for discovery execution (lower = earlier)
   */
  readonly priority: number;

  /**
   * Check if this plugin's package is available
   */
  isAvailable(): boolean;

  /**
   * Discover components in the given context
   */
  discoverInContext(
    contextName: string,
    modules: unknown[],
    container: IContainer
  ): Promise<DiscoveryResult>;

  /**
   * Validate discovered components
   */
  validate(results: DiscoveryResult): ValidationResult;
}

/**
 * Result of discovery operation
 */
export interface DiscoveryResult {
  contextName: string;
  pluginName: string;
  componentsFound: number;
  components: DiscoveredComponent[];
  errors?: string[];
}

/**
 * Individual discovered component
 */
export interface DiscoveredComponent {
  id: string;
  type: string;
  contextName: string;
  metadata: Record<string, unknown>;
  constructor?: Function;
}

/**
 * Validation result for discovered components
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Configuration for discovery registry
 */
export interface DiscoveryRegistryConfig {
  /**
   * Enable automatic discovery on module initialization
   */
  autoDiscover?: boolean;

  /**
   * Enable parallel discovery for better performance
   */
  parallel?: boolean;

  /**
   * Maximum time for discovery per plugin (ms)
   */
  timeout?: number;

  /**
   * Enable detailed logging
   */
  debug?: boolean;

  /**
   * Context access matrix for validation
   */
  accessMatrix?: Record<string, string[]>;
}

/**
 * Central registry for coordinating discovery across packages
 */
export class DiscoveryRegistry {
  private readonly plugins = new Map<string, IDiscoveryPlugin>();
  private readonly contextPlugins = new Map<string, Set<IDiscoveryPlugin>>();
  private readonly discoveryResults = new Map<string, DiscoveryResult[]>();

  constructor(private readonly config: DiscoveryRegistryConfig = {}) {}

  /**
   * Register a discovery plugin
   */
  registerPlugin(plugin: IDiscoveryPlugin): void {
    if (!plugin.isAvailable()) {
      if (this.config.debug) {
        console.log(`Plugin ${plugin.name} not available (package not installed)`);
      }
      return;
    }

    this.plugins.set(plugin.name, plugin);

    if (this.config.debug) {
      console.log(`Registered discovery plugin: ${plugin.name}`);
    }
  }

  /**
   * Register multiple plugins at once
   */
  registerPlugins(plugins: IDiscoveryPlugin[]): void {
    // Sort by priority for execution order
    const sorted = [...plugins].sort((a, b) => a.priority - b.priority);

    for (const plugin of sorted) {
      this.registerPlugin(plugin);
    }
  }

  /**
   * Discover components for a specific context
   */
  async discoverForContext(
    contextName: string,
    modules: unknown[],
    container: IContainer
  ): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];
    const plugins = this.getPluginsForContext(contextName);

    if (this.config.parallel) {
      // Parallel discovery with timeout
      const promises = Array.from(plugins).map(plugin =>
        this.discoverWithTimeout(plugin, contextName, modules, container)
      );

      const settled = await Promise.allSettled(promises);

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else if (this.config.debug) {
          console.error(`Discovery failed for plugin:`, result.reason);
        }
      }
    } else {
      // Sequential discovery
      for (const plugin of plugins) {
        try {
          const result = await plugin.discoverInContext(contextName, modules, container);
          results.push(result);
        } catch (error) {
          if (this.config.debug) {
            console.error(`Discovery failed for ${plugin.name}:`, error);
          }
        }
      }
    }

    // Store results for later access
    this.discoveryResults.set(contextName, results);

    // Validate discovered components
    this.validateDiscoveryResults(contextName, results);

    return results;
  }

  /**
   * Discover across all registered contexts
   */
  async discoverAll(
    contexts: Map<string, unknown[]>,
    container: IContainer
  ): Promise<Map<string, DiscoveryResult[]>> {
    const allResults = new Map<string, DiscoveryResult[]>();

    for (const [contextName, modules] of contexts) {
      const results = await this.discoverForContext(contextName, modules, container);
      allResults.set(contextName, results);
    }

    return allResults;
  }

  /**
   * Get discovery results for a context
   */
  getResultsForContext(contextName: string): DiscoveryResult[] | undefined {
    return this.discoveryResults.get(contextName);
  }

  /**
   * Get all discovery results
   */
  getAllResults(): Map<string, DiscoveryResult[]> {
    return new Map(this.discoveryResults);
  }

  /**
   * Clear all discovery results
   */
  clearResults(): void {
    this.discoveryResults.clear();
  }

  /**
   * Get plugins that should run for a context
   */
  private getPluginsForContext(contextName: string): IDiscoveryPlugin[] {
    // For now, all plugins run for all contexts
    // Can be enhanced to filter based on context configuration
    return Array.from(this.plugins.values());
  }

  /**
   * Discover with timeout protection
   */
  private async discoverWithTimeout(
    plugin: IDiscoveryPlugin,
    contextName: string,
    modules: unknown[],
    container: IContainer
  ): Promise<DiscoveryResult> {
    const timeout = this.config.timeout || 5000;

    return Promise.race([
      plugin.discoverInContext(contextName, modules, container),
      new Promise<DiscoveryResult>((_, reject) =>
        setTimeout(() => reject(new Error(`Discovery timeout for ${plugin.name}`)), timeout)
      ),
    ]);
  }

  /**
   * Validate discovery results against access matrix
   */
  private validateDiscoveryResults(contextName: string, results: DiscoveryResult[]): void {
    if (!this.config.accessMatrix) {
      return;
    }

    const allowedContexts = this.config.accessMatrix[contextName] || [];

    for (const result of results) {
      // Validate each plugin's results
      const validation = this.plugins.get(result.pluginName)?.validate(result);

      if (validation && !validation.valid) {
        console.warn(
          `Validation failed for ${result.pluginName} in ${contextName}:`,
          validation.errors
        );
      }

      // Check for cross-context references
      for (const component of result.components) {
        const metadata = component.metadata;

        // Check if component references other contexts
        if (metadata.dependencies) {
          const deps = metadata.dependencies as string[];
          for (const dep of deps) {
            const depContext = this.extractContextFromDependency(dep);
            if (depContext && !allowedContexts.includes(depContext)) {
              console.warn(
                `Context ${contextName} references ${depContext} which is not in access matrix`
              );
            }
          }
        }
      }
    }
  }

  /**
   * Extract context name from dependency string
   */
  private extractContextFromDependency(dependency: string): string | null {
    // Simple heuristic - can be enhanced
    const match = dependency.match(/^([A-Z][a-zA-Z]+)Service/);
    return match ? `${match[1]}Management` : null;
  }

  /**
   * Get summary statistics
   */
  getSummary(): DiscoverySummary {
    const summary: DiscoverySummary = {
      totalPlugins: this.plugins.size,
      totalContexts: this.discoveryResults.size,
      totalComponents: 0,
      byPlugin: {},
      byContext: {},
    };

    for (const [contextName, results] of this.discoveryResults) {
      let contextTotal = 0;

      for (const result of results) {
        contextTotal += result.componentsFound;
        summary.totalComponents += result.componentsFound;

        // By plugin stats
        if (!summary.byPlugin[result.pluginName]) {
          summary.byPlugin[result.pluginName] = 0;
        }
        summary.byPlugin[result.pluginName]! += result.componentsFound;
      }

      summary.byContext[contextName] = contextTotal;
    }

    return summary;
  }
}

/**
 * Discovery summary statistics
 */
export interface DiscoverySummary {
  totalPlugins: number;
  totalContexts: number;
  totalComponents: number;
  byPlugin: Record<string, number>;
  byContext: Record<string, number>;
}

/**
 * Factory for creating pre-configured registries
 */
export class DiscoveryRegistryFactory {
  /**
   * Create registry with standard VytchesDDD plugins
   */
  static createStandard(config?: DiscoveryRegistryConfig): DiscoveryRegistry {
    const registry = new DiscoveryRegistry(config);

    // These would be imported from respective packages
    // For now, showing the pattern
    const standardPlugins: IDiscoveryPlugin[] = [
      // new CQRSDiscoveryPlugin(),
      // new ACLDiscoveryPlugin(),
      // new EventDiscoveryPlugin(),
      // new DomainServiceDiscoveryPlugin(),
      // new PolicyDiscoveryPlugin(),
      // new SagaDiscoveryPlugin()
    ];

    registry.registerPlugins(standardPlugins);
    return registry;
  }

  /**
   * Create minimal registry for testing
   */
  static createMinimal(config?: DiscoveryRegistryConfig): DiscoveryRegistry {
    return new DiscoveryRegistry({
      ...config,
      autoDiscover: false,
      parallel: false,
    });
  }

  /**
   * Create high-performance registry
   */
  static createPerformance(config?: DiscoveryRegistryConfig): DiscoveryRegistry {
    return new DiscoveryRegistry({
      ...config,
      parallel: true,
      timeout: 2000,
      debug: false,
    });
  }
}
