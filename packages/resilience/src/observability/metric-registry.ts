/**
 * Metric registry and event bus implementation
 * Zero external dependencies - pure TypeScript implementation
 */

import type {
  Metric,
  HistogramMetric,
  TimerMetric,
  MetricCollector,
  MetricRegistry,
  ObservabilityEvent,
  ObservabilityEventListener,
  ObservabilityEventBus
} from './metrics-interfaces';

/**
 * Default metric registry implementation
 */
export class DefaultMetricRegistry implements MetricRegistry {
  private collectors = new Map<string, MetricCollector>();

  register(collector: MetricCollector): void {
    const name = collector.getName();
    if (this.collectors.has(name)) {
      throw new Error(`Collector with name '${name}' is already registered`);
    }
    this.collectors.set(name, collector);
  }

  unregister(collectorName: string): void {
    this.collectors.delete(collectorName);
  }

  getCollectors(): ReadonlyArray<MetricCollector> {
    return Array.from(this.collectors.values());
  }

  collectAll(): ReadonlyArray<Metric | HistogramMetric | TimerMetric> {
    const allMetrics: (Metric | HistogramMetric | TimerMetric)[] = [];

    for (const collector of this.collectors.values()) {
      try {
        const metrics = collector.collect();
        allMetrics.push(...metrics);
      } catch (error) {
        // Log error but continue with other collectors
        console.warn(`Failed to collect metrics from ${collector.getName()}:`, error);
      }
    }

    return allMetrics;
  }

  clear(): void {
    this.collectors.clear();
  }

  /**
   * Get collector by name
   */
  getCollector(name: string): MetricCollector | undefined {
    return this.collectors.get(name);
  }

  /**
   * Get all collector names
   */
  getCollectorNames(): ReadonlyArray<string> {
    return Array.from(this.collectors.keys());
  }
}

/**
 * Default observability event bus implementation
 */
export class DefaultObservabilityEventBus implements ObservabilityEventBus {
  private listeners = new Map<string, Set<ObservabilityEventListener>>();
  private globalListeners = new Set<ObservabilityEventListener>();

  subscribe(eventType: string, listener: ObservabilityEventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }

  subscribeAll(listener: ObservabilityEventListener): void {
    this.globalListeners.add(listener);
  }

  unsubscribe(eventType: string, listener: ObservabilityEventListener): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  async emit(event: ObservabilityEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    // Emit to global listeners
    for (const listener of this.globalListeners) {
      promises.push(this.safeInvoke(listener, event));
    }

    // Emit to specific event type listeners
    const eventListeners = this.listeners.get(event.eventType);
    if (eventListeners) {
      for (const listener of eventListeners) {
        promises.push(this.safeInvoke(listener, event));
      }
    }

    await Promise.allSettled(promises);
  }

  private async safeInvoke(listener: ObservabilityEventListener, event: ObservabilityEvent): Promise<void> {
    try {
      await listener(event);
    } catch (error) {
      console.warn('Event listener error:', error);
    }
  }

  getListenerCount(eventType: string): number {
    const eventListeners = this.listeners.get(eventType);
    return (eventListeners?.size ?? 0) + this.globalListeners.size;
  }

  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }

  /**
   * Get all event types with listeners
   */
  getEventTypes(): ReadonlyArray<string> {
    return Array.from(this.listeners.keys());
  }
}

/**
 * Singleton registry instance for global access
 */
export class GlobalMetricRegistry {
  private static instance: DefaultMetricRegistry;

  static getInstance(): DefaultMetricRegistry {
    if (!GlobalMetricRegistry.instance) {
      GlobalMetricRegistry.instance = new DefaultMetricRegistry();
    }
    return GlobalMetricRegistry.instance;
  }

  static reset(): void {
    if (GlobalMetricRegistry.instance) {
      GlobalMetricRegistry.instance.clear();
    }
  }
}

/**
 * Singleton event bus instance for global access
 */
export class GlobalObservabilityEventBus {
  private static instance: DefaultObservabilityEventBus;

  static getInstance(): DefaultObservabilityEventBus {
    if (!GlobalObservabilityEventBus.instance) {
      GlobalObservabilityEventBus.instance = new DefaultObservabilityEventBus();
    }
    return GlobalObservabilityEventBus.instance;
  }

  static reset(): void {
    if (GlobalObservabilityEventBus.instance) {
      GlobalObservabilityEventBus.instance.clear();
    }
  }
}

/**
 * Utility class for creating observability events
 */
export class ObservabilityEventFactory {
  /**
   * Create a resilience pattern execution event
   */
  static createExecutionEvent(
    source: string,
    patternType: string,
    success: boolean,
    duration: number,
    additionalData: Record<string, unknown> = {}
  ): ObservabilityEvent {
    return {
      timestamp: Date.now(),
      source,
      eventType: 'resilience.execution',
      severity: success ? 'info' : 'warn',
      data: {
        patternType,
        success,
        duration,
        ...additionalData
      }
    };
  }

  /**
   * Create a circuit breaker state change event
   */
  static createCircuitBreakerStateChangeEvent(
    source: string,
    oldState: string,
    newState: string,
    additionalData: Record<string, unknown> = {}
  ): ObservabilityEvent {
    return {
      timestamp: Date.now(),
      source,
      eventType: 'resilience.circuit_breaker.state_change',
      severity: newState === 'OPEN' ? 'warn' : 'info',
      data: {
        oldState,
        newState,
        ...additionalData
      }
    };
  }

  /**
   * Create a retry attempt event
   */
  static createRetryAttemptEvent(
    source: string,
    attempt: number,
    maxAttempts: number,
    delay: number,
    additionalData: Record<string, unknown> = {}
  ): ObservabilityEvent {
    return {
      timestamp: Date.now(),
      source,
      eventType: 'resilience.retry.attempt',
      severity: 'info',
      data: {
        attempt,
        maxAttempts,
        delay,
        ...additionalData
      }
    };
  }

  /**
   * Create a bulkhead rejection event
   */
  static createBulkheadRejectionEvent(
    source: string,
    reason: 'QUEUE_FULL' | 'MAX_CONCURRENCY',
    activeExecutions: number,
    queuedExecutions: number,
    additionalData: Record<string, unknown> = {}
  ): ObservabilityEvent {
    return {
      timestamp: Date.now(),
      source,
      eventType: 'resilience.bulkhead.rejection',
      severity: 'warn',
      data: {
        reason,
        activeExecutions,
        queuedExecutions,
        ...additionalData
      }
    };
  }

  /**
   * Create a timeout event
   */
  static createTimeoutEvent(
    source: string,
    timeoutDuration: number,
    actualDuration: number,
    additionalData: Record<string, unknown> = {}
  ): ObservabilityEvent {
    return {
      timestamp: Date.now(),
      source,
      eventType: 'resilience.timeout',
      severity: 'warn',
      data: {
        timeoutDuration,
        actualDuration,
        ...additionalData
      }
    };
  }

  /**
   * Create a custom resilience event
   */
  static createCustomEvent(
    source: string,
    eventType: string,
    data: Record<string, unknown>,
    severity: 'info' | 'warn' | 'error' = 'info'
  ): ObservabilityEvent {
    return {
      timestamp: Date.now(),
      source,
      eventType,
      severity,
      data
    };
  }
}
