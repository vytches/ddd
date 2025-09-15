import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, ModuleRef } from '@nestjs/core';
import { VytchesExplorerService } from './services/vytches-explorer.service';
import type {
  VytchesContextOptions,
  VytchesDDDModuleOptions,
  VytchesEnhancedModuleOptions,
  VytchesEnterpriseModuleOptions,
  VytchesMonitoringOptions,
  VytchesPerformanceOptions,
} from './types';

/**
 * VytchesDDD NestJS Integration Module - VP-012 Enhanced
 * Enterprise-grade DI integration with performance optimization
 *
 * Key Features:
 * - VP-012 Performance Monitor integration
 * - Adaptive performance strategies
 * - Real-time performance metrics
 * - Context-based handler isolation
 * - Enterprise monitoring & alerting
 *
 * @version VP-012.2
 * @enterprise Enhanced Performance Monitoring
 */
@Global()
@Module({})
export class VytchesDDDModule {
  /**
   * Configure VytchesDDD module with VP-012 Performance Monitor integration
   *
   * @example
   * ```typescript
   * // Basic configuration with performance monitoring
   * VytchesDDDModule.forRoot({
   *   providers: [
   *     { provide: ICommandBus, useClass: EnhancedCommandBus },
   *     { provide: IQueryBus, useClass: EnhancedQueryBus },
   *     { provide: IEventBus, useClass: UnifiedEventBus },
   *   ],
   *   performance: {
   *     performanceMode: 'production',
   *     performanceProfile: 'balanced', // New: adaptive performance profiles
   *     realTimeMonitoring: true,        // New: real-time metrics
   *     adaptiveOptimization: true       // New: adaptive strategies
   *   },
   *   monitoring: {
   *     enabled: true,
   *     performanceAlerts: true,
   *     metricsCollection: 'detailed'
   *   }
   * })
   *
   * // Enterprise configuration with custom performance profile
   * VytchesDDDModule.forRoot({
   *   providers: [...],
   *   performance: {
   *     performanceProfile: {
   *       name: 'enterprise-optimized',
   *       strategies: ['parallel-discovery', 'selective-discovery'],
   *       thresholds: { startup: 50, discovery: 25 },
   *       adaptiveSettings: {
   *         enableAdaptation: true,
   *         adaptationThreshold: 0.8,
   *         monitoringInterval: 5000
   *       }
   *     },
   *     realTimeMonitoring: true,
   *     performanceTarget: 50
   *   }
   * })
   * ```
   */
  static forRoot(options: VytchesDDDModuleOptions = {}): DynamicModule {
    const explorerProvider = {
      provide: VytchesExplorerService,
      useFactory: async (
        discoveryService: DiscoveryService,
        metadataScanner: MetadataScanner,
        moduleRef: any
      ) => {
        const explorer = new VytchesExplorerService(discoveryService, metadataScanner, moduleRef);

        // VP-012 Enhanced: Initialize Performance Monitor integration
        if (options.performance || options.monitoring) {
          explorer
            .initializePerformanceMonitoring(options.performance, options.monitoring)
            .catch(error => {
              console.warn(`⚠️ VP-012 Performance initialization warning:`, error);
            });
        }

        // NEW: Apply performance profile if specified
        if (options.performance?.performanceProfile) {
          explorer.applyPerformanceProfile(options.performance.performanceProfile).catch(error => {
            console.warn(`⚠️ VP-012 Performance profile warning:`, error);
          });
        }

        // NEW: Enable real-time monitoring if requested
        if (options.performance?.realTimeMonitoring) {
          explorer.enableRealTimeMonitoring().catch(error => {
            console.warn(`⚠️ VP-012 Real-time monitoring warning:`, error);
          });
        }

        return explorer;
      },
      inject: [DiscoveryService, MetadataScanner, ModuleRef],
    };

    const providers = [
      // Core NestJS services
      DiscoveryService,
      MetadataScanner,

      // VytchesDDD explorer service z VP-012 optimization
      explorerProvider,

      // User-provided bus implementations
      ...(options.providers || []),
    ];

    const exports = [
      VytchesExplorerService,
      // Export all user-provided tokens
      ...(options.providers?.map(p => ('provide' in p ? p.provide : p)) || []),
    ];

    return {
      module: VytchesDDDModule,
      ...(options.imports && { imports: options.imports }),
      providers,
      exports: [...exports, ...(options.exports || [])],
    };
  }

