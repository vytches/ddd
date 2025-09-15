/**
 * VP-012: Performance Monitor - Real-time Strategy Performance Monitoring
 * Enterprise-grade observability for DI performance optimization
 */

import type { IPerformanceMetrics } from './abstractions/performance-strategy.interface';

/**
 * Performance event types for monitoring
 */
export enum PerformanceEventType {
  STRATEGY_SELECTED = 'strategy-selected',
  STRATEGY_EXECUTED = 'strategy-executed',
  STRATEGY_FAILED = 'strategy-failed',
  DISCOVERY_COMPLETED = 'discovery-completed',
  CACHE_HIT = 'cache-hit',
  CACHE_MISS = 'cache-miss',
  PARALLEL_EXECUTION = 'parallel-execution',
  FALLBACK_TRIGGERED = 'fallback-triggered',
}

/**
 * Performance event data structure
 */
export interface PerformanceEvent {
  eventType: PerformanceEventType;
  timestamp: Date;
  strategyId: string;
  metrics: IPerformanceMetrics;
  metadata?: Record<string, any>;
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
}

/**
 * Performance statistics aggregation
 */
export interface PerformanceStats {
  totalExecutions: number;
  totalSuccesses: number;
  totalFailures: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  averageMemoryUsage: number;
  totalHandlersDiscovered: number;
  strategyDistribution: Map<string, number>;
  errorDistribution: Map<string, number>;
  cacheHitRate: number;
  parallelEfficiency: number;
  fallbackRate: number;
  lastUpdated: Date;
}

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  maxExecutionTime: number; // ms
  maxMemoryUsage: number; // bytes
  minCacheHitRate: number; // 0-1
  minParallelEfficiency: number; // 0-1
  maxFallbackRate: number; // 0-1
}

/**
 * Performance alert types
 */
export enum PerformanceAlertType {
  EXECUTION_TIME_EXCEEDED = 'execution-time-exceeded',
  MEMORY_USAGE_HIGH = 'memory-usage-high',
  CACHE_HIT_RATE_LOW = 'cache-hit-rate-low',
  PARALLEL_EFFICIENCY_LOW = 'parallel-efficiency-low',
  FALLBACK_RATE_HIGH = 'fallback-rate-high',
  STRATEGY_FAILURE_SPIKE = 'strategy-failure-spike',
}

/**
 * Performance alert data
 */
export interface PerformanceAlert {
  alertType: PerformanceAlertType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  actualValue: number;
  strategyId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Performance event listener function
 */
export type PerformanceEventListener = (event: PerformanceEvent) => void | Promise<void>;

/**
 * Performance alert listener function
 */
export type PerformanceAlertListener = (alert: PerformanceAlert) => void | Promise<void>;

/**
 * Performance Monitor - Real-time monitoring and alerting system
 * ENTERPRISE: Comprehensive observability for VP-012 strategies
 */
export class PerformanceMonitor {
  private events: PerformanceEvent[] = [];
  private stats: PerformanceStats;
  private thresholds: PerformanceThresholds;
  private eventListeners = new Map<PerformanceEventType, PerformanceEventListener[]>();
  private alertListeners: PerformanceAlertListener[] = [];
  private readonly maxEvents: number;
  private readonly enabled: boolean;

  constructor(
    options: {
      maxEvents?: number;
      enabled?: boolean;
      thresholds?: Partial<PerformanceThresholds>;
    } = {}
  ) {
    this.maxEvents = options.maxEvents || 1000;
    this.enabled = options.enabled ?? true;

    this.thresholds = {
      maxExecutionTime: 5000, // 5 seconds
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      minCacheHitRate: 0.7, // 70%
      minParallelEfficiency: 0.6, // 60%
      maxFallbackRate: 0.1, // 10%
      ...options.thresholds,
    };

    this.stats = this.initializeStats();
  }

