import type { ModuleMetadata, Provider } from '@nestjs/common';
import type {
  HandlerInfo,
  HandlerRegistry,
  PerformanceConfigurationOptions,
  PerformanceMetrics,
  PerformanceMode,
  PerformanceOptimizer,
} from '@vytches/ddd-di';

// Re-export dla wygody - VP-012 Enhanced
export type { HandlerInfo, PerformanceMetrics, PerformanceMode, PerformanceOptimizer };

/**
 * Configuration options for VytchesDDD module
 *
 * Simple interface supporting custom provider configuration
 * like IEventBus => UnifiedEventBus mapping
 */
export interface VytchesDDDModuleOptions {
  /**
   * Custom providers for dependency injection
   *
   * @example
   * ```typescript
   * {
   *   providers: [
   *     { provide: ICommandBus, useClass: EnhancedCommandBus },
   *     { provide: IQueryBus, useClass: EnhancedQueryBus },
   *     { provide: IEventBus, useClass: UnifiedEventBus },
   *   ]
   * }
   * ```
   */
  providers?: Provider[];

  /**
   * Additional imports for the module
   */
  imports?: ModuleMetadata['imports'];

  /**
   * Additional exports beyond the default explorer service
   */
  exports?: ModuleMetadata['exports'];

  /**
   * VP-012 Performance optimization configuration
   *
   * @example
   * ```typescript
   * // Podstawowa optymalizacja
   * {
   *   performance: {
   *     performanceMode: 'production',
   *     autoOptimize: true,
   *     contexts: ['UserManagement', 'OrderProcessing']
   *   }
   * }
   *
   * // Enterprise performance
   * {
   *   performance: {
   *     performanceMode: 'enterprise',
   *     preCompiledRegistry: await generujRejestrHandlerów(),
   *     skipDiscovery: true,
   *     performanceTarget: 50 // 50ms max startup
   *   }
   * }
   * ```
   */
  performance?: VytchesPerformanceOptions;

  /**
   * Enable detailed performance monitoring and alerts
   *
   * @example
   * ```typescript
   * {
   *   monitoring: {
   *     enabled: true,
   *     warnAt: 150,
   *     errorAt: 300,
   *     onPerformanceAlert: (metrics) => {
   *       console.log('Performance issue detected:', metrics);
   *     }
   *   }
   * }
   * ```
   */
  monitoring?: VytchesMonitoringOptions;
}

/**
 * VP-012 Enhanced Performance optimization options with Performance Monitor integration
 */
export interface VytchesPerformanceOptions
  extends Omit<PerformanceConfigurationOptions, 'container'> {
  /**
   * Performance mode for application type
   */
  performanceMode?: PerformanceMode;

  /**
   * Pre-compiled handler registry for maximum performance (94% improvement)
   */
  preCompiledRegistry?: HandlerRegistry;

  /**
   * Skip runtime discovery (requires preCompiledRegistry)
   */
  skipDiscovery?: boolean;

  /**
   * Bounded contexts for selective discovery
   */
  contexts?: string[];

  /**
   * Enable automatic optimization based on handler count
   */
  autoOptimize?: boolean;

  /**
   * Target startup time in milliseconds
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
   * Enable performance alerts during startup
   */
  performanceAlerts?: boolean;

  /**
   * Debug performance optimization steps
   */
  debugPerformance?: boolean;

  /**
   * VP-012 NEW: Performance profile name for adaptive optimization
   */
  performanceProfile?: string;

  /**
   * VP-012 NEW: Enable real-time performance monitoring
   */
  realTimeMonitoring?: boolean;

  /**
   * VP-012 NEW: Enable adaptive optimization strategies
   */
  adaptiveOptimization?: boolean;

  /**
   * VP-012 NEW: Specific performance strategies to use
   */
  performanceStrategies?: string[];

  /**
   * VP-012 NEW: Monitoring interval for performance metrics (milliseconds)
   */
  monitoringInterval?: number;

  /**
   * VP-012 NEW: Performance budget constraints
   */
  performanceBudget?: {
    startupTime?: number;
    memoryUsage?: number;
    discoveryTime?: number;
  };
}

/**
 * VP-012 Enhanced Performance monitoring configuration with Performance Monitor integration
 */
export interface VytchesMonitoringOptions {
  /**
   * Enable performance monitoring
   */
  enabled?: boolean;

  /**
   * Warning threshold in milliseconds (default: 200ms)
   */
  warnAt?: number;

  /**
   * Error threshold in milliseconds (default: 500ms)
   */
  errorAt?: number;

  /**
   * Enable automatic optimization suggestions
   */
  autoSuggest?: boolean;