  /**
   * Production-ready configuration with VP-012 Performance Monitor
   *
   * @example
   * ```typescript
   * // Basic production configuration with monitoring
   * VytchesDDDModule.forProduction()
   *
   * // Advanced production with custom performance profile
   * VytchesDDDModule.forProduction({
   *   contexts: ['UserManagement', 'OrderProcessing'],
   *   performanceTarget: 100,
   *   performance: {
   *     performanceProfile: 'production-optimized',
   *     adaptiveOptimization: true,
   *     realTimeMonitoring: true
   *   },
   *   providers: [
   *     { provide: ICommandBus, useClass: EnhancedCommandBus }
   *   ]
   * })
   * ```
   */
  static forProduction(options: Partial<VytchesDDDModuleOptions> = {}): DynamicModule {
    const productionPerformance: VytchesPerformanceOptions = {
      performanceMode: 'production',
      performanceProfile: 'production-optimized', // NEW: Predefined performance profile
      autoOptimize: true,
      performanceTarget: 200, // 200ms max startup dla production
      parallelRegistration: true,
      preWarmHandlers: true,
      performanceAlerts: true,
      fallback: 'discovery',
      debugPerformance: false,
      // VP-012 Enhanced features
      realTimeMonitoring: true,
      adaptiveOptimization: true,
      performanceStrategies: ['parallel-discovery', 'cached-discovery'],
      monitoringInterval: 10000, // 10s monitoring intervals
      ...options.performance,
    };

    const productionMonitoring: VytchesMonitoringOptions = {
      enabled: true,
      warnAt: 150,
      errorAt: 300,
      autoSuggest: true,
      enterpriseMonitoring: false,
      // VP-012 Enhanced monitoring
      performanceAlerts: true,
      metricsCollection: 'standard',
      alertThresholds: {
        discoveryTime: 150,
        memoryUsage: 50 * 1024 * 1024, // 50MB
        handlerCount: 1000,
      },
      onPerformanceMetrics: metrics => {
        if (metrics.discoveryTime > 200) {
          console.warn(
            `🔍 VP-012 Performance Alert: Discovery time ${metrics.discoveryTime}ms exceeded threshold`
          );
        }
      },
      ...options.monitoring,
    };

    return this.forRoot({
      ...options,
      performance: productionPerformance,
      monitoring: productionMonitoring,
      providers: [
        // Default production implementations
        {
          provide: 'ICommandBus',
          useFactory: async () => {
            const { SimpleContainer } = await import('@vytches/ddd-di');
            const { EnhancedCommandBus } = await import('@vytches/ddd-cqrs');
            const container = new SimpleContainer();
            return new EnhancedCommandBus(container);
          },
        },
        {
          provide: 'IQueryBus',
          useFactory: async () => {
            const { SimpleContainer } = await import('@vytches/ddd-di');
            const { EnhancedQueryBus } = await import('@vytches/ddd-cqrs');
            const container = new SimpleContainer();
            return new EnhancedQueryBus(container);
          },
        },
        {
          provide: 'IEventBus',
          useFactory: async () => {
            const { UnifiedEventBus } = await import('@vytches/ddd-events');
            return new UnifiedEventBus();
          },
        },
        // User-provided implementations override defaults
        ...(options.providers || []),
      ],
    });
  }

