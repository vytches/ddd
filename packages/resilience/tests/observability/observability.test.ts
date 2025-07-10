import { describe, it, expect, beforeEach } from 'vitest';
import type { Metric, HistogramMetric, TimerMetric } from '../../src/index';
import {
  CircuitBreakerMetricCollector,
  RetryMetricCollector,
  BulkheadMetricCollector,
  TimeoutMetricCollector,
  DefaultMetricRegistry,
  DefaultObservabilityEventBus,
  ObservabilityEventFactory,
  JsonMetricExporter,
  PrometheusMetricExporter,
  CsvMetricExporter,
  TextMetricExporter,
  MetricExporterFactory,
} from '../../src/index';

describe('Observability System', () => {
  describe('CircuitBreakerMetricCollector', () => {
    let collector: CircuitBreakerMetricCollector;

    beforeEach(() => {
      collector = new CircuitBreakerMetricCollector('test-cb', { service: 'payment' });
    });

    it('should collect circuit breaker metrics', () => {
      collector.recordExecution(true, 100);
      collector.recordExecution(false, 200);
      collector.recordStateChange('OPEN', 'CLOSED');
      collector.recordRejection();

      const metrics = collector.collect();

      expect(metrics).toHaveLength(10); // Expected number of metrics
      expect(metrics.some(m => m.name === 'resilience_execution_total')).toBe(true);
      expect(metrics.some(m => m.name === 'resilience_success_total')).toBe(true);
      expect(metrics.some(m => m.name === 'resilience_failure_total')).toBe(true);
      expect(metrics.some(m => m.name === 'resilience_rejected_total')).toBe(true);
    });

    it('should track state transitions', () => {
      collector.recordStateChange('HALF_OPEN', 'OPEN');
      collector.recordStateChange('CLOSED', 'HALF_OPEN');
      collector.recordStateChange('OPEN', 'HALF_OPEN');

      const metrics = collector.collect();
      const transitionMetrics = metrics.filter(
        m => m.name === 'resilience_state_transitions_total'
      );

      expect(transitionMetrics).toHaveLength(3);
    });

    it('should reset metrics', () => {
      collector.recordExecution(true, 100);
      collector.reset();

      const metrics = collector.collect();
      const executionMetric = metrics.find(m => m.name === 'resilience_execution_total') as Metric;

      expect(executionMetric?.value).toBe(0);
    });
  });

  describe('RetryMetricCollector', () => {
    let collector: RetryMetricCollector;

    beforeEach(() => {
      collector = new RetryMetricCollector('test-retry', { service: 'email' });
    });

    it('should collect retry metrics', () => {
      collector.recordExecution(true, 150, 2, false);
      collector.recordExecution(false, 300, 3, true);

      const metrics = collector.collect();

      expect(metrics).toHaveLength(9);
      expect(metrics.some(m => m.name === 'resilience_retry_attempts_total')).toBe(true);
      expect(metrics.some(m => m.name === 'resilience_max_retries_reached_total')).toBe(true);
      expect(metrics.some(m => m.name === 'resilience_retry_attempts_avg')).toBe(true);
    });
  });

  describe('BulkheadMetricCollector', () => {
    let collector: BulkheadMetricCollector;

    beforeEach(() => {
      collector = new BulkheadMetricCollector('test-bulkhead', 5, 10, { service: 'reports' });
    });

    it('should collect bulkhead metrics', () => {
      collector.recordExecution(true, 500);
      collector.recordActiveExecutions(3);
      collector.recordQueuedExecutions(2);
      collector.recordRejection();

      const metrics = collector.collect();

      expect(metrics).toHaveLength(11);
      expect(metrics.some(m => m.name === 'resilience_active_executions')).toBe(true);
      expect(metrics.some(m => m.name === 'resilience_queued_executions')).toBe(true);
      expect(metrics.some(m => m.name === 'resilience_utilization')).toBe(true);
    });
  });

  describe('TimeoutMetricCollector', () => {
    let collector: TimeoutMetricCollector;

    beforeEach(() => {
      collector = new TimeoutMetricCollector('test-timeout', { service: 'database' });
    });

    it('should collect timeout metrics', () => {
      collector.recordExecution(true, 800, false);
      collector.recordExecution(false, 5000, true, 3000);

      const metrics = collector.collect();

      expect(metrics).toHaveLength(7);
      expect(metrics.some(m => m.name === 'resilience_timeout_total')).toBe(true);
      expect(metrics.some(m => m.name === 'resilience_timeout_duration_avg')).toBe(true);
    });
  });

  describe('DefaultMetricRegistry', () => {
    let registry: DefaultMetricRegistry;
    let collector: CircuitBreakerMetricCollector;

    beforeEach(() => {
      registry = new DefaultMetricRegistry();
      collector = new CircuitBreakerMetricCollector('test');
    });

    it('should register and manage collectors', () => {
      registry.register(collector);

      expect(registry.getCollectors()).toHaveLength(1);
      expect(registry.getCollector('circuit_breaker_test')).toBe(collector);
    });

    it('should collect metrics from all collectors', () => {
      const collector2 = new RetryMetricCollector('test');
      registry.register(collector);
      registry.register(collector2);

      collector.recordExecution(true, 100);
      collector2.recordExecution(true, 200, 1, false);

      const allMetrics = registry.collectAll();
      expect(allMetrics.length).toBeGreaterThan(0);
    });

    it('should unregister collectors', () => {
      registry.register(collector);
      registry.unregister('circuit_breaker_test');

      expect(registry.getCollectors()).toHaveLength(0);
    });

    it('should throw when registering duplicate collectors', () => {
      registry.register(collector);

      expect(() => registry.register(collector)).toThrow('already registered');
    });
  });

  describe('DefaultObservabilityEventBus', () => {
    let eventBus: DefaultObservabilityEventBus;

    beforeEach(() => {
      eventBus = new DefaultObservabilityEventBus();
    });

    it('should subscribe and emit events', async () => {
      const events: unknown[] = [];
      const listener = (event: unknown) => {
        events.push(event);
      };

      eventBus.subscribe('test.event', listener);

      const event = ObservabilityEventFactory.createCustomEvent('test', 'test.event', {
        data: 'value',
      });
      await eventBus.emit(event);

      expect(events).toHaveLength(1);
      expect((events[0] as any).eventType).toBe('test.event');
    });

    it('should support global listeners', async () => {
      const events: unknown[] = [];
      const globalListener = (event: unknown) => {
        events.push(event);
      };

      eventBus.subscribeAll(globalListener);

      const event1 = ObservabilityEventFactory.createCustomEvent('test', 'type1', {});
      const event2 = ObservabilityEventFactory.createCustomEvent('test', 'type2', {});

      await eventBus.emit(event1);
      await eventBus.emit(event2);

      expect(events).toHaveLength(2);
    });

    it('should unsubscribe listeners', async () => {
      const events: unknown[] = [];
      const listener = (event: unknown) => {
        events.push(event);
      };

      eventBus.subscribe('test.event', listener);
      eventBus.unsubscribe('test.event', listener);

      const event = ObservabilityEventFactory.createCustomEvent('test', 'test.event', {});
      await eventBus.emit(event);

      expect(events).toHaveLength(0);
    });
  });

  describe('ObservabilityEventFactory', () => {
    it('should create execution events', () => {
      const event = ObservabilityEventFactory.createExecutionEvent(
        'test-service',
        'circuit_breaker',
        true,
        100
      );

      expect(event.eventType).toBe('resilience.execution');
      expect(event.source).toBe('test-service');
      expect(event.severity).toBe('info');
      expect(event.data.success).toBe(true);
    });

    it('should create circuit breaker state change events', () => {
      const event = ObservabilityEventFactory.createCircuitBreakerStateChangeEvent(
        'payment-service',
        'CLOSED',
        'OPEN'
      );

      expect(event.eventType).toBe('resilience.circuit_breaker.state_change');
      expect(event.severity).toBe('warn');
      expect(event.data.oldState).toBe('CLOSED');
      expect(event.data.newState).toBe('OPEN');
    });

    it('should create retry attempt events', () => {
      const event = ObservabilityEventFactory.createRetryAttemptEvent('email-service', 2, 3, 1000);

      expect(event.eventType).toBe('resilience.retry.attempt');
      expect(event.data.attempt).toBe(2);
      expect(event.data.maxAttempts).toBe(3);
    });
  });

  describe('Metric Exporters', () => {
    let collector: CircuitBreakerMetricCollector;
    let metrics: (Metric | HistogramMetric | TimerMetric)[];

    beforeEach(() => {
      collector = new CircuitBreakerMetricCollector('test', { service: 'test' });
      collector.recordExecution(true, 100);
      metrics = [...collector.collect()];
    });

    it('should export JSON format', () => {
      const exporter = new JsonMetricExporter(true);
      const output = exporter.export(metrics);

      expect(output).toContain('"metrics"');
      expect(output).toContain('"timestamp"');

      const parsed = JSON.parse(output);
      expect(parsed.metrics).toHaveLength(metrics.length);
    });

    it('should export Prometheus format', () => {
      const exporter = new PrometheusMetricExporter();
      const output = exporter.export(metrics);

      expect(output).toContain('# HELP');
      expect(output).toContain('# TYPE');
      expect(output).toContain('resilience_');
    });

    it('should export CSV format', () => {
      const exporter = new CsvMetricExporter();
      const output = exporter.export(metrics);

      expect(output).toContain('name,type,timestamp,value,labels,description');
      expect(output.split('\n')).toHaveLength(metrics.length + 1); // +1 for header
    });

    it('should export text format', () => {
      const exporter = new TextMetricExporter();
      const output = exporter.export(metrics);

      expect(output).toContain('Resilience Metrics Report');
      expect(output).toContain('CIRCUIT_BREAKER METRICS');
    });

    it('should create exporters via factory', () => {
      const jsonExporter = MetricExporterFactory.create('json');
      const prometheusExporter = MetricExporterFactory.create('prometheus');

      expect(jsonExporter.getFormat()).toBe('json');
      expect(prometheusExporter.getFormat()).toBe('prometheus');
    });

    it('should list available formats', () => {
      const formats = MetricExporterFactory.getAvailableFormats();

      expect(formats).toContain('json');
      expect(formats).toContain('prometheus');
      expect(formats).toContain('csv');
      expect(formats).toContain('text');
    });
  });
});
