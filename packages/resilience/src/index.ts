// Most commonly used - prioritized exports
export {
  CircuitBreaker,
  CircuitBreakerHalfOpenLimitError,
  CircuitBreakerOpenError,
  CircuitBreakerState,
} from './patterns/circuit-breaker';

export type { CircuitBreakerConfig, CircuitBreakerMetrics } from './patterns/circuit-breaker';

export { MaxRetriesExceededError, RetryPolicy } from './patterns/retry';

export { Bulkhead, BulkheadRejectedException } from './patterns/bulkhead';

export { CompensationStack, runCompensated } from './patterns/compensation-stack';

export type { CompensationFailure, CompensationOutcome } from './patterns/compensation-stack';

export {
  BulkheadStrategy,
  CircuitBreakerStrategy,
  CompositeResilienceStrategy,
  ResiliencePolicyBuilder,
  RetryStrategy,
  TimeoutStrategy,
} from './patterns/resilience-strategy';

export type { ResilienceStrategy } from './patterns/resilience-strategy';

export {
  DefaultResilienceContext,
  OperationCancelledError,
  TimeoutError,
} from './core/resilience-context';

// Core functionality - full exports removed for better tree-shaking

// Observability and metrics (explicit exports to avoid naming conflicts)
export type {
  HistogramBucket,
  HistogramMetric,
  Metric,
  MetricCollector,
  MetricExporter,
  MetricLabels,
  MetricRegistry,
  MetricType,
  MetricValue,
  ObservabilityEvent,
  ObservabilityEventBus,
  ObservabilityEventListener,
  TimerMetric,
} from './observability';

export {
  BulkheadMetricCollector,
  CircuitBreakerMetricCollector,
  CompositeMetricExporter,
  CsvMetricExporter,
  DefaultMetricRegistry,
  DefaultObservabilityEventBus,
  GlobalMetricRegistry,
  GlobalObservabilityEventBus,
  JsonMetricExporter,
  MetricExporterFactory,
  ObservabilityEventFactory,
  PrometheusMetricExporter,
  RetryMetricCollector,
  TextMetricExporter,
  TimeoutMetricCollector,
} from './observability';

// Decorators (re-exported with different names to avoid conflicts)
export {
  Bulkhead as BulkheadDecorator,
  CircuitBreaker as CircuitBreakerDecorator,
  getResilienceConfig,
  getResilienceMetrics,
  Resilience as ResilienceDecorator,
  Retry as RetryDecorator,
  Timeout as TimeoutDecorator,
} from './decorators/resilience-decorators';

export type {
  BulkheadDecoratorConfig,
  CircuitBreakerDecoratorConfig,
  CompositeResilienceConfig,
  ResilienceDecoratorConfig,
  RetryDecoratorConfig,
  TimeoutDecoratorConfig,
} from './decorators/resilience-decorators';
