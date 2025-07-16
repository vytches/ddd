import type { Result } from '@vytches-ddd/utils';
import type { PolicyContext } from '../core/interfaces';
import type { PolicyViolation } from '../core/models/policy-violation';

/**
 * @llm-summary Contract for policy evaluation event functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyEvaluationEvent interface implementing domain pattern implementation for policy evaluation event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyEvaluationEvent implements PolicyEvaluationEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PolicyEvaluationEvent<T = unknown> {
  readonly type: 'POLICY_EVALUATED';
  readonly policyId: string;
  readonly domain: string;
  readonly name: string;
  readonly version?: string;
  readonly entity: T;
  readonly result: Result<T, PolicyViolation>;
  readonly context: PolicyContext;
  readonly duration: number; // in milliseconds
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
  readonly tags?: string[];
  readonly executionId: string; // Unique ID for this execution
}

/**
 * @llm-summary Contract for policy evaluation error event functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyEvaluationErrorEvent interface implementing domain pattern implementation for policy evaluation error event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyEvaluationErrorEvent implements PolicyEvaluationErrorEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PolicyEvaluationErrorEvent<T = unknown> {
  readonly type: 'POLICY_EVALUATION_ERROR';
  readonly policyId: string;
  readonly domain: string;
  readonly name: string;
  readonly entity: T;
  readonly context: PolicyContext;
  readonly error: Error;
  readonly duration: number; // in milliseconds
  readonly timestamp: Date;
  readonly executionId: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * @llm-summary Contract for policy evaluation started event functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyEvaluationStartedEvent interface implementing domain pattern implementation for policy evaluation started event operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyEvaluationStartedEvent implements PolicyEvaluationStartedEvent {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PolicyEvaluationStartedEvent<T = unknown> {
  readonly type: 'POLICY_EVALUATION_STARTED';
  readonly policyId: string;
  readonly domain: string;
  readonly name: string;
  readonly entity: T;
  readonly context: PolicyContext;
  readonly timestamp: Date;
  readonly executionId: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * @llm-summary Type definition for policy event
 * @llm-domain Pattern
 * @llm-usage Frequent
 *
 * @description
 * PolicyEvent type implementing domain pattern implementation for policy event operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: PolicyEvent = {} as PolicyEvent;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type PolicyEvent<T = unknown> =
  | PolicyEvaluationEvent<T>
  | PolicyEvaluationErrorEvent<T>
  | PolicyEvaluationStartedEvent<T>;

/**
 * @llm-summary PolicyEventBuilder class for policy event builder operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyEventBuilder class implementing domain pattern implementation for policy event builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyEventBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PolicyEventBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PolicyEventBuilder<T> {
  private constructor(
    private readonly baseData: {
      policyId: string;
      domain: string;
      name: string;
      entity: T;
      context: PolicyContext;
      executionId: string;
    }
  ) {}

  /**
   * Create a new event builder
   */
  public static create<T>(data: {
    policyId: string;
    domain: string;
    name: string;
    entity: T;
    context: PolicyContext;
    executionId?: string;
  }): PolicyEventBuilder<T> {
    return new PolicyEventBuilder({
      ...data,
      executionId: data.executionId || PolicyEventBuilder.generateExecutionId(),
    });
  }

  /**
   * Create a policy evaluation started event
   */
  public evaluationStarted(metadata?: Record<string, unknown>): PolicyEvaluationStartedEvent<T> {
    const event: PolicyEvaluationStartedEvent<T> = {
      type: 'POLICY_EVALUATION_STARTED',
      ...this.baseData,
      timestamp: new Date(),
    };

    if (metadata !== undefined) {
      (event as any).metadata = metadata;
    }

    return event;
  }

  /**
   * Create a policy evaluation completed event
   */
  public evaluationCompleted(
    result: Result<T, PolicyViolation>,
    duration: number,
    options: {
      version?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): PolicyEvaluationEvent<T> {
    const event: PolicyEvaluationEvent<T> = {
      type: 'POLICY_EVALUATED',
      ...this.baseData,
      result,
      duration,
      timestamp: new Date(),
    };

    if (options.version !== undefined) {
      (event as any).version = options.version;
    }
    if (options.tags !== undefined) {
      (event as any).tags = options.tags;
    }
    if (options.metadata !== undefined) {
      (event as any).metadata = options.metadata;
    }

    return event;
  }

  /**
   * Create a policy evaluation error event
   */
  public evaluationError(
    error: Error,
    duration: number,
    metadata?: Record<string, unknown>
  ): PolicyEvaluationErrorEvent<T> {
    const event: PolicyEvaluationErrorEvent<T> = {
      type: 'POLICY_EVALUATION_ERROR',
      ...this.baseData,
      error,
      duration,
      timestamp: new Date(),
    };

    if (metadata !== undefined) {
      (event as any).metadata = metadata;
    }

    return event;
  }

  /**
   * Generate a unique execution ID
   */
  private static generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * @llm-summary Contract for policy execution metrics functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * PolicyExecutionMetrics interface implementing domain pattern implementation for policy execution metrics operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcretePolicyExecutionMetrics implements PolicyExecutionMetrics {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface PolicyExecutionMetrics {
  readonly policyId: string;
  readonly domain: string;
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly systemErrors: number;
  readonly averageDuration: number;
  readonly minDuration: number;
  readonly maxDuration: number;
  readonly lastExecuted: Date;
  readonly violationFrequency: Map<string, number>; // violation code -> count
}

/**
 * @llm-summary PolicyMetricsAggregator class for policy metrics aggregator operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * PolicyMetricsAggregator class implementing domain pattern implementation for policy metrics aggregator operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new PolicyMetricsAggregator();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new PolicyMetricsAggregator());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class PolicyMetricsAggregator {
  private readonly metrics = new Map<string, PolicyExecutionMetrics>();

  /**
   * Process a policy event and update metrics
   */
  public processEvent(event: PolicyEvent): void {
    const key = `${event.domain}:${event.policyId}`;

    switch (event.type) {
      case 'POLICY_EVALUATED':
        this.processEvaluationEvent(key, event);
        break;
      case 'POLICY_EVALUATION_ERROR':
        this.processErrorEvent(key, event);
        break;
      // POLICY_EVALUATION_STARTED doesn't affect metrics directly
    }
  }

  /**
   * Get metrics for a specific policy
   */
  public getMetrics(domain: string, policyId: string): PolicyExecutionMetrics | null {
    const key = `${domain}:${policyId}`;
    return this.metrics.get(key) || null;
  }

  /**
   * Get all metrics
   */
  public getAllMetrics(): PolicyExecutionMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics by domain
   */
  public getMetricsByDomain(domain: string): PolicyExecutionMetrics[] {
    return Array.from(this.metrics.values()).filter(m => m.domain === domain);
  }

  /**
   * Clear all metrics
   */
  public clear(): void {
    this.metrics.clear();
  }

  private processEvaluationEvent(key: string, event: PolicyEvaluationEvent): void {
    const existing = this.metrics.get(key);

    if (!existing) {
      // Create new metrics
      const violationFrequency = new Map<string, number>();
      if (event.result.isFailure) {
        violationFrequency.set(event.result.error.code, 1);
      }

      this.metrics.set(key, {
        policyId: event.policyId,
        domain: event.domain,
        totalExecutions: 1,
        successfulExecutions: event.result.isSuccess ? 1 : 0,
        failedExecutions: event.result.isFailure ? 1 : 0,
        systemErrors: 0,
        averageDuration: event.duration,
        minDuration: event.duration,
        maxDuration: event.duration,
        lastExecuted: event.timestamp,
        violationFrequency,
      });
    } else {
      // Update existing metrics
      const totalExecutions = existing.totalExecutions + 1;
      const successfulExecutions = existing.successfulExecutions + (event.result.isSuccess ? 1 : 0);
      const failedExecutions = existing.failedExecutions + (event.result.isFailure ? 1 : 0);

      // Update duration metrics
      const totalDuration = existing.averageDuration * existing.totalExecutions + event.duration;
      const averageDuration = totalDuration / totalExecutions;

      // Update violation frequency
      const violationFrequency = new Map(existing.violationFrequency);
      if (event.result.isFailure) {
        const code = event.result.error.code;
        violationFrequency.set(code, (violationFrequency.get(code) || 0) + 1);
      }

      this.metrics.set(key, {
        ...existing,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageDuration,
        minDuration: Math.min(existing.minDuration, event.duration),
        maxDuration: Math.max(existing.maxDuration, event.duration),
        lastExecuted: event.timestamp,
        violationFrequency,
      });
    }
  }

  private processErrorEvent(key: string, event: PolicyEvaluationErrorEvent): void {
    const existing = this.metrics.get(key);

    if (!existing) {
      // Create new metrics for error-only policy
      this.metrics.set(key, {
        policyId: event.policyId,
        domain: event.domain,
        totalExecutions: 1,
        successfulExecutions: 0,
        failedExecutions: 0,
        systemErrors: 1,
        averageDuration: event.duration,
        minDuration: event.duration,
        maxDuration: event.duration,
        lastExecuted: event.timestamp,
        violationFrequency: new Map(),
      });
    } else {
      // Update existing metrics
      const totalExecutions = existing.totalExecutions + 1;
      const systemErrors = existing.systemErrors + 1;

      // Update duration metrics
      const totalDuration = existing.averageDuration * existing.totalExecutions + event.duration;
      const averageDuration = totalDuration / totalExecutions;

      this.metrics.set(key, {
        ...existing,
        totalExecutions,
        systemErrors,
        averageDuration,
        minDuration: Math.min(existing.minDuration, event.duration),
        maxDuration: Math.max(existing.maxDuration, event.duration),
        lastExecuted: event.timestamp,
      });
    }
  }
}
