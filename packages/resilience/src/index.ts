// Most commonly used - prioritized exports
export {
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerOpenError,
} from './patterns/circuit-breaker';

export { RetryPolicy, MaxRetriesExceededError } from './patterns/retry';

export { Bulkhead, BulkheadRejectedException } from './patterns/bulkhead';

export {
  CircuitBreakerStrategy,
  RetryStrategy,
  BulkheadStrategy,
  CompositeResilienceStrategy,
  ResiliencePolicyBuilder,
} from './patterns/resilience-strategy';

export {
  DefaultResilienceContext,
  TimeoutError,
  OperationCancelledError,
} from './core/resilience-context';

// Core functionality - full exports removed for better tree-shaking

// Observability and metrics (explicit exports to avoid naming conflicts)
export type {
  MetricType,
  MetricValue,
  MetricLabels,
  Metric,
  HistogramBucket,
  HistogramMetric,
  TimerMetric,
  MetricCollector,
  MetricRegistry,
  MetricExporter,
  ObservabilityEvent,
  ObservabilityEventListener,
  ObservabilityEventBus,
} from './observability';

export {
  CircuitBreakerMetricCollector,
  RetryMetricCollector,
  BulkheadMetricCollector,
  TimeoutMetricCollector,
  DefaultMetricRegistry,
  DefaultObservabilityEventBus,
  GlobalMetricRegistry,
  GlobalObservabilityEventBus,
  ObservabilityEventFactory,
  JsonMetricExporter,
  PrometheusMetricExporter,
  CsvMetricExporter,
  TextMetricExporter,
  CompositeMetricExporter,
  MetricExporterFactory,
} from './observability';

// Decorators (re-exported with different names to avoid conflicts)
export {
  CircuitBreaker as CircuitBreakerDecorator,
  Retry as RetryDecorator,
  Bulkhead as BulkheadDecorator,
  Resilience as ResilienceDecorator,
  Timeout as TimeoutDecorator,
  getResilienceMetrics,
} from './decorators/resilience-decorators';

export type {
  ResilienceDecoratorConfig,
  CircuitBreakerDecoratorConfig,
  RetryDecoratorConfig,
  BulkheadDecoratorConfig,
  TimeoutDecoratorConfig,
  CompositeResilienceConfig,
} from './decorators/resilience-decorators';
