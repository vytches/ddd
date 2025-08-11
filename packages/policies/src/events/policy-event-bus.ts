import type { PolicyEvent } from './policy-evaluation-event';

export type PolicyEventHandler<T extends PolicyEvent = PolicyEvent> = (
  event: T
) => Promise<void> | void;

export interface PolicyEventSubscription {
  readonly id: string;
  readonly eventTypes: PolicyEvent['type'][];
  readonly handler: PolicyEventHandler;
  readonly domains?: string[]; // Filter by domains
  readonly policyIds?: string[]; // Filter by policy IDs
  readonly tags?: string[]; // Filter by policy tags
  readonly priority?: number; // Handler execution priority (higher first)
  readonly enabled?: boolean; // Can be disabled without unsubscribing
}

export interface PolicyEventBusConfig {
  readonly maxHandlers?: number; // Maximum number of event handlers
  readonly enableMetrics?: boolean; // Track event bus metrics
  readonly parallelExecution?: boolean; // Execute handlers in parallel
  readonly errorStrategy?: 'ignore' | 'log' | 'throw'; // How to handle handler errors
  readonly timeout?: number; // Handler execution timeout in milliseconds
}

export interface PolicyEventBusMetrics {
  totalEvents: number;
  eventsByType: Map<PolicyEvent['type'], number>;
  totalHandlers: number;
  enabledHandlers: number;
  averageHandlerExecutionTime: number;
  handlerErrors: number;
  lastEventTime?: Date;
}

export class PolicyEventBus {
  private readonly subscriptions = new Map<string, PolicyEventSubscription>();
  private readonly config: Required<PolicyEventBusConfig>;
  private readonly metrics: PolicyEventBusMetrics;

  constructor(config: PolicyEventBusConfig = {}) {
    this.config = {
      maxHandlers: config.maxHandlers ?? 100,
      enableMetrics: config.enableMetrics ?? false,
      parallelExecution: config.parallelExecution ?? true,
      errorStrategy: config.errorStrategy ?? 'log',
      timeout: config.timeout ?? 5000,
    };

    this.metrics = {
      totalEvents: 0,
      eventsByType: new Map(),
      totalHandlers: 0,
      enabledHandlers: 0,
      averageHandlerExecutionTime: 0,
      handlerErrors: 0,
    };
  }

  /**
   * Publish an event to all matching subscribers
   */
  public async publish<T extends PolicyEvent>(event: T): Promise<void> {
    if (this.config.enableMetrics) {
      this.updateMetrics(event);
    }

    const matchingSubscriptions = this.getMatchingSubscriptions(event);

    if (matchingSubscriptions.length === 0) {
      return;
    }

    const handlerPromises = matchingSubscriptions.map(subscription =>
      this.executeHandler(subscription, event)
    );

    if (this.config.parallelExecution) {
      // Execute all handlers in parallel
      if (this.config.errorStrategy === 'throw') {
        // Use Promise.all to propagate errors when throw strategy is enabled
        await Promise.all(handlerPromises);
      } else {
        // Use Promise.allSettled to handle errors gracefully
        await Promise.allSettled(handlerPromises);
      }
    } else {
      // Execute handlers sequentially by priority
      const sortedSubscriptions = matchingSubscriptions.sort(
        (a, b) => (b.priority || 0) - (a.priority || 0)
      );

      for (const subscription of sortedSubscriptions) {
        await this.executeHandler(subscription, event);
      }
    }
  }

  /**
   * Subscribe to policy events
   */
  public subscribe(subscription: Omit<PolicyEventSubscription, 'id'>): string {
    if (this.subscriptions.size >= this.config.maxHandlers) {
      throw new Error(`Maximum number of event handlers (${this.config.maxHandlers}) exceeded`);
    }

    const id = this.generateSubscriptionId();
    const fullSubscription: PolicyEventSubscription = {
      ...subscription,
      id,
      enabled: subscription.enabled ?? true,
      priority: subscription.priority ?? 0,
    };

    this.subscriptions.set(id, fullSubscription);
    this.updateHandlerMetrics();

    return id;
  }

  /**
   * Unsubscribe from policy events
   */
  public unsubscribe(subscriptionId: string): boolean {
    const result = this.subscriptions.delete(subscriptionId);
    if (result) {
      this.updateHandlerMetrics();
    }
    return result;
  }

  /**
   * Enable or disable a subscription
   */
  public setSubscriptionEnabled(subscriptionId: string, enabled: boolean): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    const updatedSubscription: PolicyEventSubscription = {
      ...subscription,
      enabled,
    };

