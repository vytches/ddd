/**
 * Metric collectors implementation for resilience patterns
 * Zero external dependencies - pure TypeScript implementation
 */

import type {
  BulkheadMetrics,
  CircuitBreakerMetrics,
  HistogramBucket,
  HistogramMetric,
  Metric,
  MetricCollector,
  MetricLabels,
  RetryMetrics,
  TimeoutMetrics,
  TimerMetric,
} from './metrics-interfaces';

/**
 * Base metric collector with common functionality
 */
abstract class BaseMetricCollector implements MetricCollector {
  protected readonly name: string;
  protected readonly labels: MetricLabels;

  constructor(name: string, labels: MetricLabels = {}) {
    this.name = name;
    this.labels = { ...labels };
  }

  getName(): string {
    return this.name;
  }

  abstract collect(): ReadonlyArray<Metric | HistogramMetric | TimerMetric>;

  reset?(): void;

  protected createMetric(
    name: string,
    value: number | string | boolean,
    type: 'counter' | 'gauge' = 'gauge',
    description?: string | undefined,
    additionalLabels: MetricLabels = {}
  ): Metric {
    return {
      name: `resilience_${name}`,
      type,
      labels: { ...this.labels, ...additionalLabels },
      value,
      timestamp: Date.now(),
      description: description ?? undefined,
    };
  }

  protected createTimerMetric(
    name: string,
    duration: number,
    unit: 'ms' | 'ns' | 's' = 'ms',
    description?: string | undefined,
    additionalLabels: MetricLabels = {}
  ): TimerMetric {
    return {
      name: `resilience_${name}`,
      type: 'timer',
      labels: { ...this.labels, ...additionalLabels },
      timestamp: Date.now(),
      duration,
      unit,
      description: description ?? undefined,
    };
  }

  protected createHistogramMetric(
    name: string,
    buckets: ReadonlyArray<HistogramBucket>,
    sum: number,
    count: number,
    description?: string | undefined,
    additionalLabels: MetricLabels = {}
  ): HistogramMetric {
    return {
      name: `resilience_${name}`,
      type: 'histogram',
      labels: { ...this.labels, ...additionalLabels },
      timestamp: Date.now(),
      buckets,
      sum,
      count,
      description: description ?? undefined,
    };
  }
}

export class CircuitBreakerMetricCollector extends BaseMetricCollector {
  private metrics: CircuitBreakerMetrics;
  private executionTimes: number[] = [];
  private readonly maxHistorySize = 1000;

  constructor(instanceName: string, labels: MetricLabels = {}) {
    super(`circuit_breaker_${instanceName}`, {
      pattern: 'circuit_breaker',
      instance: instanceName,
      ...labels,
    });

    this.metrics = {
      patternName: 'circuit_breaker',
      instanceName,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      avgExecutionTime: 0,
      lastExecutionTime: 0,
      labels: this.labels,
      state: 'CLOSED',
      openToHalfOpenCount: 0,
      halfOpenToClosedCount: 0,
      halfOpenToOpenCount: 0,
      rejectedCount: 0,
    };
  }

  recordExecution(success: boolean, executionTime: number): void {
    this.metrics = {
      ...this.metrics,
      executionCount: this.metrics.executionCount + 1,
      successCount: this.metrics.successCount + (success ? 1 : 0),
      failureCount: this.metrics.failureCount + (success ? 0 : 1),
      lastExecutionTime: executionTime,
    };

    this.executionTimes.push(executionTime);
    if (this.executionTimes.length > this.maxHistorySize) {
      this.executionTimes.shift();
    }

    this.metrics = {
      ...this.metrics,
      avgExecutionTime:
        this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length,
    };
  }

  recordStateChange(
    newState: 'CLOSED' | 'OPEN' | 'HALF_OPEN',
    oldState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  ): void {
    let updates: Partial<CircuitBreakerMetrics> = { state: newState };

    if (oldState === 'OPEN' && newState === 'HALF_OPEN') {
      updates = { ...updates, openToHalfOpenCount: this.metrics.openToHalfOpenCount + 1 };
    } else if (oldState === 'HALF_OPEN' && newState === 'CLOSED') {
      updates = { ...updates, halfOpenToClosedCount: this.metrics.halfOpenToClosedCount + 1 };
    } else if (oldState === 'HALF_OPEN' && newState === 'OPEN') {
      updates = { ...updates, halfOpenToOpenCount: this.metrics.halfOpenToOpenCount + 1 };
    }

    this.metrics = { ...this.metrics, ...updates };
  }

  recordRejection(): void {
    this.metrics = {
      ...this.metrics,
      rejectedCount: this.metrics.rejectedCount + 1,
    };
  }