  /**
   * Record a performance event
   * REAL MONITORING: Actual event recording and analysis
   */
  recordEvent(
    eventType: PerformanceEventType,
    strategyId: string,
    metrics: IPerformanceMetrics,
    metadata?: Record<string, any>
  ): void {
    if (!this.enabled) return;

    const event: PerformanceEvent = {
      eventType,
      timestamp: new Date(),
      strategyId,
      metrics,
      ...(metadata !== undefined && { metadata }),
      ...(metadata?.correlationId !== undefined && { correlationId: metadata.correlationId }),
      ...(metadata?.sessionId !== undefined && { sessionId: metadata.sessionId }),
      ...(metadata?.userId !== undefined && { userId: metadata.userId }),
      ...(metadata?.tenantId !== undefined && { tenantId: metadata.tenantId }),
    };

    // Add event to circular buffer
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Update statistics
    this.updateStats(event);

    // Emit to listeners
    this.emitEvent(event);

    // Check thresholds and generate alerts
    this.checkThresholds(event);
  }

  /**
   * Get current performance statistics
   */
  getStats(): PerformanceStats {
    return { ...this.stats };
  }

  /**
   * Get recent events with optional filtering
   */
  getRecentEvents(
    limit?: number,
    eventType?: PerformanceEventType,
    strategyId?: string
  ): PerformanceEvent[] {
    let filtered = [...this.events];

    if (eventType) {
      filtered = filtered.filter(e => e.eventType === eventType);
    }

    if (strategyId) {
      filtered = filtered.filter(e => e.strategyId === strategyId);
    }

    // Sort by timestamp (most recent first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Add event listener for specific event type
   */
  addEventListener(eventType: PerformanceEventType, listener: PerformanceEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Add alert listener for performance alerts
   */
  addAlertListener(listener: PerformanceAlertListener): void {
    this.alertListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: PerformanceEventType, listener: PerformanceEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Remove alert listener
   */
  removeAlertListener(listener: PerformanceAlertListener): void {
    const index = this.alertListeners.indexOf(listener);
    if (index !== -1) {
      this.alertListeners.splice(index, 1);
    }
  }

  /**
   * Clear all events and reset statistics
   */
  reset(): void {
    this.events = [];
    this.stats = this.initializeStats();
  }

  /**
   * Get strategy performance comparison
   */
  getStrategyComparison(): Array<{
    strategyId: string;
    executionCount: number;
    averageTime: number;
    successRate: number;
    averageHandlers: number;
  }> {
    const strategyMetrics = new Map<
      string,
      {
        executions: number;
        totalTime: number;
        successes: number;
        totalHandlers: number;
      }
    >();

    for (const event of this.events) {
      if (event.eventType === PerformanceEventType.STRATEGY_EXECUTED) {
        const existing = strategyMetrics.get(event.strategyId) || {
          executions: 0,
          totalTime: 0,
          successes: 0,
          totalHandlers: 0,
        };

        existing.executions++;
        existing.totalTime += event.metrics.discoveryTime;
        existing.totalHandlers += event.metrics.handlersFound;

        if (event.metrics.success) {
          existing.successes++;
        }

        strategyMetrics.set(event.strategyId, existing);
      }
    }

    return Array.from(strategyMetrics.entries()).map(([strategyId, metrics]) => ({
      strategyId,
      executionCount: metrics.executions,
      averageTime: metrics.executions > 0 ? metrics.totalTime / metrics.executions : 0,
      successRate: metrics.executions > 0 ? metrics.successes / metrics.executions : 0,
      averageHandlers: metrics.executions > 0 ? metrics.totalHandlers / metrics.executions : 0,
    }));
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
  }

  /**
   * Get current thresholds configuration
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Initialize statistics structure
   */
  private initializeStats(): PerformanceStats {
    return {
      totalExecutions: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      averageExecutionTime: 0,
      minExecutionTime: Number.MAX_SAFE_INTEGER,
      maxExecutionTime: 0,
      averageMemoryUsage: 0,
      totalHandlersDiscovered: 0,
      strategyDistribution: new Map(),
      errorDistribution: new Map(),
      cacheHitRate: 0,
      parallelEfficiency: 0,
      fallbackRate: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Update performance statistics with new event
   */
  private updateStats(event: PerformanceEvent): void {
    const { metrics } = event;

    // Update execution counts
    if (event.eventType === PerformanceEventType.STRATEGY_EXECUTED) {
      this.stats.totalExecutions++;
      if (metrics.success) {
        this.stats.totalSuccesses++;
      } else {
        this.stats.totalFailures++;
      }

      // Update timing statistics
      const executionTime = metrics.discoveryTime;
      this.stats.minExecutionTime = Math.min(this.stats.minExecutionTime, executionTime);
      this.stats.maxExecutionTime = Math.max(this.stats.maxExecutionTime, executionTime);

      // Recalculate average execution time
      const oldTotal = this.stats.averageExecutionTime * (this.stats.totalExecutions - 1);
      this.stats.averageExecutionTime = (oldTotal + executionTime) / this.stats.totalExecutions;

      // Update memory usage
      if (metrics.memoryUsage) {
        const oldMemoryTotal = this.stats.averageMemoryUsage * (this.stats.totalExecutions - 1);
        this.stats.averageMemoryUsage =
          (oldMemoryTotal + metrics.memoryUsage) / this.stats.totalExecutions;
      }

      // Update handler count
      this.stats.totalHandlersDiscovered += metrics.handlersFound;

      // Update strategy distribution
      const currentCount = this.stats.strategyDistribution.get(event.strategyId) || 0;
      this.stats.strategyDistribution.set(event.strategyId, currentCount + 1);
    }

    // Update error distribution
    if (event.eventType === PerformanceEventType.STRATEGY_FAILED && metrics.error) {
      const currentCount = this.stats.errorDistribution.get(metrics.error) || 0;
      this.stats.errorDistribution.set(metrics.error, currentCount + 1);
    }

    // Update cache statistics
    if (
      event.eventType === PerformanceEventType.CACHE_HIT ||
      event.eventType === PerformanceEventType.CACHE_MISS
    ) {
      const cacheEvents = this.events.filter(
        e =>
          e.eventType === PerformanceEventType.CACHE_HIT ||
          e.eventType === PerformanceEventType.CACHE_MISS
      );
      const cacheHits = cacheEvents.filter(
        e => e.eventType === PerformanceEventType.CACHE_HIT
      ).length;
      this.stats.cacheHitRate = cacheEvents.length > 0 ? cacheHits / cacheEvents.length : 0;
    }

    // Update parallel efficiency
    if (event.eventType === PerformanceEventType.PARALLEL_EXECUTION) {
      const efficiency = metrics.metadata?.parallelEfficiency;
      if (typeof efficiency === 'number') {
        const parallelEvents = this.events.filter(
          e => e.eventType === PerformanceEventType.PARALLEL_EXECUTION
        );
        const totalEfficiency = parallelEvents.reduce((sum, e) => {
          const eventEfficiency = e.metrics.metadata?.parallelEfficiency;
          return sum + (typeof eventEfficiency === 'number' ? eventEfficiency : 0);
        }, 0);
        this.stats.parallelEfficiency =
          parallelEvents.length > 0 ? totalEfficiency / parallelEvents.length : 0;
      }
    }

    // Update fallback rate
    if (event.eventType === PerformanceEventType.FALLBACK_TRIGGERED) {
      const fallbackEvents = this.events.filter(
        e => e.eventType === PerformanceEventType.FALLBACK_TRIGGERED
      ).length;
      this.stats.fallbackRate =
        this.stats.totalExecutions > 0 ? fallbackEvents / this.stats.totalExecutions : 0;
    }

    this.stats.lastUpdated = new Date();
  }

  /**
   * Emit event to listeners
   */
  private async emitEvent(event: PerformanceEvent): Promise<void> {
    const listeners = this.eventListeners.get(event.eventType) || [];

    for (const listener of listeners) {
      try {
        await listener(event);
      } catch (error) {
        console.error(`[PerformanceMonitor] Event listener error:`, error);
      }
    }
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private async checkThresholds(event: PerformanceEvent): Promise<void> {
    const alerts: PerformanceAlert[] = [];

    // Check execution time threshold
    if (event.metrics.discoveryTime > this.thresholds.maxExecutionTime) {
      alerts.push({
        alertType: PerformanceAlertType.EXECUTION_TIME_EXCEEDED,
        severity:
          event.metrics.discoveryTime > this.thresholds.maxExecutionTime * 2 ? 'critical' : 'high',
        message: `Strategy ${event.strategyId} execution time exceeded threshold`,
        threshold: this.thresholds.maxExecutionTime,
        actualValue: event.metrics.discoveryTime,
        strategyId: event.strategyId,
        timestamp: new Date(),
        metadata: { event },
      });
    }

    // Check memory usage threshold
    if (event.metrics.memoryUsage && event.metrics.memoryUsage > this.thresholds.maxMemoryUsage) {
      alerts.push({
        alertType: PerformanceAlertType.MEMORY_USAGE_HIGH,
        severity:
          event.metrics.memoryUsage > this.thresholds.maxMemoryUsage * 1.5 ? 'critical' : 'high',
        message: `Strategy ${event.strategyId} memory usage exceeded threshold`,
        threshold: this.thresholds.maxMemoryUsage,
        actualValue: event.metrics.memoryUsage,
        strategyId: event.strategyId,
        timestamp: new Date(),
        metadata: { event },
      });
    }

    // Check cache hit rate
    if (this.stats.cacheHitRate < this.thresholds.minCacheHitRate && this.stats.cacheHitRate > 0) {
      alerts.push({
        alertType: PerformanceAlertType.CACHE_HIT_RATE_LOW,
        severity:
          this.stats.cacheHitRate < this.thresholds.minCacheHitRate * 0.5 ? 'high' : 'medium',
        message: `Cache hit rate below threshold`,
        threshold: this.thresholds.minCacheHitRate,
        actualValue: this.stats.cacheHitRate,
        timestamp: new Date(),
        metadata: { stats: this.stats },
      });
    }

    // Check parallel efficiency
    if (
      this.stats.parallelEfficiency < this.thresholds.minParallelEfficiency &&
      this.stats.parallelEfficiency > 0
    ) {
      alerts.push({
        alertType: PerformanceAlertType.PARALLEL_EFFICIENCY_LOW,
        severity:
          this.stats.parallelEfficiency < this.thresholds.minParallelEfficiency * 0.5
            ? 'high'
            : 'medium',
        message: `Parallel execution efficiency below threshold`,
        threshold: this.thresholds.minParallelEfficiency,
        actualValue: this.stats.parallelEfficiency,
        timestamp: new Date(),
        metadata: { stats: this.stats },
      });
    }

    // Check fallback rate
    if (this.stats.fallbackRate > this.thresholds.maxFallbackRate) {
      alerts.push({
        alertType: PerformanceAlertType.FALLBACK_RATE_HIGH,
        severity:
          this.stats.fallbackRate > this.thresholds.maxFallbackRate * 2 ? 'critical' : 'high',
        message: `Fallback rate exceeded threshold`,
        threshold: this.thresholds.maxFallbackRate,
        actualValue: this.stats.fallbackRate,
        timestamp: new Date(),
        metadata: { stats: this.stats },
      });
    }

    // Emit alerts
    for (const alert of alerts) {
      await this.emitAlert(alert);
    }
  }

  /**
   * Emit alert to listeners
   */
  private async emitAlert(alert: PerformanceAlert): Promise<void> {
    for (const listener of this.alertListeners) {
      try {
        await listener(alert);
      } catch (error) {
        console.error(`[PerformanceMonitor] Alert listener error:`, error);
      }
    }
  }
}

/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor({
  enabled: process.env.NODE_ENV !== 'test',
  maxEvents: 5000,
});