    this.subscriptions.set(subscriptionId, updatedSubscription);
    this.updateHandlerMetrics();
    return true;
  }

  /**
   * Get all active subscriptions
   */
  public getSubscriptions(): PolicyEventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get event bus metrics
   */
  public getMetrics(): PolicyEventBusMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear all subscriptions
   */
  public clear(): void {
    this.subscriptions.clear();
    this.updateHandlerMetrics();
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    Object.assign(this.metrics, {
      totalEvents: 0,
      eventsByType: new Map(),
      averageHandlerExecutionTime: 0,
      handlerErrors: 0,
      lastEventTime: undefined,
    });
  }

  private getMatchingSubscriptions(event: PolicyEvent): PolicyEventSubscription[] {
    return Array.from(this.subscriptions.values()).filter(subscription => {
      // Check if subscription is enabled
      if (!subscription.enabled) {
        return false;
      }

      // Check event type filter
      if (!subscription.eventTypes.includes(event.type)) {
        return false;
      }

      // Check domain filter
      if (subscription.domains && !subscription.domains.includes(event.domain)) {
        return false;
      }

      // Check policy ID filter
      if (subscription.policyIds && !subscription.policyIds.includes(event.policyId)) {
        return false;
      }

      // Check tags filter (only for events that have tags)
      if (subscription.tags && subscription.tags.length > 0) {
        const eventTags = 'tags' in event ? event.tags || [] : [];
        const hasMatchingTag = subscription.tags.some(tag => eventTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  }

  private async executeHandler(
    subscription: PolicyEventSubscription,
    event: PolicyEvent
  ): Promise<void> {
    const startTime = performance.now();

    try {
      // Create timeout promise if timeout is configured
      if (this.config.timeout > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Handler timeout after ${this.config.timeout}ms`)),
            this.config.timeout
          );
        });

        const handlerPromise = Promise.resolve(subscription.handler(event));
        await Promise.race([handlerPromise, timeoutPromise]);
      } else {
        await Promise.resolve(subscription.handler(event));
      }

      // Update execution time metrics
      if (this.config.enableMetrics) {
        const duration = performance.now() - startTime;
        this.updateHandlerExecutionMetrics(duration);
      }
    } catch (error) {
      if (this.config.enableMetrics) {
        this.metrics.handlerErrors++;
      }

      const errorMessage = `Policy event handler '${subscription.id}' failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;

      switch (this.config.errorStrategy) {
        case 'ignore':
          // Do nothing
          break;
        case 'log':
          console.error(errorMessage, error);
          break;
        case 'throw':
          throw new Error(errorMessage);
      }
    }
  }

  private updateMetrics(event: PolicyEvent): void {
    this.metrics.totalEvents++;

    const currentCount = this.metrics.eventsByType.get(event.type) || 0;
    this.metrics.eventsByType.set(event.type, currentCount + 1);

    this.metrics.lastEventTime = new Date();
  }

  private updateHandlerMetrics(): void {
    this.metrics.totalHandlers = this.subscriptions.size;
    this.metrics.enabledHandlers = Array.from(this.subscriptions.values()).filter(
      sub => sub.enabled
    ).length;
  }

  private updateHandlerExecutionMetrics(duration: number): void {
    // Simple moving average for handler execution time
    const alpha = 0.1; // Smoothing factor
    if (this.metrics.averageHandlerExecutionTime === 0) {
      this.metrics.averageHandlerExecutionTime = duration;
    } else {
      this.metrics.averageHandlerExecutionTime =
        alpha * duration + (1 - alpha) * this.metrics.averageHandlerExecutionTime;
    }
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const globalPolicyEventBus = new PolicyEventBus({
  enableMetrics: true,
  parallelExecution: true,
  errorStrategy: 'log',
});

export class PolicyEventHandlers {
  /**
   * Create a logging event handler
   */
  public static createLoggingHandler(
    options: {
      logLevel?: 'debug' | 'info' | 'warn' | 'error';
      includeEntity?: boolean;
      includeContext?: boolean;
    } = {}
  ): PolicyEventHandler {
    const { logLevel = 'info', includeEntity = false, includeContext = false } = options;

    return (event: PolicyEvent) => {
      const logData: Record<string, unknown> = {
        type: event.type,
        policyId: event.policyId,
        domain: event.domain,
        timestamp: event.timestamp,
      };

      if (event.type === 'POLICY_EVALUATED') {
        logData.success = event.result.isSuccess;
        logData.duration = event.duration;
        if (event.result.isFailure) {
          logData.violationCode = event.result.error.code;
          logData.violationMessage = event.result.error.message;
        }
      } else if (event.type === 'POLICY_EVALUATION_ERROR') {
        logData.error = event.error.message;
        logData.duration = event.duration;
      }

      if (includeEntity) {
        logData.entity = event.entity;
      }

      if (includeContext && 'context' in event) {
        logData.context = event.context;
      }

      console[logLevel]('Policy Event:', logData);
    };
  }

  /**
   * Create a metrics collection handler
   */
  public static createMetricsHandler(
    metricsCollector: (event: PolicyEvent) => void
  ): PolicyEventHandler {
    return metricsCollector;
  }

  /**
   * Create a filtering handler that only processes specific events
   */
  public static createFilteringHandler(
    filter: (event: PolicyEvent) => boolean,
    handler: PolicyEventHandler
  ): PolicyEventHandler {
    return (event: PolicyEvent) => {
      if (filter(event)) {
        return handler(event);
      }
    };
  }
}