  /**
   * Enterprise-grade configuration with VP-012 Performance Monitor
   * Features adaptive optimization and real-time performance tracking
   *
   * @example
   * ```typescript
   * // Enterprise configuration with pre-compiled registry
   * VytchesDDDModule.forEnterprise({
   *   performance: {
   *     preCompiledRegistry: await generateHandlerRegistry(),
   *     maxStartupTime: 50,
   *     performanceProfile: 'enterprise-maximum',
   *     adaptiveOptimization: true,
   *     realTimeMonitoring: true
   *   },
   *   providers: [
   *     { provide: ICommandBus, useClass: EnterpriseCommandBus }
   *   ]
   * })
   *
   * // Custom enterprise performance profile
   * VytchesDDDModule.forEnterprise({
   *   performance: {
   *     performanceProfile: {
   *       name: 'custom-enterprise',
   *       strategies: ['pre-compiled-registry', 'parallel-discovery'],
   *       thresholds: { startup: 30, discovery: 15 },
   *       adaptiveSettings: {
   *         enableAdaptation: true,
   *         adaptationThreshold: 0.9,
   *         optimizationInterval: 30000
   *       }
   *     },
   *     maxStartupTime: 50
   *   }
   * })
   * ```
   */
  static forEnterprise(options: VytchesEnterpriseModuleOptions): DynamicModule {
    const enterprisePerformance: VytchesPerformanceOptions = {
      performanceMode: 'enterprise',
      performanceProfile: options.performance.performanceProfile || 'enterprise-maximum',
      ...(options.performance.preCompiledRegistry && {
        preCompiledRegistry: options.performance.preCompiledRegistry,
      }),
      skipDiscovery: true,
      performanceTarget: options.performance.maxStartupTime || 100, // 100ms max dla enterprise
      parallelRegistration: true,
      preWarmHandlers: true,
      performanceAlerts: true,
      fallback: 'throw', // Enterprise mode nie toleruje fallback
      debugPerformance: false,
      // VP-012 Enhanced enterprise features
      realTimeMonitoring: true,
      adaptiveOptimization: true,
      performanceStrategies: ['pre-compiled-registry', 'parallel-discovery'],
      monitoringInterval: 5000, // 5s monitoring for enterprise
      performanceBudget: {
        startupTime: options.performance.maxStartupTime || 100,
        memoryUsage: 25 * 1024 * 1024, // 25MB max for enterprise
        discoveryTime: 25, // 25ms max discovery time
      },
    };

    const enterpriseMonitoring: VytchesMonitoringOptions = {
      enabled: true,
      warnAt: 50, // Bardzo niskie thresholds dla enterprise
      errorAt: 100,
      autoSuggest: true,
      enterpriseMonitoring: true,
      // VP-012 Enhanced enterprise monitoring
      performanceAlerts: true,
      metricsCollection: 'detailed',
      realTimeAlerts: true,
      alertThresholds: {
        discoveryTime: 25,
        memoryUsage: 25 * 1024 * 1024, // 25MB
        handlerCount: 500,
      },
      onPerformanceAlert: (metrics, level) => {
        console.error(`🚨 VP-012 Enterprise Performance Alert [${level.toUpperCase()}]:`, {
          ...metrics,
          timestamp: new Date().toISOString(),
          threshold: level === 'error' ? enterpriseMonitoring.errorAt : enterpriseMonitoring.warnAt,
        });

        if (level === 'error') {
          // Enterprise mode: błędy wydajności są krytyczne
          throw new Error(
            `VP-012 Enterprise performance target exceeded: ${metrics.startupTime}ms > ${enterpriseMonitoring.errorAt}ms`
          );
        }
      },
      onPerformanceMetrics: metrics => {
        // Real-time enterprise monitoring
        if (metrics.discoveryTime > 25) {
          console.warn(
            `⚠️ VP-012 Enterprise Discovery Alert: ${metrics.discoveryTime}ms > 25ms threshold`
          );
        }
        // Note: PerformanceMetrics interface doesn't include memoryUsage
        // Using process.memoryUsage() for actual memory monitoring
        const currentMemoryUsage = process.memoryUsage().heapUsed;
        if (currentMemoryUsage > 25 * 1024 * 1024) {
          console.warn(
            `⚠️ VP-012 Enterprise Memory Alert: ${Math.round(currentMemoryUsage / 1024 / 1024)}MB > 25MB threshold`
          );
        }
      },
    };

    return this.forRoot({
      ...options,
      performance: enterprisePerformance,
      monitoring: enterpriseMonitoring,
      providers: [
        // Default enterprise implementations
        {
          provide: 'ICommandBus',
          useFactory: async () => {
            const { SimpleContainer } = await import('@vytches/ddd-di');
            const { EnhancedCommandBus } = await import('@vytches/ddd-cqrs');
            const container = new SimpleContainer();
            return new EnhancedCommandBus(container);
          },
        },
        {
          provide: 'IQueryBus',
          useFactory: async () => {
            const { SimpleContainer } = await import('@vytches/ddd-di');
            const { EnhancedQueryBus } = await import('@vytches/ddd-cqrs');
            const container = new SimpleContainer();
            return new EnhancedQueryBus(container);
          },
        },
        {
          provide: 'IEventBus',
          useFactory: async () => {
            const { UnifiedEventBus } = await import('@vytches/ddd-events');
            return new UnifiedEventBus();
          },
        },
        // User-provided implementations override defaults
        ...(options.providers || []),
      ],
    });
  }

