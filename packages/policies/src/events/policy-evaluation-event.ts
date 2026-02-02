import type { Result } from '@vytches/ddd-utils';
import type { PolicyContext } from '../core/interfaces';
import type { PolicyViolation } from '../core/models/policy-violation';

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

export type PolicyEvent<T = unknown> =
  | PolicyEvaluationEvent<T>
  | PolicyEvaluationErrorEvent<T>
  | PolicyEvaluationStartedEvent<T>;

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
      ...(metadata !== undefined && { metadata }),
    };

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
      ...(options.version !== undefined && { version: options.version }),
      ...(options.tags !== undefined && { tags: options.tags }),
      ...(options.metadata !== undefined && { metadata: options.metadata }),
    };

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
      ...(metadata !== undefined && { metadata }),
    };

    return event;
  }

  /**
   * Generate a unique execution ID
   */
  private static generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

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