  collect(): ReadonlyArray<Metric | HistogramMetric | TimerMetric> {
    const stateLabels = { state: this.metrics.state };

    return [
      this.createMetric(
        'execution_total',
        this.metrics.executionCount,
        'counter',
        'Total executions',
        stateLabels
      ),
      this.createMetric(
        'success_total',
        this.metrics.successCount,
        'counter',
        'Successful executions',
        stateLabels
      ),
      this.createMetric(
        'failure_total',
        this.metrics.failureCount,
        'counter',
        'Failed executions',
        stateLabels
      ),
      this.createMetric(
        'rejected_total',
        this.metrics.rejectedCount,
        'counter',
        'Rejected executions',
        stateLabels
      ),
      this.createMetric(
        'state_transitions_total',
        this.metrics.openToHalfOpenCount,
        'counter',
        'Open to Half-Open transitions',
        { transition: 'open_to_half_open' }
      ),
      this.createMetric(
        'state_transitions_total',
        this.metrics.halfOpenToClosedCount,
        'counter',
        'Half-Open to Closed transitions',
        { transition: 'half_open_to_closed' }
      ),
      this.createMetric(
        'state_transitions_total',
        this.metrics.halfOpenToOpenCount,
        'counter',
        'Half-Open to Open transitions',
        { transition: 'half_open_to_open' }
      ),
      this.createTimerMetric(
        'execution_duration',
        this.metrics.lastExecutionTime,
        'ms',
        'Last execution duration',
        stateLabels
      ),
      this.createTimerMetric(
        'execution_duration_avg',
        this.metrics.avgExecutionTime,
        'ms',
        'Average execution duration',
        stateLabels
      ),
      this.createHistogramMetric(
        'execution_duration_histogram',
        this.createExecutionTimeHistogram(),
        this.executionTimes.reduce((sum, time) => sum + time, 0),
        this.executionTimes.length,
        'Execution duration histogram',
        stateLabels
      ),
    ];
  }

  private createExecutionTimeHistogram(): HistogramBucket[] {
    const buckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, Infinity];
    return buckets.map(upperBound => ({
      upperBound,
      count: this.executionTimes.filter(time => time <= upperBound).length,
    }));
  }

  override reset(): void {
    this.metrics = {
      patternName: 'circuit_breaker',
      instanceName: this.metrics.instanceName,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      avgExecutionTime: 0,
      lastExecutionTime: 0,
      labels: this.labels,
      state: 'CLOSED',
      openToHalfOpenCount: 0,
      halfOpenToClosedCount: 0,
      halfOpenToOpenCount: 0,
      rejectedCount: 0,
    };
    this.executionTimes = [];
  }
}

export class RetryMetricCollector extends BaseMetricCollector {
  private metrics: RetryMetrics;
  private executionTimes: number[] = [];
  private retryAttempts: number[] = [];
  private readonly maxHistorySize = 1000;

  constructor(instanceName: string, labels: MetricLabels = {}) {
    super(`retry_${instanceName}`, { pattern: 'retry', instance: instanceName, ...labels });

    this.metrics = {
      patternName: 'retry',
      instanceName,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      avgExecutionTime: 0,
      lastExecutionTime: 0,
      labels: this.labels,
      totalRetryCount: 0,
      maxRetriesReachedCount: 0,
      avgRetryCount: 0,
    };
  }

  recordExecution(
    success: boolean,
    executionTime: number,
    retryCount: number,
    maxRetriesReached: boolean
  ): void {
    this.metrics = {
      ...this.metrics,
      executionCount: this.metrics.executionCount + 1,
      successCount: this.metrics.successCount + (success ? 1 : 0),
      failureCount: this.metrics.failureCount + (success ? 0 : 1),
      lastExecutionTime: executionTime,
      totalRetryCount: this.metrics.totalRetryCount + retryCount,
      maxRetriesReachedCount: this.metrics.maxRetriesReachedCount + (maxRetriesReached ? 1 : 0),
    };

    this.executionTimes.push(executionTime);
    this.retryAttempts.push(retryCount);

    if (this.executionTimes.length > this.maxHistorySize) {
      this.executionTimes.shift();
      this.retryAttempts.shift();
    }

    this.metrics = {
      ...this.metrics,
      avgExecutionTime:
        this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length,
      avgRetryCount:
        this.retryAttempts.reduce((sum, count) => sum + count, 0) / this.retryAttempts.length,
    };
  }