  /**
   * Simple configuration for testing and development
   * Uses minimal VP-012 optimization for fast feedback loops
   */
  static forTesting(): DynamicModule {
    return this.forRoot({
      providers: [
        // Simple implementations for testing
        {
          provide: 'ICommandBus',
          useFactory: async () => {
            const { SimpleContainer } = await import('@vytches/ddd-di');
            const { EnhancedCommandBus } = await import('@vytches/ddd-cqrs');
            const container = new SimpleContainer();
            return new EnhancedCommandBus(container);
          },
        },
        {
          provide: 'IQueryBus',
          useFactory: async () => {
            const { SimpleContainer } = await import('@vytches/ddd-di');
            const { EnhancedQueryBus } = await import('@vytches/ddd-cqrs');
            const container = new SimpleContainer();
            return new EnhancedQueryBus(container);
          },
        },
        {
          provide: 'IEventBus',
          useFactory: async () => {
            const { UnifiedEventBus } = await import('@vytches/ddd-events');
            return new UnifiedEventBus();
          },
        },
      ],
      // Testowanie z minimalnym VP-012 monitoring
      performance: {
        performanceMode: 'development',
        performanceProfile: 'development-fast',
        autoOptimize: false,
        performanceAlerts: false,
        realTimeMonitoring: false,
        adaptiveOptimization: false,
      },
      monitoring: {
        enabled: false,
        performanceAlerts: false,
        metricsCollection: 'none',
      },
    });
  }

  /**
   * Performance profile-based configuration with VP-012 optimization
   *
   * @example
   * ```typescript
   * // Use predefined performance profile
   * VytchesDDDModule.forPerformanceProfile('enterprise-maximum', {
   *   providers: [...],
   *   contexts: ['UserManagement', 'OrderProcessing']
   * })
   *
   * // Custom performance profile with adaptive optimization
   * VytchesDDDModule.forPerformanceProfile({
   *   name: 'custom-high-performance',
   *   strategies: ['parallel-discovery', 'cached-discovery'],
   *   thresholds: { startup: 75, discovery: 20 },
   *   adaptiveSettings: {
   *     enableAdaptation: true,
   *     adaptationThreshold: 0.85,
   *     optimizationInterval: 15000
   *   }
   * })
   * ```
   */
  static forPerformanceProfile(
    profile: string,
    options: Partial<VytchesDDDModuleOptions> = {}
  ): DynamicModule {
    const performanceOptions: VytchesPerformanceOptions = {
      performanceMode: 'production',
      performanceProfile: profile,
      autoOptimize: true,
      realTimeMonitoring: true,
      adaptiveOptimization: true,
      performanceAlerts: true,
      fallback: 'discovery',
      ...options.performance,
    };

    const monitoringOptions: VytchesMonitoringOptions = {
      enabled: true,
      performanceAlerts: true,
      metricsCollection: 'detailed',
      autoSuggest: true,
      ...options.monitoring,
    };

    return this.forRoot({
      ...options,
      performance: performanceOptions,
      monitoring: monitoringOptions,
    });
  }

