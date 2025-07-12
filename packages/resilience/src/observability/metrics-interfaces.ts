/**
 * Core metrics and observability interfaces for resilience patterns
 * Zero external dependencies - pure TypeScript implementation
 */

/**
 * Metric types supported by the observability system
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

/**
 * Metric value types
 */
export type MetricValue = number | string | boolean;

/**
 * Labels for metric dimensions
 */
export interface MetricLabels {
  [key: string]: string;
}

/**
 * Base metric data structure
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
 * Histogram bucket for latency and distribution metrics
 */
export interface HistogramBucket {
  readonly upperBound: number;
  readonly count: number;
}

/**
 * Histogram metric with buckets
 */
export interface HistogramMetric extends Omit<Metric, 'value'> {
  readonly type: 'histogram';
  readonly buckets: ReadonlyArray<HistogramBucket>;
  readonly sum: number;
  readonly count: number;
}

/**
 * Timer metric for duration measurements
 */
export interface TimerMetric extends Omit<Metric, 'value'> {
  readonly type: 'timer';
  readonly duration: number;
  readonly unit: 'ms' | 'ns' | 's';
}

/**
 * Metric collector interface for gathering metrics
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
 * Metric registry for managing collectors
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
 * Metric exporter interface for outputting metrics
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
 * Event-based observability for real-time monitoring
 */
export interface ObservabilityEvent {
  readonly timestamp: number;
  readonly source: string;
  readonly eventType: string;
  readonly data: Record<string, unknown>;
  readonly severity?: 'info' | 'warn' | 'error';
}

/**
 * Event listener for observability events
 */
export interface ObservabilityEventListener {
  (event: ObservabilityEvent): void | Promise<void>;
}

/**
 * Event bus for observability events
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
 * Resilience pattern metrics data
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
 * Circuit breaker specific metrics
 */
export interface CircuitBreakerMetrics extends ResilienceMetrics {
  readonly state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  readonly openToHalfOpenCount: number;
  readonly halfOpenToClosedCount: number;
  readonly halfOpenToOpenCount: number;
  readonly rejectedCount: number;
}

/**
 * Retry pattern specific metrics
 */
export interface RetryMetrics extends ResilienceMetrics {
  readonly totalRetryCount: number;
  readonly maxRetriesReachedCount: number;
  readonly avgRetryCount: number;
}

/**
 * Bulkhead pattern specific metrics
 */
export interface BulkheadMetrics extends ResilienceMetrics {
  readonly activeExecutions: number;
  readonly queuedExecutions: number;
  readonly rejectedExecutions: number;
  readonly maxConcurrency: number;
  readonly queueCapacity: number;
}

/**
 * Timeout pattern specific metrics
 */
export interface TimeoutMetrics extends ResilienceMetrics {
  readonly timeoutCount: number;
  readonly avgTimeoutDuration: number;
}
