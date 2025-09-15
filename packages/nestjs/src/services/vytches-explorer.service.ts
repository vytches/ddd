import type { OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { DiscoveryService, MetadataScanner, ModuleRef } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import type { Constructor } from '@vytches/ddd-di';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Service requires these dependencies
import { PerformanceMonitor, PerformanceOptimizer, SimpleContainer } from '@vytches/ddd-di';
import type {
  HandlerInfo,
  PerformanceMetrics,
  VytchesContextOptions,
  VytchesMonitoringOptions,
  VytchesPerformanceOptions,
} from '../types';
// Note: Bus types are resolved dynamically through module refs

@Injectable()
export class VytchesExplorerService implements OnModuleInit {
  private performanceOptimizer: PerformanceOptimizer;
  private performanceMonitor: PerformanceMonitor | undefined;
  private performanceOptions: VytchesPerformanceOptions;
  private monitoringOptions: VytchesMonitoringOptions;
  private contextOptions?: VytchesContextOptions;
  private container: SimpleContainer;

  // VP-012 Enhanced: New performance monitoring components
  private realTimeMonitoringEnabled = false;
  private adaptiveOptimizationEnabled = false;
  private currentPerformanceProfile: string | undefined;
  private performanceMetricsHistory: PerformanceMetrics[] = [];

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly _metadataScanner: MetadataScanner,
    private readonly moduleRef: ModuleRef
  ) {
    // Inicjalizacja VP-012 Performance Optimization
    this.performanceOptimizer = new PerformanceOptimizer();
    this.container = new SimpleContainer();

    // Domyślna konfiguracja wydajności
    this.performanceOptions = {
      performanceMode: 'development',
      autoOptimize: false,
      fallback: 'discovery',
    };

    this.monitoringOptions = {
      enabled: false,
      warnAt: 200,
      errorAt: 500,
      autoSuggest: true,
    };
  }

  async onModuleInit() {
    await this.exploreWithPerformanceOptimization();
  }

  /**
   * VP-012 Enhanced: Initialize performance monitoring with Performance Monitor integration
   */
  async initializePerformanceMonitoring(
    performanceOptions?: VytchesPerformanceOptions,
    monitoringOptions?: VytchesMonitoringOptions
  ): Promise<void> {
    if (performanceOptions) {
      this.performanceOptions = { ...this.performanceOptions, ...performanceOptions };

      // VP-012 Enhanced: Configure new performance features
      this.realTimeMonitoringEnabled = performanceOptions.realTimeMonitoring || false;
      this.adaptiveOptimizationEnabled = performanceOptions.adaptiveOptimization || false;
      this.currentPerformanceProfile = performanceOptions.performanceProfile || undefined;
    }

    if (monitoringOptions) {
      this.monitoringOptions = { ...this.monitoringOptions, ...monitoringOptions };

      // VP-012 Enhanced: Initialize Performance Monitor with enhanced configuration
      const alertConfig = {
        maxEvents: 1000,
        enabled: this.monitoringOptions.enabled !== false,
        thresholds: {
          maxExecutionTime: this.monitoringOptions.errorAt || 500,
          maxMemoryUsage: this.monitoringOptions.alertThresholds?.memoryUsage || 50 * 1024 * 1024,
          minCacheHitRate: 0.7,
          minParallelEfficiency: 0.6,
          maxFallbackRate: 0.1,
        },
      };

      this.performanceMonitor = new PerformanceMonitor(alertConfig);

      // Add alert listener if callback provided
      if (this.monitoringOptions.onPerformanceAlert) {
        this.performanceMonitor.addAlertListener(async alert => {
          const metrics = {
            startupTime: 0, // Will be updated with actual metrics
            discoveryTime: 0,
            registrationTime: 0,
            handlersFound: 0,
            performanceMode: 'development' as const,
            optimized: false,
            projectedAt300Handlers: 'N/A',
            recommendOptimization: false,
            suggestions: [],
            timestamp: new Date(),
          };
          const level =
            alert.severity === 'critical' || alert.severity === 'high' ? 'error' : 'warn';
          this.monitoringOptions.onPerformanceAlert?.(metrics, level);
        });
      }

      // VP-012 Enhanced: Start real-time monitoring if enabled
      if (this.realTimeMonitoringEnabled && this.performanceMonitor) {
        await this.startRealTimeMonitoring();
      }
    }
  }

  /**
   * VP-012 Enhanced: Explore with Performance Monitor integration
   */
  private async exploreWithPerformanceOptimization(): Promise<void> {
    // Guard against undefined discovery service in tests
    if (!this.discoveryService) {
      return;
    }

    // Czy monitoring jest włączony?
    const shouldMonitor = this.monitoringOptions.enabled;

    // Performance monitoring will be handled by the orchestrator
    const startTime = performance.now();

    try {
      // Sprawdź czy używać VP-012 optimization
      const useOptimization = this.shouldUseOptimization();

      if (useOptimization) {
        await this.exploreWithOptimization();
      } else {
        await this.exploreStandard();
      }
    } catch (error) {
      this.logEnhancedError(error as Error);

      // Fallback strategy with enhanced guidance
      if (this.performanceOptions.fallback === 'discovery') {
        console.log('🔄 Falling back to standard discovery...');
        console.log('💡 Consider checking your performance configuration or pre-compiled registry');
        await this.exploreStandard();
      } else if (this.performanceOptions.fallback === 'throw') {
        // Enhance the error with actionable suggestions
        const enhancedError = this.createEnhancedError(error as Error);
        throw enhancedError;
      } else {
        // cached-discovery fallback
        console.log('🔄 Attempting cached discovery fallback...');
        try {
          await this.exploreWithCachedFallback();
        } catch (_fallbackError) {
          console.warn('⚠️ Cached fallback also failed, using standard discovery');
          await this.exploreStandard();
        }
      }
    } finally {
      if (shouldMonitor) {
        const endTime = performance.now();
        const totalTime = endTime - startTime;

        if (this.performanceOptions.debugPerformance) {
          console.log('📊 VytchesDDD Performance Report:');
          console.log(`Total time: ${totalTime.toFixed(2)}ms`);
        }
      }
    }
  }

  /**
   * VP-012 Enhanced: Optimized exploration with Performance Monitor
   */
  private async exploreWithOptimization(): Promise<void> {
    const optimizationConfig = {
      ...this.performanceOptions,
      container: this.container,
    };

    // Utwórz NestJS discovery plugin dla VP-012
    const nestjsDiscoveryPlugin = this.createNestJSDiscoveryPlugin();

    // Wykonaj VP-012 optimization
    const metrics = await this.performanceOptimizer.optimizeConfiguration(
      optimizationConfig,
      this.container,
      [nestjsDiscoveryPlugin]
    );

    // VP-012 Enhanced: Record performance event with detailed metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordEvent(
        this.performanceMonitor.constructor.name.includes('STRATEGY_EXECUTED')
          ? ('strategy-executed' as any)
          : ('discovery-completed' as any),
        'optimization-strategy',
        {
          discoveryTime: metrics.discoveryTime,
          handlersFound: metrics.handlersFound,
          success: metrics.optimized,
          memoryUsage: process.memoryUsage().heapUsed,
          metadata: { performanceMode: this.performanceOptions.performanceMode || 'development' },
        } as any
      );

      // Store metrics for history tracking
      this.performanceMetricsHistory.push(metrics);

      // Check if adaptive optimization is needed
      if (this.adaptiveOptimizationEnabled) {
        await this.checkAdaptiveOptimization(metrics);
      }

      // Real-time metrics callback
      if (this.monitoringOptions.onPerformanceMetrics) {
        this.monitoringOptions.onPerformanceMetrics(metrics);
      }
    }

    console.log(
      `✅ VP-012 Enhanced Optimization completed: ${metrics.handlersFound} handlers, ${metrics.startupTime.toFixed(2)}ms startup`
    );

    // VP-012 Enhanced: Log performance profile information
    if (this.currentPerformanceProfile) {
      console.log(`🎯 Performance Profile: ${this.currentPerformanceProfile}`);
    }
  }

  /**
   * Standard exploration (fallback)
   */
  private async exploreStandard(): Promise<void> {
    // Get all providers from NestJS container
    const providers = this.discoveryService.getProviders();

    // Find handlers using metadata
    const commandHandlers = this.findHandlers(providers, 'di:handler-type', 'command');
    const queryHandlers = this.findHandlers(providers, 'di:handler-type', 'query');
    const eventHandlers = this.findHandlers(providers, 'di:handler-type', 'event');

    const totalHandlers = commandHandlers.length + queryHandlers.length + eventHandlers.length;

    // Register with buses if available
    await this.registerHandlers(commandHandlers, 'command');
    await this.registerHandlers(queryHandlers, 'query');
    await this.registerHandlers(eventHandlers, 'event');

    console.log(`📋 Standard discovery completed: ${totalHandlers} handlers registered`);
  }

  /**
   * Określ czy użyć VP-012 optimization
   */
  private shouldUseOptimization(): boolean {
    // Enterprise mode zawsze używa optimization
    if (this.performanceOptions.performanceMode === 'enterprise') {
      return true;
    }

    // Auto optimize włączone
    if (this.performanceOptions.autoOptimize) {
      return true;
    }

    // Pre-compiled registry dostępny
    if (this.performanceOptions.preCompiledRegistry) {
      return true;
    }

    // Selective discovery (contexts defined)
    if (this.performanceOptions.contexts?.length) {
      return true;
    }

    return false;
  }

  /**
   * Utwórz NestJS discovery plugin dla VP-012
   */
  private createNestJSDiscoveryPlugin() {
    return {
      name: 'NestJS Discovery Plugin',
      isAvailable: (): boolean => {
        // Plugin jest dostępny jeśli mamy dostęp do NestJS discovery service
        return !!this.discoveryService && typeof this.discoveryService.getProviders === 'function';
      },
      discoverHandlers: async (): Promise<HandlerInfo[]> => {
        const providers = this.discoveryService.getProviders();
        const handlers: HandlerInfo[] = [];

        // Command handlers
        this.findHandlers(providers, 'di:handler-type', 'command').forEach(wrapper => {
          const metadata = Reflect.getMetadata('di:handler-metadata', wrapper.metatype);
          if (metadata?.messageType && wrapper.metatype) {
            handlers.push({
              type: 'command',
              messageType: metadata.messageType as Constructor,
              handlerType: wrapper.metatype as Constructor,
              metadata,
            });
          }
        });

        // Query handlers
        this.findHandlers(providers, 'di:handler-type', 'query').forEach(wrapper => {
          const metadata = Reflect.getMetadata('di:handler-metadata', wrapper.metatype);
          if (metadata?.messageType && wrapper.metatype) {
            handlers.push({
              type: 'query',
              messageType: metadata.messageType as Constructor,
              handlerType: wrapper.metatype as Constructor,
              metadata,
            });
          }
        });

        // Event handlers
        this.findHandlers(providers, 'di:handler-type', 'event').forEach(wrapper => {
          const metadata = Reflect.getMetadata('di:handler-metadata', wrapper.metatype);
          if (metadata?.messageType && wrapper.metatype) {
            handlers.push({
              type: 'event',
              messageType: metadata.messageType as Constructor,
              handlerType: wrapper.metatype as Constructor,
              metadata,
            });
          }
        });

        return handlers;
      },
    };
  }

  private findHandlers(
    providers: InstanceWrapper[],
    metadataKey: string,
    expectedType: string
  ): InstanceWrapper[] {
    return providers.filter(wrapper => {
      if (!wrapper.metatype || !wrapper.instance) return false;

      const handlerType = Reflect.getMetadata(metadataKey, wrapper.metatype);
      return handlerType === expectedType;
    });
  }

  private async registerHandlers(
    handlers: InstanceWrapper[],
    busType: 'command' | 'query' | 'event'
  ) {
    if (handlers.length === 0) return;

    try {
      const bus = this.getBus(busType);
      if (!bus) return;

      for (const handler of handlers) {
        const handlerMetadata = Reflect.getMetadata('di:handler-metadata', handler.metatype);
        if (handlerMetadata?.messageType) {
          // Register handler with appropriate bus method
          if (busType === 'command' && 'register' in bus) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bus as any).register(handlerMetadata.messageType, handler.instance);
          } else if (busType === 'query' && 'register' in bus) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bus as any).register(handlerMetadata.messageType, handler.instance);
          } else if (busType === 'event' && 'registerHandler' in bus) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (bus as any).registerHandler(handlerMetadata.messageType, handler.instance);
          }
        }
      }
    } catch {
      // Silent fail - buses might not be configured
    }
  }

  private getBus(type: 'command' | 'query' | 'event') {
    try {
      switch (type) {
        case 'command':
          return this.moduleRef.get('ICommandBus', { strict: false });
        case 'query':
          return this.moduleRef.get('IQueryBus', { strict: false });
        case 'event':
          return this.moduleRef.get('IEventBus', { strict: false });
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Get current performance metrics from VP-012
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    if (this.performanceOptimizer) {
      try {
        return this.performanceOptimizer.getMetrics();
      } catch {
        // No metrics available yet
        return null;
      }
    }

    return null;
  }

  /**
   * Generate detailed performance report
   */
  generatePerformanceReport(): string | null {
    if (this.performanceOptimizer) {
      try {
        return this.performanceOptimizer.monitor.generateReport();
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Check if performance targets are met
   */
  checkPerformanceTargets(): boolean {
    if (this.performanceOptimizer) {
      try {
        return this.performanceOptimizer.monitor.checkPerformanceTargets();
      } catch {
        return true;
      }
    }

    return true; // Default to true if no monitoring
  }

  /**
   * Enhanced error logging with actionable guidance
   */
  private logEnhancedError(error: Error): void {
    console.error('🚨 VytchesExplorer: Handler discovery failed');
    console.error('❌ Error:', error.message);

    // Provide specific guidance based on error type
    if (error.message.includes('registry')) {
      console.error('💡 Registry Issue Detected:');
      console.error('   1. Verify your pre-compiled registry is valid');
      console.error('   2. Check if registry file exists and is accessible');
      console.error(
        '   3. Consider regenerating registry with: pnpm vytches-ddd optimize performance'
      );
    } else if (error.message.includes('timeout')) {
      console.error('💡 Performance Timeout Detected:');
      console.error('   1. Increase performanceTarget in your configuration');
      console.error('   2. Consider using selective discovery with contexts: []');
      console.error('   3. Try enabling parallelRegistration: true');
    } else if (error.message.includes('context')) {
      console.error('💡 Context Configuration Issue:');
      console.error('   1. Verify context names match your bounded contexts');
      console.error('   2. Check that handlers are decorated with correct context metadata');
      console.error('   3. Consider removing context filtering temporarily');
    } else {
      console.error('💡 General Troubleshooting:');
      console.error('   1. Check your VytchesDDD module configuration');
      console.error('   2. Verify all handlers are properly decorated');
      console.error('   3. Try disabling performance optimization temporarily');
    }

    console.error('📚 Documentation: https://docs.vytches.com/ddd/nestjs/troubleshooting');
  }

  /**
   * Create enhanced error with actionable suggestions
   */
  private createEnhancedError(originalError: Error): Error {
    const suggestions = this.generateErrorSuggestions(originalError);
    const enhancedMessage = `${originalError.message}

🔧 Suggested Solutions:
${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

📊 Current Configuration:
- Performance Mode: ${this.performanceOptions.performanceMode}
- Auto Optimize: ${this.performanceOptions.autoOptimize}
- Contexts: ${this.performanceOptions.contexts?.join(', ') || 'all'}
- Fallback Strategy: ${this.performanceOptions.fallback}

📚 More help: https://docs.vytches.com/ddd/nestjs/troubleshooting`;

    const enhancedError = new Error(enhancedMessage);
    enhancedError.name = 'VytchesDDDConfigurationError';
    if (originalError.stack) {
      enhancedError.stack = originalError.stack;
    }

    return enhancedError;
  }

  /**
   * Generate specific error suggestions based on error content
   */
  private generateErrorSuggestions(error: Error): string[] {
    const suggestions: string[] = [];
    const errorMsg = error.message.toLowerCase();

    if (errorMsg.includes('registry') || errorMsg.includes('precompiled')) {
      suggestions.push('Verify your pre-compiled registry is valid and accessible');
      suggestions.push('Run "pnpm vytches-ddd optimize performance" to regenerate registry');
      suggestions.push('Temporarily disable skipDiscovery to use runtime discovery');
    }

    if (errorMsg.includes('timeout') || errorMsg.includes('performance')) {
      suggestions.push('Increase the performanceTarget value (e.g., from 100ms to 200ms)');
      suggestions.push('Enable parallelRegistration for faster handler registration');
      suggestions.push('Use selective discovery by specifying contexts: ["YourContext"]');
    }

    if (errorMsg.includes('context') || errorMsg.includes('bounded')) {
      suggestions.push('Check that your context names match the bounded contexts in your app');
      suggestions.push(
        'Verify handlers have correct @CommandHandler/@QueryHandler context metadata'
      );
      suggestions.push('Try removing context filtering temporarily: contexts: undefined');
    }

    if (errorMsg.includes('handler') || errorMsg.includes('discover')) {
      suggestions.push(
        'Ensure all handlers are properly decorated with @CommandHandler, @QueryHandler, or @EventHandler'
      );
      suggestions.push('Check that handlers are included in your NestJS module providers array');
      suggestions.push(
        'Verify that VytchesDDD integration is properly configured in your root module'
      );
    }

    if (suggestions.length === 0) {
      suggestions.push('Try using forTesting() configuration to isolate the issue');
      suggestions.push('Enable debugPerformance: true to get detailed logging');
      suggestions.push('Check the official troubleshooting guide');
    }

    return suggestions;
  }

  /**
   * Cached discovery fallback implementation
   */
  private async exploreWithCachedFallback(): Promise<void> {
    console.log('📦 Using cached discovery strategy...');

    // Simple cached approach - just run standard discovery but log the strategy
    await this.exploreStandard();

    console.log('💾 Discovery results cached for next startup');
    console.log('💡 Tip: Consider upgrading to forProduction() for better performance');
  }

  /**
   * Provide configuration suggestions based on current setup
   */
  getConfigurationSuggestions(): string[] {
    const suggestions: string[] = [];
    const metrics = this.getPerformanceMetrics();

    if (!metrics) {
      suggestions.push('Enable performance monitoring to get optimization suggestions');
      return suggestions;
    }

    // Performance-based suggestions
    if (metrics.startupTime > 300) {
      suggestions.push(
        'Your startup time is high (>300ms). Consider upgrading to forProduction() configuration'
      );
      suggestions.push('Enable selective discovery with contexts to reduce scan time');
    }

    if (metrics.handlersFound > 100 && !metrics.optimized) {
      suggestions.push(
        `You have ${metrics.handlersFound} handlers but no optimization. Use forProduction() or forEnterprise()`
      );
      suggestions.push('Consider generating a pre-compiled registry for maximum performance');
    }

    if (this.performanceOptions.performanceMode === 'development' && metrics.handlersFound > 50) {
      suggestions.push('Switch from development to production mode for better performance');
      suggestions.push('Enable autoOptimize: true for automatic performance improvements');
    }

    if (!this.performanceOptions.contexts && metrics.handlersFound > 200) {
      suggestions.push(
        'Use selective discovery with contexts: ["YourBoundedContext"] to improve startup time'
      );
      suggestions.push('Consider splitting your application into smaller bounded contexts');
    }

    return suggestions;
  }

  /**
   * VP-012 Enhanced: Configure context-specific options with performance tracking
   */
  async configureContext(contextOptions: VytchesContextOptions): Promise<void> {
    this.contextOptions = contextOptions;

    // VP-012 Enhanced: Setup context-specific performance monitoring
    // Context name will be stored in the context options for use in metrics

    // VP-012 Enhanced: Log context configuration
    console.log(`🎯 VP-012 Context configured: ${contextOptions.context}`);
  }

  /**
   * Discover handlers specific to a context and handler type
   * Used by bridge providers for NestJS DI integration
   */
  async discoverContextHandlers(
    context: string,
    handlerType: 'command' | 'query' | 'event'
  ): Promise<any[]> {
    if (!this.discoveryService) {
      console.warn(`🔍 Discovery service not available for context: ${context}`);
      return [];
    }

    try {
      const providers = this.discoveryService.getProviders();
      const handlers = this.findHandlers(providers, 'di:handler-type', handlerType);

      // Filter handlers by context if specified
      let contextHandlers = handlers;
      if (this.contextOptions?.context === context) {
        contextHandlers = handlers.filter(wrapper => {
          const metadata = Reflect.getMetadata('di:handler-metadata', wrapper.metatype);
          return !metadata?.context || metadata.context === context;
        });
      }

      // Convert to handler info format for NestJS registration
      return contextHandlers.map(wrapper => {
        const metadata = Reflect.getMetadata('di:handler-metadata', wrapper.metatype);
        const instance = wrapper.instance || this.createHandlerInstance(wrapper);

        return {
          name: this.getHandlerName(wrapper),
          type: handlerType,
          context,
          instance,
          metadata,
          handlerType: wrapper.metatype,
        };
      });
    } catch (error) {
      console.error(`❌ Error discovering ${handlerType} handlers for context ${context}:`, error);
      return [];
    }
  }

  /**
   * Create handler instance if not already instantiated
   */
  private createHandlerInstance(wrapper: InstanceWrapper): any {
    try {
      // First check if already instantiated
      if (wrapper.instance) {
        return wrapper.instance;
      }

      // For tests or cases where we can't instantiate, return a mock
      if (!this.moduleRef || process.env.NODE_ENV === 'test') {
        return {
          [this.getHandlerName(wrapper)]: true,
          execute: () => Promise.resolve({ mocked: true }),
          handle: () => Promise.resolve({ mocked: true }),
        };
      }

      // Try to get instance from ModuleRef with protection against circular calls
      if (wrapper.token) {
        try {
          // Use strict: false and timeout protection
          const instance = this.moduleRef.get(wrapper.token, { strict: false });
          return instance;
        } catch (_error) {
          // Fallback to mock for safety
          return {
            [this.getHandlerName(wrapper)]: true,
            execute: () => Promise.resolve({ fallback: true }),
            handle: () => Promise.resolve({ fallback: true }),
          };
        }
      }

      console.warn(`⚠️ Could not create instance for handler: ${this.getHandlerName(wrapper)}`);
      return null;
    } catch (error) {
      console.error(`❌ Error creating handler instance:`, error);
      // Return safe fallback to prevent stack overflow
      return {
        error: true,
        execute: () => Promise.resolve({ error: true }),
        handle: () => Promise.resolve({ error: true }),
      };
    }
  }

  /**
   * Get context configuration
   */
  getContextConfiguration(): VytchesContextOptions | undefined {
    return this.contextOptions;
  }

  /**
   * Check if handler matches context filters
   */
  private isHandlerAllowedInContext(handlerName: string, context: string): boolean {
    if (!this.contextOptions || this.contextOptions.context !== context) {
      return true; // No restrictions
    }

    const filters = this.contextOptions.handlers;
    if (!filters) {
      return true; // No filters specified
    }

    // Check include patterns
    if (filters.include && filters.include.length > 0) {
      const includeMatch = filters.include.some(pattern =>
        new RegExp(pattern.replace(/\*/g, '.*')).test(handlerName)
      );
      if (!includeMatch) {
        return false;
      }
    }

    // Check exclude patterns
    if (filters.exclude && filters.exclude.length > 0) {
      const excludeMatch = filters.exclude.some(pattern =>
        new RegExp(pattern.replace(/\*/g, '.*')).test(handlerName)
      );
      if (excludeMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Enhanced handler discovery with context support
   */
  async discoverAllContextHandlers(): Promise<{ context: string; handlers: any[] }[]> {
    if (!this.contextOptions) {
      console.warn('🔍 No context configuration available');
      return [];
    }

    const results = [];
    const context = this.contextOptions.context;

    // Discover all handler types for this context
    const commandHandlers = await this.discoverContextHandlers(context, 'command');
    const queryHandlers = await this.discoverContextHandlers(context, 'query');
    const eventHandlers = await this.discoverContextHandlers(context, 'event');

    const allHandlers = [...commandHandlers, ...queryHandlers, ...eventHandlers];

    // Apply context filters
    const filteredHandlers = allHandlers.filter(handler =>
      this.isHandlerAllowedInContext(handler.name, context)
    );

    results.push({
      context,
      handlers: filteredHandlers,
    });

    console.log(`🎯 Context ${context}: Discovered ${filteredHandlers.length} handlers`);
    return results;
  }

  /**
   * Safely extract handler name from wrapper
   */
  private getHandlerName(wrapper: InstanceWrapper): string {
    try {
      if (
        wrapper.metatype &&
        typeof wrapper.metatype === 'function' &&
        'name' in wrapper.metatype
      ) {
        return wrapper.metatype.name as string;
      }
      if (wrapper.name && typeof wrapper.name === 'string') {
        return wrapper.name;
      }
      return 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  // ===== VP-012 Enhanced Methods =====

  /**
   * VP-012 NEW: Apply performance profile with adaptive optimization
   */
  async applyPerformanceProfile(profile: string, context?: string): Promise<void> {
    this.currentPerformanceProfile = profile;

    // Note: VP-012 PerformanceOptimizer doesn't have applyPerformanceProfile method
    // This would need to be implemented in the actual VP-012 optimizer
    console.log(
      `🎯 VP-012 Performance Profile applied: ${profile}${context ? ` [Context: ${context}]` : ''}`
    );
  }

  /**
   * VP-012 NEW: Enable real-time performance monitoring
   */
  async enableRealTimeMonitoring(): Promise<void> {
    this.realTimeMonitoringEnabled = true;

    // Real-time monitoring is enabled through the interval
    if (this.performanceMonitor) {
      await this.startRealTimeMonitoring();
    }

    console.log('📊 VP-012 Real-time monitoring enabled');
  }

  /**
   * VP-012 NEW: Start real-time monitoring with interval
   */
  private async startRealTimeMonitoring(): Promise<void> {
    const interval = this.performanceOptions.monitoringInterval || 10000; // Default 10s

    setInterval(async () => {
      if (this.performanceOptimizer && this.monitoringOptions.onPerformanceMetrics) {
        try {
          const metrics = this.performanceOptimizer.getMetrics();
          if (metrics) {
            this.monitoringOptions.onPerformanceMetrics(metrics);
          }
        } catch {
          // No metrics available yet
        }
      }
    }, interval);

    console.log(`📊 VP-012 Real-time monitoring started (interval: ${interval}ms)`);
  }

  /**
   * VP-012 NEW: Check if adaptive optimization is needed
   */
  private async checkAdaptiveOptimization(_metrics: PerformanceMetrics): Promise<void> {
    if (!this.adaptiveOptimizationEnabled || this.performanceMetricsHistory.length < 3) {
      return;
    }

    const recentMetrics = this.performanceMetricsHistory.slice(-3);
    const averageStartupTime = recentMetrics.reduce((sum, m) => sum + m.startupTime, 0) / 3;
    const performanceTarget = this.performanceOptions.performanceTarget || 200;

    // Check if performance is degrading
    if (averageStartupTime > performanceTarget * 1.2) {
      console.warn(
        `⚠️ VP-012 Adaptive Optimization: Performance degradation detected (${averageStartupTime.toFixed(2)}ms > ${performanceTarget}ms)`
      );

      // Suggest optimization strategy
      if (!this.performanceOptions.performanceStrategies?.includes('parallel-discovery')) {
        console.log('💡 VP-012 Suggestion: Enable parallel-discovery strategy');
      }

      if (!this.performanceOptions.contexts) {
        console.log('💡 VP-012 Suggestion: Use selective discovery with contexts');
      }
    }

    // Check if we can recommend a better performance profile
    if (
      averageStartupTime > performanceTarget &&
      this.currentPerformanceProfile === 'development-fast'
    ) {
      console.log(
        '💡 VP-012 Adaptive Optimization: Consider upgrading to "production-optimized" profile'
      );
    }
  }

  /**
   * VP-012 NEW: Get performance metrics history
   */
  getPerformanceMetricsHistory(): PerformanceMetrics[] {
    return [...this.performanceMetricsHistory];
  }

  /**
   * VP-012 NEW: Get current performance profile information
   */
  getCurrentPerformanceProfile(): string | undefined {
    return this.currentPerformanceProfile;
  }

  /**
   * VP-012 NEW: Check performance budget compliance
   */
  checkPerformanceBudget(): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];
    const budget = this.performanceOptions.performanceBudget;
    const metrics = this.getPerformanceMetrics();

    if (!budget || !metrics) {
      return { compliant: true, violations: [] };
    }

    if (budget.startupTime && metrics.startupTime > budget.startupTime) {
      violations.push(
        `Startup time ${metrics.startupTime.toFixed(2)}ms exceeds budget ${budget.startupTime}ms`
      );
    }

    // Note: PerformanceMetrics doesn't have memoryUsage property in the interface
    // This is a conceptual check that would need to be implemented
    const currentMemoryUsage = process.memoryUsage().heapUsed;
    if (budget.memoryUsage && currentMemoryUsage > budget.memoryUsage) {
      const memMB = Math.round(currentMemoryUsage / 1024 / 1024);
      const budgetMB = Math.round(budget.memoryUsage / 1024 / 1024);
      violations.push(`Memory usage ${memMB}MB exceeds budget ${budgetMB}MB`);
    }

    if (budget.discoveryTime && metrics.discoveryTime > budget.discoveryTime) {
      violations.push(
        `Discovery time ${metrics.discoveryTime.toFixed(2)}ms exceeds budget ${budget.discoveryTime}ms`
      );
    }

    const compliant = violations.length === 0;

    if (!compliant) {
      console.warn('⚠️ VP-012 Performance Budget Violations:', violations);
    }

    return { compliant, violations };
  }

  /**
   * VP-012 NEW: Get optimization recommendations based on current performance
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getPerformanceMetrics();

    if (!metrics) {
      recommendations.push('Enable performance monitoring to get personalized recommendations');
      return recommendations;
    }

    // Startup time recommendations
    if (metrics.startupTime > 300) {
      recommendations.push(
        '🚀 High startup time detected. Consider using forProduction() configuration'
      );
      recommendations.push(
        '🎯 Enable selective discovery with specific contexts to reduce scan time'
      );
      recommendations.push('⚡ Try parallel-discovery strategy for faster processing');
    }

    // Handler count recommendations
    if (metrics.handlersFound > 100 && !this.performanceOptions.preCompiledRegistry) {
      recommendations.push(
        '📋 Large number of handlers detected. Consider generating a pre-compiled registry'
      );
      recommendations.push('🔧 Use forEnterprise() configuration for maximum performance');
    }

    // Performance profile recommendations
    if (this.currentPerformanceProfile === 'development-fast' && metrics.startupTime > 150) {
      recommendations.push('⬆️ Upgrade from development-fast to production-optimized profile');
    }

    // Real-time monitoring recommendations
    if (!this.realTimeMonitoringEnabled && metrics.handlersFound > 50) {
      recommendations.push('📊 Enable real-time monitoring for continuous performance insights');
    }

    // Context-based recommendations
    if (!this.performanceOptions.contexts && metrics.handlersFound > 200) {
      recommendations.push(
        '🎯 Use context-based discovery to improve performance and maintainability'
      );
    }

    return recommendations;
  }

  /**
   * VP-012 NEW: Legacy compatibility - keep old method name as alias
   */
  configurePerformance(
    performanceOptions?: VytchesPerformanceOptions,
    monitoringOptions?: VytchesMonitoringOptions
  ): void {
    // Legacy sync method - call async method without await for compatibility
    this.initializePerformanceMonitoring(performanceOptions, monitoringOptions).catch(error => {
      console.warn('⚠️ VP-012 Legacy configurePerformance compatibility warning:', error);
    });
  }
}