  /**
   * Context-aware configuration with handler isolation and VP-012 performance optimization
   *
   * @example
   * ```typescript
   * // Basic context configuration with performance monitoring
   * VytchesDDDModule.forContext('UserManagement', {
   *   bridgeToNestJS: true,
   *   performance: {
   *     performanceProfile: 'context-optimized',
   *     performanceTarget: 100,
   *     realTimeMonitoring: true
   *   }
   * })
   *
   * // Advanced context with performance profile and adaptive optimization
   * VytchesDDDModule.forContext('OrderProcessing', {
   *   bridgeToNestJS: true,
   *   handlers: {
   *     include: ['*CommandHandler', '*QueryHandler'],
   *     prefix: 'Order'
   *   },
   *   performance: {
   *     performanceMode: 'production',
   *     performanceProfile: 'selective-discovery',
   *     adaptiveOptimization: true,
   *     realTimeMonitoring: true
   *   }
   * })
   * ```
   */
  static forContext(
    context: string,
    options: Omit<VytchesContextOptions, 'context'> = {}
  ): DynamicModule {
    // Validate context name
    if (!context || context.trim() === '') {
      throw new Error('Container configuration error: Context name cannot be null or empty');
    }

    const contextOptions: VytchesContextOptions = {
      context: context.trim(),
      ...options,
    };

    // Prepare context-specific performance options with VP-012 enhancements
    const contextPerformance: VytchesPerformanceOptions = {
      performanceMode: 'production',
      performanceProfile: 'context-optimized', // NEW: Context-specific profile
      autoOptimize: true,
      contexts: [context], // Isolate to specific context
      performanceTarget: 150,
      parallelRegistration: true,
      preWarmHandlers: false,
      fallback: 'discovery',
      debugPerformance: false,
      // VP-012 Enhanced context features
      realTimeMonitoring: true,
      adaptiveOptimization: true,
      performanceStrategies: ['selective-discovery'], // Context-focused strategy
      monitoringInterval: 15000, // 15s for context monitoring
      ...options.performance,
    };

    const contextMonitoring: VytchesMonitoringOptions = {
      enabled: true,
      warnAt: 100,
      errorAt: 200,
      autoSuggest: true,
      enterpriseMonitoring: false,
      // VP-012 Enhanced context monitoring
      performanceAlerts: true,
      metricsCollection: 'standard',
      contextName: context, // NEW: Track context in metrics
      alertThresholds: {
        discoveryTime: 100,
        memoryUsage: 30 * 1024 * 1024, // 30MB for context
        handlerCount: 200, // Context-specific handler limit
      },
      onPerformanceMetrics: metrics => {
        if (metrics.discoveryTime > 100) {
          console.warn(
            `🔍 VP-012 Context [${context}] Alert: Discovery ${metrics.discoveryTime}ms > 100ms`
          );
        }
      },
      ...options.monitoring,
    };

    // Create context-specific explorer factory
    const contextExplorerProvider = {
      provide: `VytchesExplorerService_${context}`,
      useFactory: (
        discoveryService: DiscoveryService,
        metadataScanner: MetadataScanner,
        moduleRef: ModuleRef
      ) => {
        const explorer = new VytchesExplorerService(discoveryService, metadataScanner, moduleRef);

        // VP-012 Enhanced: Initialize context-specific performance monitoring
        explorer
          .initializePerformanceMonitoring(contextPerformance, contextMonitoring)
          .catch(error => {
            console.warn(`⚠️ VP-012 Context performance initialization warning:`, error);
          });

        // Set up context isolation with performance tracking
        explorer.configureContext(contextOptions).catch(error => {
          console.warn(`⚠️ VP-012 Context configuration warning:`, error);
        });

        // NEW: Apply context-specific performance profile
        if (contextPerformance.performanceProfile) {
          explorer
            .applyPerformanceProfile(contextPerformance.performanceProfile, context)
            .catch(error => {
              console.warn(`⚠️ VP-012 Performance profile warning:`, error);
            });
        }

        return explorer;
      },
      inject: [DiscoveryService, MetadataScanner, ModuleRef],
    };

    const providers = [
      // Core NestJS services
      DiscoveryService,
      MetadataScanner,

      // Context-specific explorer service
      contextExplorerProvider,

      // Context-specific bus implementations
      {
        provide: `ICommandBus_${context}`,
        useFactory: async () => {
          const { VytchesDDD } = await import('@vytches/ddd-di');
          const { SimpleContainer } = await import('@vytches/ddd-di');
          const { EnhancedCommandBus } = await import('@vytches/ddd-cqrs');

          const container = new SimpleContainer();
          VytchesDDD.configureContext(context, container);
          return new EnhancedCommandBus(container);
        },
      },
      {
        provide: `IQueryBus_${context}`,
        useFactory: async () => {
          const { VytchesDDD } = await import('@vytches/ddd-di');
          const { SimpleContainer } = await import('@vytches/ddd-di');
          const { EnhancedQueryBus } = await import('@vytches/ddd-cqrs');

          const container = new SimpleContainer();
          VytchesDDD.configureContext(context, container);
          return new EnhancedQueryBus(container);
        },
      },
      {
        provide: `IEventBus_${context}`,
        useFactory: async () => {
          const { UnifiedEventBus } = await import('@vytches/ddd-events');
          return new UnifiedEventBus();
        },
      },

      // User-provided context-specific implementations
      ...(options.providers || []),
    ];

    // Add bridge providers if requested
    if (options.bridgeToNestJS) {
      const bridgeProviders = this.createBridgeProviders(context, contextOptions);
      providers.push(...bridgeProviders);
    }

    const exports = [
      `VytchesExplorerService_${context}`,
      `ICommandBus_${context}`,
      `IQueryBus_${context}`,
      `IEventBus_${context}`,
      // Export user-provided tokens
      ...(options.providers?.map(p => ('provide' in p ? p.provide : p)) || []),
      // Export additional context exports
      ...(options.exports || []),
    ];

    return {
      module: VytchesDDDModule,
      ...(options.imports && { imports: options.imports }),
      providers,
      exports,
    };
  }