  collect(): ReadonlyArray<Metric | HistogramMetric | TimerMetric> {
    return [
      this.createMetric(
        'execution_total',
        this.metrics.executionCount,
        'counter',
        'Total executions'
      ),
      this.createMetric(
        'success_total',
        this.metrics.successCount,
        'counter',
        'Successful executions'
      ),
      this.createMetric('failure_total', this.metrics.failureCount, 'counter', 'Failed executions'),
      this.createMetric(
        'retry_attempts_total',
        this.metrics.totalRetryCount,
        'counter',
        'Total retry attempts'
      ),
      this.createMetric(
        'max_retries_reached_total',
        this.metrics.maxRetriesReachedCount,
        'counter',
        'Max retries reached count'
      ),
      this.createMetric(
        'retry_attempts_avg',
        this.metrics.avgRetryCount,
        'gauge',
        'Average retry attempts per execution'
      ),
      this.createTimerMetric(
        'execution_duration',
        this.metrics.lastExecutionTime,
        'ms',
        'Last execution duration'
      ),
      this.createTimerMetric(
        'execution_duration_avg',
        this.metrics.avgExecutionTime,
        'ms',
        'Average execution duration'
      ),
      this.createHistogramMetric(
        'retry_attempts_histogram',
        this.createRetryAttemptsHistogram(),
        this.retryAttempts.reduce((sum, count) => sum + count, 0),
        this.retryAttempts.length,
        'Retry attempts histogram'
      ),
    ];
  }

  private createRetryAttemptsHistogram(): HistogramBucket[] {
    const buckets = [0, 1, 2, 3, 5, 10, 15, 20, Infinity];
    return buckets.map(upperBound => ({
      upperBound,
      count: this.retryAttempts.filter(count => count <= upperBound).length,
    }));
  }

  override reset(): void {
    this.metrics = {
      patternName: 'retry',
      instanceName: this.metrics.instanceName,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      avgExecutionTime: 0,
      lastExecutionTime: 0,
      labels: this.labels,
      totalRetryCount: 0,
      maxRetriesReachedCount: 0,
      avgRetryCount: 0,
    };
    this.executionTimes = [];
    this.retryAttempts = [];
  }
}

export class BulkheadMetricCollector extends BaseMetricCollector {
  private metrics: BulkheadMetrics;
  private executionTimes: number[] = [];
  private readonly maxHistorySize = 1000;

  constructor(
    instanceName: string,
    maxConcurrency: number,
    queueCapacity: number,
    labels: MetricLabels = {}
  ) {
    super(`bulkhead_${instanceName}`, { pattern: 'bulkhead', instance: instanceName, ...labels });

    this.metrics = {
      patternName: 'bulkhead',
      instanceName,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      avgExecutionTime: 0,
      lastExecutionTime: 0,
      labels: this.labels,
      activeExecutions: 0,
      queuedExecutions: 0,
      rejectedExecutions: 0,
      maxConcurrency,
      queueCapacity,
    };
  }

  recordExecution(success: boolean, executionTime: number): void {
    this.metrics = {
      ...this.metrics,
      executionCount: this.metrics.executionCount + 1,
      successCount: this.metrics.successCount + (success ? 1 : 0),
      failureCount: this.metrics.failureCount + (success ? 0 : 1),
      lastExecutionTime: executionTime,
    };

    this.executionTimes.push(executionTime);
    if (this.executionTimes.length > this.maxHistorySize) {
      this.executionTimes.shift();
    }

    this.metrics = {
      ...this.metrics,
      avgExecutionTime:
        this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length,
    };
  }

  recordActiveExecutions(count: number): void {
    this.metrics = { ...this.metrics, activeExecutions: count };
  }

  recordQueuedExecutions(count: number): void {
    this.metrics = { ...this.metrics, queuedExecutions: count };
  }

  recordRejection(): void {
    this.metrics = {
      ...this.metrics,
      rejectedExecutions: this.metrics.rejectedExecutions + 1,
    };
  }

  collect(): ReadonlyArray<Metric | HistogramMetric | TimerMetric> {
    return [
      this.createMetric(
        'execution_total',
        this.metrics.executionCount,
        'counter',
        'Total executions'
      ),
      this.createMetric(
        'success_total',
        this.metrics.successCount,
        'counter',
        'Successful executions'
      ),
      this.createMetric('failure_total', this.metrics.failureCount, 'counter', 'Failed executions'),
      this.createMetric(
        'rejected_total',
        this.metrics.rejectedExecutions,
        'counter',
        'Rejected executions'
      ),
      this.createMetric(
        'active_executions',
        this.metrics.activeExecutions,
        'gauge',
        'Current active executions'
      ),
      this.createMetric(
        'queued_executions',
        this.metrics.queuedExecutions,
        'gauge',
        'Current queued executions'
      ),
      this.createMetric(
        'max_concurrency',
        this.metrics.maxConcurrency,
        'gauge',
        'Maximum allowed concurrency'
      ),
      this.createMetric('queue_capacity', this.metrics.queueCapacity, 'gauge', 'Queue capacity'),
      this.createMetric(
        'utilization',
        this.metrics.activeExecutions / this.metrics.maxConcurrency,
        'gauge',
        'Concurrency utilization ratio'
      ),
      this.createTimerMetric(
        'execution_duration',
        this.metrics.lastExecutionTime,
        'ms',
        'Last execution duration'
      ),
      this.createTimerMetric(
        'execution_duration_avg',
        this.metrics.avgExecutionTime,
        'ms',
        'Average execution duration'
      ),
    ];
  }

