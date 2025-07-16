/**
 * Core metrics and observability interfaces for resilience patterns
 * Zero external dependencies - pure TypeScript implementation
 */

/**
 * @llm-summary Type definition for metric type
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * MetricType type implementing infrastructure service for metric type operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: MetricType = {} as MetricType;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

/**
 * @llm-summary Type definition for metric value
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * MetricValue type implementing infrastructure service for metric value operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: MetricValue = {} as MetricValue;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type MetricValue = number | string | boolean;

/**
 * @llm-summary Contract for metric labels functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * MetricLabels interface implementing infrastructure service for metric labels operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteMetricLabels implements MetricLabels {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface MetricLabels {
  [key: string]: string;
}

/**
 * @llm-summary Contract for metric functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * Metric interface implementing infrastructure service for metric operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteMetric implements Metric {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface Metric {
  readonly name: string;
  readonly type: MetricType;
  readonly labels: MetricLabels;
  readonly value: MetricValue;
  readonly timestamp: number;
  readonly description?: string | undefined;
}

/**
 * @llm-summary Contract for histogram bucket functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * HistogramBucket interface implementing infrastructure service for histogram bucket operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteHistogramBucket implements HistogramBucket {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface HistogramBucket {
  readonly upperBound: number;
  readonly count: number;
}

/**
 * @llm-summary Contract for histogram metric functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * HistogramMetric interface implementing infrastructure service for histogram metric operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteHistogramMetric implements HistogramMetric {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface HistogramMetric extends Omit<Metric, 'value'> {
  readonly type: 'histogram';
  readonly buckets: ReadonlyArray<HistogramBucket>;
  readonly sum: number;
  readonly count: number;
}

/**
 * @llm-summary Contract for timer metric functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * TimerMetric interface implementing infrastructure service for timer metric operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTimerMetric implements TimerMetric {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface TimerMetric extends Omit<Metric, 'value'> {
  readonly type: 'timer';
  readonly duration: number;
  readonly unit: 'ms' | 'ns' | 's';
}

/**
 * @llm-summary Contract for metric collector functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * MetricCollector interface implementing infrastructure service for metric collector operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteMetricCollector implements MetricCollector {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface MetricCollector {
  /**
   * Collect all metrics from this collector
   */
  collect(): ReadonlyArray<Metric | HistogramMetric | TimerMetric>;

  /**
   * Get collector name for identification
   */
  getName(): string;

  /**
   * Reset collector state (useful for testing)
   */
  reset?(): void;
}

/**
 * @llm-summary Contract for metric registry functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * MetricRegistry interface implementing infrastructure service for metric registry operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteMetricRegistry implements MetricRegistry {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface MetricRegistry {
  /**
   * Register a metric collector
   */
  register(collector: MetricCollector): void;

  /**
   * Unregister a metric collector
   */
  unregister(collectorName: string): void;

  /**
   * Get all registered collectors
   */
  getCollectors(): ReadonlyArray<MetricCollector>;

  /**
   * Collect all metrics from all registered collectors
   */
  collectAll(): ReadonlyArray<Metric | HistogramMetric | TimerMetric>;

  /**
   * Clear all collectors
   */
  clear(): void;
}

/**
 * @llm-summary Contract for metric exporter functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * MetricExporter interface implementing infrastructure service for metric exporter operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteMetricExporter implements MetricExporter {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface MetricExporter {
  /**
   * Export metrics in the target format
   */
  export(metrics: ReadonlyArray<Metric | HistogramMetric | TimerMetric>): string | Promise<string>;

  /**
   * Get the export format name
   */
  getFormat(): string;
}

/**
 * @llm-summary Contract for observability event functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ObservabilityEvent interface implementing infrastructure service for observability event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteObservabilityEvent implements ObservabilityEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ObservabilityEvent {
  readonly timestamp: number;
  readonly source: string;
  readonly eventType: string;
  readonly data: Record<string, unknown>;
  readonly severity?: 'info' | 'warn' | 'error';
}

/**
 * @llm-summary Contract for observability event listener functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ObservabilityEventListener interface implementing infrastructure service for observability event listener operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteObservabilityEventListener implements ObservabilityEventListener {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ObservabilityEventListener {
  (event: ObservabilityEvent): void | Promise<void>;
}

/**
 * @llm-summary Contract for observability event bus functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ObservabilityEventBus interface implementing infrastructure service for observability event bus operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteObservabilityEventBus implements ObservabilityEventBus {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ObservabilityEventBus {
  /**
   * Subscribe to events of a specific type
   */
  subscribe(eventType: string, listener: ObservabilityEventListener): void;

  /**
   * Subscribe to all events
   */
  subscribeAll(listener: ObservabilityEventListener): void;

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, listener: ObservabilityEventListener): void;

  /**
   * Emit an event
   */
  emit(event: ObservabilityEvent): Promise<void>;

  /**
   * Get number of listeners for an event type
   */
  getListenerCount(eventType: string): number;

  /**
   * Clear all listeners
   */
  clear(): void;
}

/**
 * @llm-summary Contract for resilience metrics functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ResilienceMetrics interface implementing infrastructure service for resilience metrics operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteResilienceMetrics implements ResilienceMetrics {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ResilienceMetrics {
  readonly patternName: string;
  readonly instanceName: string;
  readonly executionCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly avgExecutionTime: number;
  readonly lastExecutionTime: number;
  readonly labels: MetricLabels;
}

/**
 * @llm-summary Contract for circuit breaker metrics functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CircuitBreakerMetrics interface implementing infrastructure service for circuit breaker metrics operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCircuitBreakerMetrics implements CircuitBreakerMetrics {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CircuitBreakerMetrics extends ResilienceMetrics {
  readonly state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  readonly openToHalfOpenCount: number;
  readonly halfOpenToClosedCount: number;
  readonly halfOpenToOpenCount: number;
  readonly rejectedCount: number;
}

/**
 * @llm-summary Contract for retry metrics functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * RetryMetrics interface implementing infrastructure service for retry metrics operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteRetryMetrics implements RetryMetrics {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface RetryMetrics extends ResilienceMetrics {
  readonly totalRetryCount: number;
  readonly maxRetriesReachedCount: number;
  readonly avgRetryCount: number;
}

/**
 * @llm-summary Contract for bulkhead metrics functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * BulkheadMetrics interface implementing infrastructure service for bulkhead metrics operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteBulkheadMetrics implements BulkheadMetrics {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface BulkheadMetrics extends ResilienceMetrics {
  readonly activeExecutions: number;
  readonly queuedExecutions: number;
  readonly rejectedExecutions: number;
  readonly maxConcurrency: number;
  readonly queueCapacity: number;
}

/**
 * @llm-summary Contract for timeout metrics functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * TimeoutMetrics interface implementing infrastructure service for timeout metrics operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTimeoutMetrics implements TimeoutMetrics {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface TimeoutMetrics extends ResilienceMetrics {
  readonly timeoutCount: number;
  readonly avgTimeoutDuration: number;
}