  /**
   * Enhanced multi-context configuration with global settings
   *
   * @example
   * ```typescript
   * VytchesDDDModule.forContexts({
   *   globalBridgeToNestJS: true,
   *   enableContexts: true,
   *   contexts: {
   *     'UserManagement': {
   *       bridgeToNestJS: true,
   *       performance: { performanceTarget: 100 }
   *     },
   *     'OrderProcessing': {
   *       bridgeToNestJS: true,
   *       handlers: { include: ['*Order*'] }
   *     }
   *   }
   * })
   * ```
   */
  static forContexts(options: VytchesEnhancedModuleOptions): DynamicModule {
    const contextModules: DynamicModule[] = [];

    // Create modules for each context
    if (options.contexts) {
      for (const [contextName, contextConfig] of Object.entries(options.contexts)) {
        const contextModule = this.forContext(contextName, {
          ...contextConfig,
          // Apply global settings if not overridden
          ...(options.globalBridgeToNestJS !== undefined &&
            contextConfig.bridgeToNestJS === undefined && {
              bridgeToNestJS: options.globalBridgeToNestJS,
            }),
        });

        contextModules.push(contextModule);
      }
    }

    // Combine all context modules with base configuration
    const allProviders = contextModules.reduce((acc, module) => {
      return [...acc, ...(module.providers || [])];
    }, [] as any[]);

    const allExports = contextModules.reduce((acc, module) => {
      return [...acc, ...(module.exports || [])];
    }, [] as any[]);

    return {
      module: VytchesDDDModule,
      ...(options.imports && { imports: options.imports }),
      providers: [
        // Base providers
        DiscoveryService,
        MetadataScanner,
        // Context-specific providers
        ...allProviders,
        // User-provided global providers
        ...(options.providers || []),
      ],
      exports: [
        // Context-specific exports
        ...allExports,
        // User-provided global exports
        ...(options.exports || []),
      ],
    };
  }

  /**
   * Create bridge providers for seamless NestJS DI integration
   * Maps VytchesDDD handlers to NestJS providers automatically
   */
  private static createBridgeProviders(context: string, options: VytchesContextOptions): any[] {
    const bridgeProviders = [];

    // Generic bridge for command handlers
    bridgeProviders.push({
      provide: `${options.handlers?.prefix || context}_CommandHandlers`,
      useFactory: async (explorer: VytchesExplorerService) => {
        const handlers = await explorer.discoverContextHandlers(context, 'command');
        return this.registerHandlersInNestJS(handlers, options);
      },
      inject: [`VytchesExplorerService_${context}`],
    });

    // Generic bridge for query handlers
    bridgeProviders.push({
      provide: `${options.handlers?.prefix || context}_QueryHandlers`,
      useFactory: async (explorer: VytchesExplorerService) => {
        const handlers = await explorer.discoverContextHandlers(context, 'query');
        return this.registerHandlersInNestJS(handlers, options);
      },
      inject: [`VytchesExplorerService_${context}`],
    });

    // Generic bridge for event handlers
    bridgeProviders.push({
      provide: `${options.handlers?.prefix || context}_EventHandlers`,
      useFactory: async (explorer: VytchesExplorerService) => {
        const handlers = await explorer.discoverContextHandlers(context, 'event');
        return this.registerHandlersInNestJS(handlers, options);
      },
      inject: [`VytchesExplorerService_${context}`],
    });

    return bridgeProviders;
  }

  /**
   * Register discovered handlers in NestJS DI system
   * Applies filtering and naming conventions
   */
  private static registerHandlersInNestJS(handlers: any[], options: VytchesContextOptions): any[] {
    let filteredHandlers = handlers;

    // Apply include filter
    if (options.handlers?.include) {
      filteredHandlers = filteredHandlers.filter(handler =>
        options.handlers?.include?.some(pattern =>
          new RegExp(pattern.replace(/\*/g, '.*')).test(handler.name)
        )
      );
    }

    // Apply exclude filter
    if (options.handlers?.exclude) {
      filteredHandlers = filteredHandlers.filter(
        handler =>
          !options.handlers?.exclude?.some(pattern =>
            new RegExp(pattern.replace(/\*/g, '.*')).test(handler.name)
          )
      );
    }

    // Register filtered handlers with optional prefix
    return filteredHandlers.map(handler => ({
      provide: `${options.handlers?.prefix || ''}${handler.name}`,
      useValue: handler.instance,
    }));
  }
}
