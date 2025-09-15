/**
 * VP-012: Performance Orchestrator - Strategy Coordination
 * SOLID Architecture: Orchestrates strategy selection and execution
 */

import type {
  HandlerInfo,
  IHandlerDiscoveryPlugin,
} from '../../discovery/handler-discovery.interface';
import type { IDependencyContainer } from '../../types';
import type {
  IPerformanceContext,
  IPerformanceMetrics,
  IPerformanceStrategy,
  IPerformanceStrategyFactory,
} from '../abstractions/performance-strategy.interface';
import { globalPerformanceMonitor, PerformanceEventType } from '../performance-monitor';
import type { PerformanceConfigurationOptions } from '../performance-types';
import { CachedDiscoveryStrategy } from '../strategies/cached-discovery-strategy';
import { ParallelDiscoveryStrategy } from '../strategies/parallel-discovery-strategy';
import { PreCompiledRegistryStrategy } from '../strategies/pre-compiled-registry-strategy';
import { SelectiveDiscoveryStrategy } from '../strategies/selective-discovery-strategy';
import { StandardDiscoveryStrategy } from '../strategies/standard-discovery-strategy';

/**
 * Orchestrator for performance optimization strategies
 * Implements Strategy Pattern with enterprise-grade coordination
 */
export class PerformanceOrchestrator {
  private readonly strategies = new Map<string, IPerformanceStrategy>();
  private readonly strategyFactory: IPerformanceStrategyFactory | null = null;

  constructor() {
    // Register default strategies
    this.registerDefaultStrategies();
  }

