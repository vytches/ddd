/**
 * VP-012: Performance Strategy Interface - SOLID Architecture
 * Eliminates performance theater with real strategy implementations
 */

import type {
  HandlerInfo,
  IHandlerDiscoveryPlugin,
} from '../../discovery/handler-discovery.interface';
import type { IDependencyContainer } from '../../types';

/**
 * Performance optimization context for strategy execution
 */
export interface IPerformanceContext {
  /** Container being optimized */
  readonly container: IDependencyContainer;

  /** Available discovery plugins */
  readonly discoveryPlugins: IHandlerDiscoveryPlugin[];

  /** Target contexts for selective discovery */
  readonly contexts?: string[] | undefined;

  /** Performance mode configuration */
  readonly performanceMode: 'development' | 'production' | 'enterprise';

  /** Timeout for operations (ms) */
  readonly timeout?: number | undefined;

  /** Maximum handlers to process */
  readonly maxHandlers?: number | undefined;

  /** Enable parallel processing */
  readonly parallelProcessing?: boolean | undefined;

  /** Pre-compiled registry for optimization */
  readonly preCompiledRegistry?: any | undefined;

  /** Skip runtime discovery */
  readonly skipDiscovery?: boolean | undefined;

  /** VP-012 Phase 4: Observability tracking fields */
  readonly correlationId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly userId?: string | undefined;
  readonly tenantId?: string | undefined;
}

/**
 * Real performance metrics (not artificial theater)
 */
export interface IPerformanceMetrics {
  /** Actual discovery time in milliseconds */
  readonly discoveryTime: number;

  /** Number of handlers found */
  readonly handlersFound: number;

  /** Memory usage in bytes */
  readonly memoryUsage: number;

  /** Strategy used for optimization */
  readonly strategyUsed: string;

  /** Timestamp of measurement */
  readonly timestamp: Date;

  /** Success/failure status */
  readonly success: boolean;

  /** Error details if failed */
  readonly error?: string | undefined;

  /** Additional context metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Performance optimization strategy interface
 * Implements Strategy Pattern for enterprise-grade performance
 */
export interface IPerformanceStrategy {
  /** Unique strategy identifier */
  readonly strategyId: string;

  /** Human-readable strategy name */
  readonly displayName: string;

  /** Strategy description */
  readonly description: string;

  /**
   * Check if strategy is applicable for given context
   */
  canHandle(context: IPerformanceContext): boolean;

  /**
   * Execute performance optimization strategy
   * CRITICAL: Must perform REAL work, no artificial timing
   */
  optimize(context: IPerformanceContext): Promise<{
    handlers: HandlerInfo[];
    metrics: IPerformanceMetrics;
  }>;

  /**
   * Get strategy-specific configuration options
   */
  getConfigurationOptions?(): Record<string, unknown>;

  /**
   * Validate strategy prerequisites
   */
  validatePrerequisites?(context: IPerformanceContext): Promise<boolean>;
}

/**
 * Strategy factory interface for creating optimization strategies
 */
export interface IPerformanceStrategyFactory {
  /**
   * Create strategy instance
   */
  createStrategy(strategyId: string, config?: Record<string, unknown>): IPerformanceStrategy | null;

  /**
   * Get all available strategy IDs
   */
  getAvailableStrategies(): string[];

  /**
   * Get strategy metadata
   */
  getStrategyMetadata(strategyId: string): {
    displayName: string;
    description: string;
    requirements: string[];
    capabilities: string[];
  } | null;
}
