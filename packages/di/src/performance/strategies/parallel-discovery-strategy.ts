/**
 * VP-012: Parallel Discovery Strategy - Promise.allSettled Implementation
 * Eliminates performance theater with real concurrent processing
 */

import type { HandlerInfo } from '../../discovery/handler-discovery.interface';
import type {
  IPerformanceContext,
  IPerformanceMetrics,
  IPerformanceStrategy,
} from '../abstractions/performance-strategy.interface';

/**
 * Parallel discovery strategy using Promise.allSettled for concurrent processing
 * OPTIMIZATION: Executes plugin discovery concurrently with proper error isolation
 */
export class ParallelDiscoveryStrategy implements IPerformanceStrategy {
  readonly strategyId = 'parallel-discovery';
  readonly displayName = 'Parallel Discovery';
  readonly description =
    'Promise.allSettled based concurrent plugin processing - isolates failures and maximizes throughput';

  /**
   * Parallel strategy is optimal for enterprise mode with multiple plugins
   */
  canHandle(context: IPerformanceContext): boolean {
    return (
      context.performanceMode === 'enterprise' &&
      context.parallelProcessing === true &&
      context.discoveryPlugins.length > 1
    ); // Need multiple plugins to benefit from parallelization
  }

  /**
   * Execute parallel discovery with REAL concurrent processing
   * CRITICAL: Uses Promise.allSettled for actual parallelization, not sequential fake timing
   */
  async optimize(context: IPerformanceContext): Promise<{
    handlers: HandlerInfo[];
    metrics: IPerformanceMetrics;
  }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    let handlers: HandlerInfo[] = [];
    let error: string | undefined;
    let parallelResults: ParallelDiscoveryResult[] = [];

    try {
      // REAL WORK: Execute parallel discovery with Promise.allSettled
      parallelResults = await this.executeParallelDiscovery(context, startTime);

      // Aggregate results from all parallel executions
      handlers = this.aggregateParallelResults(parallelResults, context);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Parallel discovery failed';
      console.error(`[ParallelDiscoveryStrategy] Error: ${error}`);
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    // Calculate parallel execution statistics
    const parallelStats = this.calculateParallelStatistics(parallelResults);

    // REAL METRICS: Actual timing with parallelization performance data
    const metrics: IPerformanceMetrics = {
      discoveryTime: endTime - startTime,
      handlersFound: handlers.length,
      memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
      strategyUsed: this.strategyId,
      timestamp: new Date(),
      success: !error,
      error,
      metadata: {
        performanceMode: context.performanceMode,
        parallelPlugins: context.discoveryPlugins.length,
        successfulPlugins: parallelStats.successful,
        failedPlugins: parallelStats.failed,
        parallelEfficiency: parallelStats.efficiency,
        longestPluginTime: parallelStats.longestTime,
        shortestPluginTime: parallelStats.shortestTime,
        totalSequentialTime: parallelStats.totalSequentialTime,
        parallelSpeedup: parallelStats.speedup,
        handlerDistribution: parallelStats.handlerDistribution,
      },
    };

    return { handlers, metrics };
  }

  /**
   * Execute parallel discovery using Promise.allSettled
   * CRITICAL: Real concurrent execution with proper error isolation
   */
  private async executeParallelDiscovery(
    context: IPerformanceContext,
    startTime: number
  ): Promise<ParallelDiscoveryResult[]> {
    // Create timeout controller for parallel operations
    const timeoutController = context.timeout ? new AbortController() : null;
    let timeoutId: NodeJS.Timeout | null = null;

    if (timeoutController && context.timeout) {
      timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, context.timeout);
    }

