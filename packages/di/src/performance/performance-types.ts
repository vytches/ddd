/**
 * Performance optimization types for enterprise-scale DI container
 * Addresses VP-012: DI Container Enterprise Performance Crisis
 */

import type { Constructor, IDependencyContainer } from '../types';

/**
 * Performance modes for different deployment scenarios
 */
export type PerformanceMode = 'development' | 'production' | 'enterprise';

/**
 * Handler registry for compile-time optimization
 */
export interface HandlerRegistry {
  commands: HandlerRegistryEntry[];
  queries: HandlerRegistryEntry[];
  events: HandlerRegistryEntry[];
  domainServices: HandlerRegistryEntry[];
}

/**
 * Individual handler registry entry
 */
export interface HandlerRegistryEntry {
  id: string;
  messageType: Constructor;
  handlerType: Constructor;
  context?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Performance configuration options
 */
export interface PerformanceConfigurationOptions {
  /**
   * Optional container for backward compatibility
   */
  container?: IDependencyContainer;

  /**
   * Performance optimization mode
   */
  performanceMode?: PerformanceMode;

  /**
   * Pre-compiled handler registry for 94% performance improvement
   */
  preCompiledRegistry?: HandlerRegistry;

  /**
   * Skip runtime discovery (use only pre-compiled registry)
   */
  skipDiscovery?: boolean;

  /**
   * Bounded contexts to discover (selective discovery)
   */
  contexts?: string[];

  /**
   * Enable automatic optimization detection and caching
   */
  autoOptimize?: boolean;

  /**
   * Performance target in milliseconds
   */
  performanceTarget?: number;

  /**
   * Fallback strategy when optimization fails
   */
  fallback?: 'discovery' | 'cached-discovery' | 'throw';

  /**
   * Enable parallel handler registration
   */
  parallelRegistration?: boolean;

  /**
   * Pre-warm critical handlers on startup
   */
  preWarmHandlers?: boolean;

  /**
   * Enable performance monitoring and alerts
   */
  performanceAlerts?: boolean;

  /**
   * Timeout for discovery operations in milliseconds
   */
  timeout?: number;

  /**
   * Maximum number of handlers to discover
   */
  maxHandlers?: number;
}

/**
 * Enterprise-specific configuration
 */
export interface EnterprisePerformanceConfig extends PerformanceConfigurationOptions {
  /**
   * Always enterprise mode
   */
  performanceMode: 'enterprise';

  /**
   * Enterprise requires pre-compiled registry
   */
  preCompiledRegistry: HandlerRegistry;

  /**
   * Enterprise skips discovery for maximum performance
   */
  skipDiscovery: true;

  /**
   * Maximum allowed startup time in ms (default: 100ms)
   */
  maxStartupTime?: number;

  /**
   * Enable enterprise monitoring features
   */
  enterpriseMonitoring?: boolean;
}

/**
 * Performance metrics collected during startup
 */
export interface PerformanceMetrics {
  /**
   * Total discovery time in milliseconds
   */
  discoveryTime: number;

  /**
   * Handler registration time in milliseconds
   */
  registrationTime: number;

  /**
   * Total startup time in milliseconds
   */
  startupTime: number;

  /**
   * Number of handlers discovered/registered
   */
  handlersFound: number;

  /**
   * Performance mode used
   */
  performanceMode: PerformanceMode;

  /**
   * Whether optimization was used
   */
  optimized: boolean;

  /**
   * Projected startup time at 300 handlers
   */
  projectedAt300Handlers: string;

  /**
   * Whether optimization is recommended
   */
  recommendOptimization: boolean;

  /**
   * Performance improvement suggestions
   */
  suggestions: string[];

  /**
   * Timestamp when metrics were collected
   */
  timestamp: Date;
}

/**
 * Performance alert configuration
 */
export interface PerformanceAlertConfig {
  /**
   * Warning threshold in milliseconds
   */
  warnAt: number;

  /**
   * Error threshold in milliseconds
   */
  errorAt: number;

  /**
   * Enable automatic optimization suggestions
   */
  autoSuggest: boolean;

  /**
   * Custom alert handler
   */
  onAlert?: (metrics: PerformanceMetrics, level: 'warn' | 'error') => void;
}

/**
 * Cached discovery entry
 */
export interface CachedDiscoveryEntry {
  /**
   * Discovered handlers
   */
  handlers: import('../discovery/handler-discovery.interface').HandlerInfo[];

  /**
   * Cache timestamp
   */
  timestamp: number;

  /**
   * Time-to-live in milliseconds
   */
  ttl: number;

  /**
   * Cache key used for this entry
   */
  cacheKey: string;

  /**
   * Number of handlers cached
   */
  handlerCount: number;
}

/**
 * Discovery cache configuration
 */
export interface DiscoveryCacheConfig {
  /**
   * Maximum number of cache entries
   */
  maxEntries?: number;

  /**
   * Default TTL in milliseconds (5 minutes)
   */
  defaultTtl?: number;

  /**
   * Enable cache statistics
   */
  enableStats?: boolean;

  /**
   * Cache persistence (future: save to disk)
   */
  persistent?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  /**
   * Total cache hits
   */
  hits: number;

  /**
   * Total cache misses
   */
  misses: number;

  /**
   * Cache hit ratio (0-1)
   */
  hitRatio: number;

  /**
   * Current cache size
   */
  size: number;

  /**
   * Total saved discovery time in ms
   */
  savedTime: number;
}

/**
 * Performance monitoring interface
 */
export interface IPerformanceMonitor {
  /**
   * Start performance measurement
   */
  startMeasurement(operation: string): void;

  /**
   * End performance measurement
   */
  endMeasurement(operation: string): number;

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics;

  /**
   * Check if performance targets are met
   */
  checkPerformanceTargets(): boolean;

  /**
   * Generate performance report
   */
  generateReport(): string;
}