  /**
   * Custom performance alert handler
   */
  onPerformanceAlert?: (metrics: any, level: 'warn' | 'error') => void;

  /**
   * Enable enterprise monitoring features
   */
  enterpriseMonitoring?: boolean;

  /**
   * VP-012 NEW: Enable performance alerts
   */
  performanceAlerts?: boolean;

  /**
   * VP-012 NEW: Metrics collection level
   */
  metricsCollection?: 'none' | 'basic' | 'standard' | 'detailed';

  /**
   * VP-012 NEW: Enable real-time performance alerts
   */
  realTimeAlerts?: boolean;

  /**
   * VP-012 NEW: Context name for monitoring (used in context-specific configurations)
   */
  contextName?: string;

  /**
   * VP-012 NEW: Performance alert thresholds
   */
  alertThresholds?: {
    discoveryTime?: number;
    memoryUsage?: number;
    handlerCount?: number;
  };

  /**
   * VP-012 NEW: Custom metrics handler
   */
  onPerformanceMetrics?: (metrics: PerformanceMetrics) => void;
}

/**
 * Enterprise-specific VytchesDDD module options
 * Extends base options with enterprise-grade performance requirements
 */
export interface VytchesEnterpriseModuleOptions
  extends Omit<VytchesDDDModuleOptions, 'performance'> {
  /**
   * VP-012 Enhanced Enterprise performance configuration
   */
  performance: {
    performanceMode: 'enterprise';
    preCompiledRegistry?: HandlerRegistry;
    skipDiscovery?: true;
    maxStartupTime?: number;
    enterpriseMonitoring?: boolean;
    performanceAlerts: true;
    // VP-012 NEW: Enterprise-specific options
    performanceProfile?: string;
    realTimeMonitoring?: boolean;
    adaptiveOptimization?: boolean;
    performanceStrategies?: string[];
    performanceBudget?: {
      startupTime?: number;
      memoryUsage?: number;
      discoveryTime?: number;
    };
  } & Partial<VytchesPerformanceOptions>;
}

/**
 * Context-specific configuration options
 * Supports per-context handler registration and DI bridging
 */
export interface VytchesContextOptions {
  /**
   * Bounded context name for handler isolation
   */
  context: string;

  /**
   * Bridge VytchesDDD handlers to NestJS DI system
   * When enabled, handlers are automatically registered in NestJS container
   */
  bridgeToNestJS?: boolean;

  /**
   * Custom providers specific to this context
   */
  providers?: Provider[];

  /**
   * Performance configuration for this context
   */
  performance?: VytchesPerformanceOptions;

  /**
   * Monitoring configuration for this context
   */
  monitoring?: VytchesMonitoringOptions;

  /**
   * Additional imports for this context
   */
  imports?: ModuleMetadata['imports'];

  /**
   * Additional exports for this context
   */
  exports?: ModuleMetadata['exports'];

  /**
   * Handler filter options for selective registration
   */
  handlers?: {
    /**
     * Include only handlers matching these patterns
     */
    include?: string[];

    /**
     * Exclude handlers matching these patterns
     */
    exclude?: string[];

    /**
     * Handler naming prefix for NestJS registration
     */
    prefix?: string;
  };
}

/**
 * Enhanced module options with context support
 */
export interface VytchesEnhancedModuleOptions extends VytchesDDDModuleOptions {
  /**
   * Enable context isolation features
   */
  enableContexts?: boolean;

  /**
   * Global bridge to NestJS (affects all contexts)
   */
  globalBridgeToNestJS?: boolean;

  /**
   * Context-specific configurations
   */
  contexts?: Record<string, Omit<VytchesContextOptions, 'context'>>;
}

/**
 * VP-012 NEW: Performance profile options for customized optimization
 */
export interface VytchesPerformanceProfileOptions extends VytchesDDDModuleOptions {
  /**
   * Performance profile to apply
   */
  performanceProfile: string;

  /**
   * Override performance mode for profile
   */
  performanceMode?: PerformanceMode;

  /**
   * Custom performance targets for this profile
   */
  performanceTargets?: {
    startup?: number;
    discovery?: number;
    memory?: number;
  };

  /**
   * Adaptive optimization settings
   */
  adaptiveSettings?: {
    enableAdaptation?: boolean;
    adaptationThreshold?: number;
    optimizationInterval?: number;
  };
}

/**
 * Extended module metadata with VytchesDDD-specific options
 */
export interface VytchesDDDDynamicModule extends ModuleMetadata {
  module?: any; // Avoid circular dependency - actual type checking happens at runtime
}