  override reset(): void {
    this.metrics = {
      patternName: 'bulkhead',
      instanceName: this.metrics.instanceName,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      avgExecutionTime: 0,
      lastExecutionTime: 0,
      labels: this.labels,
      activeExecutions: 0,
      queuedExecutions: 0,
      rejectedExecutions: 0,
      maxConcurrency: this.metrics.maxConcurrency,
      queueCapacity: this.metrics.queueCapacity,
    };
    this.executionTimes = [];
  }
}

export class TimeoutMetricCollector extends BaseMetricCollector {
  private metrics: TimeoutMetrics;
  private executionTimes: number[] = [];
  private timeoutDurations: number[] = [];
  private readonly maxHistorySize = 1000;

  constructor(instanceName: string, labels: MetricLabels = {}) {
    super(`timeout_${instanceName}`, { pattern: 'timeout', instance: instanceName, ...labels });

    this.metrics = {
      patternName: 'timeout',
      instanceName,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      avgExecutionTime: 0,
      lastExecutionTime: 0,
      labels: this.labels,
      timeoutCount: 0,
      avgTimeoutDuration: 0,
    };
  }

  recordExecution(
    success: boolean,
    executionTime: number,
    timedOut: boolean,
    timeoutDuration?: number
  ): void {
    this.metrics = {
      ...this.metrics,
      executionCount: this.metrics.executionCount + 1,
      successCount: this.metrics.successCount + (success ? 1 : 0),
      failureCount: this.metrics.failureCount + (success ? 0 : 1),
      lastExecutionTime: executionTime,
      timeoutCount: this.metrics.timeoutCount + (timedOut ? 1 : 0),
    };

    this.executionTimes.push(executionTime);
    if (timeoutDuration !== undefined) {
      this.timeoutDurations.push(timeoutDuration);
    }

    if (this.executionTimes.length > this.maxHistorySize) {
      this.executionTimes.shift();
    }
    if (this.timeoutDurations.length > this.maxHistorySize) {
      this.timeoutDurations.shift();
    }

    this.metrics = {
      ...this.metrics,
      avgExecutionTime:
        this.executionTimes.reduce((sum, time) => sum + time, 0) / this.executionTimes.length,
      avgTimeoutDuration:
        this.timeoutDurations.length > 0
          ? this.timeoutDurations.reduce((sum, duration) => sum + duration, 0) /
            this.timeoutDurations.length
          : 0,
    };
  }

  collect(): ReadonlyArray<Metric | HistogramMetric | TimerMetric> {
    return [
      this.createMetric(
        'execution_total',
        this.metrics.executionCount,
        'counter',
        'Total executions'
      ),
      this.createMetric(
        'success_total',
        this.metrics.successCount,
        'counter',
        'Successful executions'
      ),
      this.createMetric('failure_total', this.metrics.failureCount, 'counter', 'Failed executions'),
      this.createMetric(
        'timeout_total',
        this.metrics.timeoutCount,
        'counter',
        'Timeout occurrences'
      ),
      this.createTimerMetric(
        'execution_duration',
        this.metrics.lastExecutionTime,
        'ms',
        'Last execution duration'
      ),
      this.createTimerMetric(
        'execution_duration_avg',
        this.metrics.avgExecutionTime,
        'ms',
        'Average execution duration'
      ),
      this.createTimerMetric(
        'timeout_duration_avg',
        this.metrics.avgTimeoutDuration,
        'ms',
        'Average timeout duration'
      ),
    ];
  }

  override reset(): void {
    this.metrics = {
      patternName: 'timeout',
      instanceName: this.metrics.instanceName,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      avgExecutionTime: 0,
      lastExecutionTime: 0,
      labels: this.labels,
      timeoutCount: 0,
      avgTimeoutDuration: 0,
    };
    this.executionTimes = [];
    this.timeoutDurations = [];
  }
}