  /**
   * Execute performance optimization using appropriate strategy
   * CRITICAL: No performance theater - selects and executes real strategies
   */
  async optimize(
    config: PerformanceConfigurationOptions,
    container: IDependencyContainer,
    discoveryPlugins: IHandlerDiscoveryPlugin[] = []
  ): Promise<{
    handlers: HandlerInfo[];
    metrics: IPerformanceMetrics;
    strategyUsed: string;
  }> {
    // Create performance context
    const context: IPerformanceContext = {
      container,
      discoveryPlugins,
      contexts: config.contexts ?? undefined,
      performanceMode: config.performanceMode || 'development',
      timeout: config.timeout ?? undefined,
      maxHandlers: config.maxHandlers ?? undefined,
      parallelProcessing: config.parallelRegistration || false,
      preCompiledRegistry: config.preCompiledRegistry ?? undefined,
      skipDiscovery: config.skipDiscovery ?? undefined,
    };

    // Select appropriate strategy (no predetermined results)
    const strategy = await this.selectStrategy(config, context);

    // VP-012 Phase 4: Record strategy selection event
    globalPerformanceMonitor.recordEvent(
      PerformanceEventType.STRATEGY_SELECTED,
      strategy.strategyId,
      {
        discoveryTime: 0,
        handlersFound: 0,
        memoryUsage: 0,
        strategyUsed: strategy.strategyId,
        timestamp: new Date(),
        success: true,
        metadata: {
          performanceMode: config.performanceMode,
          contexts: config.contexts,
          parallelProcessing: config.parallelRegistration,
          skipDiscovery: config.skipDiscovery,
        },
      },
      {
        correlationId: context.correlationId,
        sessionId: context.sessionId,
        userId: context.userId,
        tenantId: context.tenantId,
      }
    );

    try {
      // Execute real optimization strategy
      const result = await strategy.optimize(context);

      // VP-012 Phase 4: Record strategy execution event
      globalPerformanceMonitor.recordEvent(
        PerformanceEventType.STRATEGY_EXECUTED,
        strategy.strategyId,
        result.metrics,
        {
          correlationId: context.correlationId,
          sessionId: context.sessionId,
          userId: context.userId,
          tenantId: context.tenantId,
        }
      );

      // VP-012 Phase 4: Record cache events if applicable
      if (result.metrics.metadata?.cacheHit === true) {
        globalPerformanceMonitor.recordEvent(
          PerformanceEventType.CACHE_HIT,
          strategy.strategyId,
          result.metrics
        );
      } else if (result.metrics.metadata?.cacheHit === false) {
        globalPerformanceMonitor.recordEvent(
          PerformanceEventType.CACHE_MISS,
          strategy.strategyId,
          result.metrics
        );
      }

      // VP-012 Phase 4: Record parallel execution events
      if (result.metrics.metadata?.parallelEfficiency !== undefined) {
        globalPerformanceMonitor.recordEvent(
          PerformanceEventType.PARALLEL_EXECUTION,
          strategy.strategyId,
          result.metrics
        );
      }

      // VP-012 Phase 4: Record discovery completion
      globalPerformanceMonitor.recordEvent(
        PerformanceEventType.DISCOVERY_COMPLETED,
        strategy.strategyId,
        result.metrics
      );

      return {
        handlers: result.handlers,
        metrics: result.metrics,
        strategyUsed: strategy.strategyId,
      };
    } catch (error) {
      console.error(`[PerformanceOrchestrator] Strategy ${strategy.strategyId} failed:`, error);

      // VP-012 Phase 4: Record strategy failure event
      globalPerformanceMonitor.recordEvent(
        PerformanceEventType.STRATEGY_FAILED,
        strategy.strategyId,
        {
          discoveryTime: 0,
          handlersFound: 0,
          memoryUsage: 0,
          strategyUsed: strategy.strategyId,
          timestamp: new Date(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );

      // Fallback to standard strategy (graceful degradation)
      if (strategy.strategyId !== 'standard-discovery') {
        console.warn(`[PerformanceOrchestrator] Falling back to standard discovery`);

        // VP-012 Phase 4: Record fallback triggered event
        globalPerformanceMonitor.recordEvent(
          PerformanceEventType.FALLBACK_TRIGGERED,
          'standard-discovery',
          {
            discoveryTime: 0,
            handlersFound: 0,
            memoryUsage: 0,
            strategyUsed: 'standard-discovery',
            timestamp: new Date(),
            success: true,
            metadata: {
              originalStrategy: strategy.strategyId,
              fallbackReason: error instanceof Error ? error.message : 'Unknown error',
            },
          }
        );

        const fallbackStrategy = this.strategies.get('standard-discovery');
        if (!fallbackStrategy) {
          throw new Error('Standard discovery strategy not available for fallback');
        }
        const fallbackResult = await fallbackStrategy.optimize(context);

        return {
          handlers: fallbackResult.handlers,
          metrics: {
            ...fallbackResult.metrics,
            error: `Primary strategy failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: {
              ...fallbackResult.metrics.metadata,
              fallbackUsed: true,
              originalStrategy: strategy.strategyId,
            },
          },
          strategyUsed: 'standard-discovery',
        };
      }

      throw error;
    }
  }

  /**
   * Select appropriate strategy based on configuration and context
   * REAL STRATEGY SELECTION: Based on actual conditions, not predetermined
   */
  private async selectStrategy(
    config: PerformanceConfigurationOptions,
    context: IPerformanceContext
  ): Promise<IPerformanceStrategy> {
    // Strategy 1: Pre-compiled registry (if available)
    if (config.skipDiscovery && config.preCompiledRegistry) {
      const preCompiledStrategy = this.strategies.get('pre-compiled-registry');
      if (preCompiledStrategy?.canHandle(context)) {
        return preCompiledStrategy;
      }
    }

    // Strategy 2: Selective discovery (context-based optimization)
    if (config.contexts?.length) {
      const selectiveStrategy = this.strategies.get('selective-discovery');
      if (selectiveStrategy?.canHandle(context)) {
        return selectiveStrategy;
      }
    }

    // Strategy 3: Parallel discovery (enterprise mode with multiple plugins)
    if (config.parallelRegistration && config.performanceMode === 'enterprise') {
      const parallelStrategy = this.strategies.get('parallel-discovery');
      if (parallelStrategy?.canHandle(context)) {
        return parallelStrategy;
      }
    }

    // Strategy 4: Cached discovery (production optimization without parallel)
    if (
      config.autoOptimize &&
      (config.performanceMode === 'production' || config.performanceMode === 'enterprise')
    ) {
      const cachedStrategy = this.strategies.get('cached-discovery');
      if (cachedStrategy?.canHandle(context)) {
        return cachedStrategy;
      }
    }

    // Strategy 5: Standard discovery (always available fallback)
    const standardStrategy = this.strategies.get('standard-discovery');
    if (!standardStrategy) {
      throw new Error('Standard discovery strategy not registered - this should never happen');
    }
    return standardStrategy;
  }

  /**
   * Register a performance optimization strategy
   */
  registerStrategy(strategy: IPerformanceStrategy): void {
    this.strategies.set(strategy.strategyId, strategy);
  }

  /**
   * Get all registered strategies
   */
  getRegisteredStrategies(): Array<{
    id: string;
    displayName: string;
    description: string;
  }> {
    return Array.from(this.strategies.values()).map(strategy => ({
      id: strategy.strategyId,
      displayName: strategy.displayName,
      description: strategy.description,
    }));
  }

  /**
   * Validate that all strategies are properly configured
   */
  async validateStrategies(context: IPerformanceContext): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    for (const [id, strategy] of this.strategies) {
      try {
        if (strategy.validatePrerequisites) {
          const isValid = await strategy.validatePrerequisites(context);
          if (!isValid) {
            errors.push(`Strategy ${id} prerequisites not met`);
          }
        }
      } catch (error) {
        errors.push(
          `Strategy ${id} validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get strategy by ID
   */
  getStrategy(strategyId: string): IPerformanceStrategy | null {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * Register default strategies
   */
  private registerDefaultStrategies(): void {
    // Always register standard strategy as baseline
    this.registerStrategy(new StandardDiscoveryStrategy());

    // VP-012 Phase 2: Register all new optimization strategies
    this.registerStrategy(new SelectiveDiscoveryStrategy());
    this.registerStrategy(new CachedDiscoveryStrategy());
    this.registerStrategy(new ParallelDiscoveryStrategy());
    this.registerStrategy(new PreCompiledRegistryStrategy());
  }
}