    try {
      // PARALLEL EXECUTION: Promise.allSettled for real concurrency
      const pluginPromises = context.discoveryPlugins.map((plugin, index) =>
        this.executePluginWithMetrics(plugin, index, context, timeoutController?.signal)
      );

      // Wait for all plugins to complete (success or failure)
      const settledResults = await Promise.allSettled(pluginPromises);

      // Process settled results into structured format
      return settledResults.map((result, index) => ({
        pluginIndex: index,
        pluginName: context.discoveryPlugins?.[index]?.constructor?.name || 'Unknown Plugin',
        success: result.status === 'fulfilled' ? result.value.success : false,
        handlers: result.status === 'fulfilled' ? result.value.handlers : [],
        executionTime: result.status === 'fulfilled' ? result.value.executionTime : 0,
        error:
          result.status === 'rejected'
            ? result.reason
            : result.status === 'fulfilled'
              ? result.value.error
              : undefined,
      }));
    } finally {
      // Cleanup timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Execute single plugin with performance metrics
   * REAL PLUGIN WORK: Actual reflection operations with timing
   */
  private async executePluginWithMetrics(
    plugin: any,
    index: number,
    context: IPerformanceContext,
    abortSignal?: AbortSignal
  ): Promise<PluginExecutionResult> {
    const pluginStartTime = performance.now();

    try {
      // Check for abort signal
      if (abortSignal?.aborted) {
        throw new Error('Plugin execution aborted due to timeout');
      }

      // REAL REFLECTION WORK: Execute actual plugin discovery
      // Create a race between plugin execution and abort signal
      const pluginPromise = plugin.discoverHandlers();
      const abortPromise = abortSignal
        ? new Promise<never>((_, reject) => {
            abortSignal.addEventListener('abort', () => {
              reject(new Error('Plugin execution aborted due to timeout'));
            });
          })
        : Promise.resolve(null);

      const handlers = abortSignal
        ? await Promise.race([pluginPromise, abortPromise])
        : await pluginPromise;

      const pluginEndTime = performance.now();
      const executionTime = pluginEndTime - pluginStartTime;

      return {
        handlers,
        executionTime,
        success: true,
      };
    } catch (error) {
      const pluginEndTime = performance.now();
      const executionTime = pluginEndTime - pluginStartTime;

      console.warn(`[ParallelDiscoveryStrategy] Plugin ${plugin.constructor.name} failed:`, error);

      return {
        handlers: [],
        executionTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown plugin error',
      };
    }
  }

  /**
   * Aggregate results from parallel plugin executions
   * ENTERPRISE: Proper error handling and result consolidation
   */
  private aggregateParallelResults(
    results: ParallelDiscoveryResult[],
    context: IPerformanceContext
  ): HandlerInfo[] {
    const allHandlers: HandlerInfo[] = [];

    // Collect handlers from successful plugin executions
    for (const result of results) {
      if (result.success && result.handlers.length > 0) {
        allHandlers.push(...result.handlers);
      }
    }

    // Apply context filtering if specified
    let filteredHandlers = allHandlers;
    if (context.contexts && context.contexts.length > 0) {
      filteredHandlers = this.filterHandlersByContexts(allHandlers, context.contexts);
    }

    // Apply handler limit if specified (enterprise resource management)
    if (context.maxHandlers && filteredHandlers.length > context.maxHandlers) {
      console.warn(
        `[ParallelDiscoveryStrategy] Handler limit reached: ${context.maxHandlers}, found: ${filteredHandlers.length}`
      );
      filteredHandlers = filteredHandlers.slice(0, context.maxHandlers);
    }

    // Remove duplicates (enterprise requirement)
    return this.removeDuplicateHandlers(filteredHandlers);
  }

  /**
   * Calculate parallel execution statistics
   * REAL METRICS: Actual performance analysis of parallel execution
   */
  private calculateParallelStatistics(results: ParallelDiscoveryResult[]): ParallelStatistics {
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const executionTimes = results.map(r => r.executionTime);

    const longestTime = Math.max(...executionTimes);
    const shortestTime = Math.min(...executionTimes);
    const totalSequentialTime = executionTimes.reduce((sum, time) => sum + time, 0);

    // Parallel efficiency: how much faster we were vs sequential
    const speedup = longestTime > 0 ? totalSequentialTime / longestTime : 1;
    const efficiency = speedup / results.length; // Efficiency relative to ideal parallelization

    // Handler distribution across plugins
    const handlerCounts = results.map(r => r.handlers.length);
    const handlerDistribution = {
      min: Math.min(...handlerCounts),
      max: Math.max(...handlerCounts),
      avg: handlerCounts.reduce((sum, count) => sum + count, 0) / handlerCounts.length,
      total: handlerCounts.reduce((sum, count) => sum + count, 0),
    };

    return {
      successful,
      failed,
      efficiency,
      longestTime,
      shortestTime,
      totalSequentialTime,
      speedup,
      handlerDistribution,
    };
  }

  /**
   * Filter handlers by specified contexts
   */
  private filterHandlersByContexts(handlers: HandlerInfo[], contexts: string[]): HandlerInfo[] {
    const contextSet = new Set(contexts);

    return handlers.filter(handler => {
      const metadata = handler.metadata as { context?: string } | undefined;
      return !metadata?.context || contextSet.has(metadata.context);
    });
  }

  /**
   * Remove duplicate handlers based on message type and handler type
   */
  private removeDuplicateHandlers(handlers: HandlerInfo[]): HandlerInfo[] {
    const seen = new Set<string>();
    return handlers.filter(handler => {
      const key = `${handler.type}:${handler.messageType?.name}:${handler.handlerType?.name}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Validate strategy prerequisites
   */
  async validatePrerequisites(context: IPerformanceContext): Promise<boolean> {
    return (
      context.discoveryPlugins.length > 1 &&
      context.performanceMode === 'enterprise' &&
      context.parallelProcessing === true
    );
  }
}

// Supporting types for parallel execution
interface ParallelDiscoveryResult {
  pluginIndex: number;
  pluginName: string;
  success: boolean;
  handlers: HandlerInfo[];
  executionTime: number;
  error?: string;
}

interface PluginExecutionResult {
  handlers: HandlerInfo[];
  executionTime: number;
  success: boolean;
  error?: string;
}

interface ParallelStatistics {
  successful: number;
  failed: number;
  efficiency: number;
  longestTime: number;
  shortestTime: number;
  totalSequentialTime: number;
  speedup: number;
  handlerDistribution: {
    min: number;
    max: number;
    avg: number;
    total: number;
  };
}
