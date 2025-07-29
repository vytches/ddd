import type { Result } from '@vytches/ddd-utils';
import type {
  IBusinessPolicy,
  IPolicyComposer,
  PolicyRequest,
  IPolicyConditionalBuilder,
  PolicyCondition,
} from '../core/interfaces/business-policy.interface';
import type { PolicyViolation } from '../core/models/policy-violation';
import { PolicyEventBuilder } from './policy-evaluation-event';
import type { PolicyEventBus } from './policy-event-bus';

/**
 * @llm-summary Contract for event driven policy config functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * EventDrivenPolicyConfig interface implementing domain pattern implementation for event driven policy config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteEventDrivenPolicyConfig implements EventDrivenPolicyConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface EventDrivenPolicyConfig {
  readonly eventBus: PolicyEventBus;
  readonly emitStartEvents?: boolean; // Emit POLICY_EVALUATION_STARTED events
  readonly emitCompletionEvents?: boolean; // Emit POLICY_EVALUATED events
  readonly emitErrorEvents?: boolean; // Emit POLICY_EVALUATION_ERROR events
  readonly includeEntityInEvents?: boolean; // Include entity data in events
  readonly includeContextInEvents?: boolean; // Include full context in events
  readonly version?: string; // Policy version for events
  readonly tags?: string[]; // Policy tags for events
  readonly metadata?: Record<string, unknown>; // Additional metadata for events
}

/**
 * @llm-summary EventDrivenPolicy class for event driven policy operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * EventDrivenPolicy class implementing domain pattern implementation for event driven policy operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EventDrivenPolicy();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class EventDrivenPolicy<T> implements IBusinessPolicy<T> {
  private readonly config: {
    eventBus: PolicyEventBus;
    emitStartEvents: boolean;
    emitCompletionEvents: boolean;
    emitErrorEvents: boolean;
    includeEntityInEvents: boolean;
    includeContextInEvents: boolean;
    version?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  };

  constructor(
    private readonly innerPolicy: IBusinessPolicy<T>,
    config: EventDrivenPolicyConfig
  ) {
    this.config = {
      eventBus: config.eventBus,
      emitStartEvents: config.emitStartEvents ?? false,
      emitCompletionEvents: config.emitCompletionEvents ?? true,
      emitErrorEvents: config.emitErrorEvents ?? true,
      includeEntityInEvents: config.includeEntityInEvents ?? false,
      includeContextInEvents: config.includeContextInEvents ?? true,
    };

    if (config.version !== undefined) {
      this.config.version = config.version;
    }
    if (config.tags !== undefined) {
      this.config.tags = config.tags;
    }
    if (config.metadata !== undefined) {
      this.config.metadata = config.metadata;
    }
  }

  /**
   * Policy ID from inner policy
   */
  public get id(): string {
    return this.innerPolicy.id;
  }

  /**
   * Policy domain from inner policy
   */
  public get domain(): string {
    return this.innerPolicy.domain;
  }

  /**
   * Policy name from inner policy
   */
  public get name(): string {
    return this.innerPolicy.name;
  }

  /**
   * Check policy with automatic event emission
   */
  public async check(request: PolicyRequest<T>): Promise<Result<T, PolicyViolation>> {
    const executionId = this.generateExecutionId();
    const startTime = performance.now();

    // Create event builder
    const eventBuilder = PolicyEventBuilder.create({
      policyId: this.id,
      domain: this.domain,
      name: this.name,
      entity: this.config.includeEntityInEvents ? request.entity : ({} as T),
      context: this.config.includeContextInEvents
        ? request.context
        : {
            userId: request.context.userId || 'system',
            timestamp: request.context.timestamp,
            environment: request.context.environment,
            features: {},
            metadata: {},
          },
      executionId,
    });

    // Emit start event if enabled
    if (this.config.emitStartEvents) {
      try {
        const startEvent = eventBuilder.evaluationStarted(this.config.metadata);
        await this.config.eventBus.publish(startEvent);
      } catch (error) {
        // Don't fail policy evaluation due to event emission errors
        console.warn('Failed to emit policy evaluation started event:', error);
      }
    }

    try {
      // Execute the actual policy
      const result = await this.innerPolicy.check(request);
      const duration = performance.now() - startTime;

      // Emit completion event if enabled
      if (this.config.emitCompletionEvents) {
        try {
          const eventOptions: {
            version?: string;
            tags?: string[];
            metadata?: Record<string, unknown>;
          } = {};

          if (this.config.version !== undefined) {
            eventOptions.version = this.config.version;
          }
          if (this.config.tags !== undefined) {
            eventOptions.tags = this.config.tags;
          }
          if (this.config.metadata !== undefined) {
            eventOptions.metadata = this.config.metadata;
          }

          const completionEvent = eventBuilder.evaluationCompleted(result, duration, eventOptions);
          await this.config.eventBus.publish(completionEvent);
        } catch (error) {
          // Don't fail policy evaluation due to event emission errors
          console.warn('Failed to emit policy evaluation completed event:', error);
        }
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const policyError =
        error instanceof Error ? error : new Error('Unknown policy evaluation error');

      // Emit error event if enabled
      if (this.config.emitErrorEvents) {
        try {
          const errorEvent = eventBuilder.evaluationError(
            policyError,
            duration,
            this.config.metadata
          );
          await this.config.eventBus.publish(errorEvent);
        } catch (eventError) {
          // Don't fail policy evaluation due to event emission errors
          console.warn('Failed to emit policy evaluation error event:', eventError);
        }
      }

      // Re-throw the original error
      throw policyError;
    }
  }

  /**
   * Compose with another policy (delegates to inner policy)
   */
  public and(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    // Delegate to inner policy and return the composer directly
    return this.innerPolicy.and(other);
  }

  /**
   * Compose with another policy using OR logic (delegates to inner policy)
   */
  public or(other: IBusinessPolicy<T>): IPolicyComposer<T> {
    // Delegate to inner policy and return the composer directly
    return this.innerPolicy.or(other);
  }

  /**
   * Negate this policy (delegates to inner policy)
   */
  public not(): IBusinessPolicy<T> {
    // Delegate to inner policy
    return this.innerPolicy.not();
  }

  /**
   * Create conditional policy (delegates to inner policy)
   */
  public when(condition: PolicyCondition<T>): IPolicyConditionalBuilder<T> {
    // Note: This would need to be implemented based on the conditional policy builder
    // For now, delegate to inner policy
    return this.innerPolicy.when(condition);
  }

  /**
   * Create an event-driven policy from an existing policy
   */
  public static wrap<T>(
    policy: IBusinessPolicy<T>,
    config: EventDrivenPolicyConfig
  ): EventDrivenPolicy<T> {
    return new EventDrivenPolicy(policy, config);
  }

  /**
   * Create an event-driven policy with default configuration
   */
  public static withDefaultEvents<T>(
    policy: IBusinessPolicy<T>,
    eventBus: PolicyEventBus,
    options: Partial<EventDrivenPolicyConfig> = {}
  ): EventDrivenPolicy<T> {
    return new EventDrivenPolicy(policy, {
      eventBus,
      emitCompletionEvents: true,
      emitErrorEvents: true,
      includeContextInEvents: true,
      ...options,
    });
  }

  /**
   * Create an event-driven policy for audit purposes
   */
  public static withAuditEvents<T>(
    policy: IBusinessPolicy<T>,
    eventBus: PolicyEventBus,
    options: {
      version?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): EventDrivenPolicy<T> {
    return new EventDrivenPolicy(policy, {
      eventBus,
      emitStartEvents: true,
      emitCompletionEvents: true,
      emitErrorEvents: true,
      includeEntityInEvents: true,
      includeContextInEvents: true,
      ...options,
    });
  }

  /**
   * Create an event-driven policy for performance monitoring
   */
  public static withPerformanceEvents<T>(
    policy: IBusinessPolicy<T>,
    eventBus: PolicyEventBus,
    options: Partial<EventDrivenPolicyConfig> = {}
  ): EventDrivenPolicy<T> {
    return new EventDrivenPolicy(policy, {
      eventBus,
      emitStartEvents: true,
      emitCompletionEvents: true,
      emitErrorEvents: true,
      includeEntityInEvents: false, // Don't include entity for performance
      includeContextInEvents: false, // Minimal context for performance
      ...options,
    });
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * @llm-summary with events function
 * @llm-domain Pattern
 * @llm-pure false
 *
 * @description
 * withEvents function implementing domain pattern implementation for with events operations.
 *
 * @param {EventDrivenPolicyConfig} config - config parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = withEvents(config);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function withEvents<T>(config: EventDrivenPolicyConfig) {
  return function (policy: IBusinessPolicy<T>): EventDrivenPolicy<T> {
    return new EventDrivenPolicy(policy, config);
  };
}

/**
 * @llm-summary EventDrivenPolicyFactory class for event driven policy factory operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * EventDrivenPolicyFactory class implementing domain pattern implementation for event driven policy factory operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EventDrivenPolicyFactory();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class EventDrivenPolicyFactory {
  constructor(
    private readonly defaultEventBus: PolicyEventBus,
    private readonly defaultConfig: Partial<EventDrivenPolicyConfig> = {}
  ) {}

  /**
   * Create an event-driven policy with factory defaults
   */
  public create<T>(
    policy: IBusinessPolicy<T>,
    config: Partial<EventDrivenPolicyConfig> = {}
  ): EventDrivenPolicy<T> {
    const mergedConfig: EventDrivenPolicyConfig = {
      eventBus: this.defaultEventBus,
      ...this.defaultConfig,
      ...config,
    };

    return new EventDrivenPolicy(policy, mergedConfig);
  }

  /**
   * Create an audit-enabled policy
   */
  public createWithAudit<T>(
    policy: IBusinessPolicy<T>,
    auditConfig: {
      version?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): EventDrivenPolicy<T> {
    return this.create(policy, {
      emitStartEvents: true,
      emitCompletionEvents: true,
      emitErrorEvents: true,
      includeEntityInEvents: true,
      includeContextInEvents: true,
      ...auditConfig,
    });
  }

  /**
   * Create a performance-monitored policy
   */
  public createWithPerformanceMonitoring<T>(
    policy: IBusinessPolicy<T>,
    metadata?: Record<string, unknown>
  ): EventDrivenPolicy<T> {
    const configWithMetadata =
      metadata !== undefined
        ? {
            emitStartEvents: true,
            emitCompletionEvents: true,
            emitErrorEvents: true,
            includeEntityInEvents: false,
            includeContextInEvents: false,
            metadata,
          }
        : {
            emitStartEvents: true,
            emitCompletionEvents: true,
            emitErrorEvents: true,
            includeEntityInEvents: false,
            includeContextInEvents: false,
          };

    return this.create(policy, configWithMetadata);
  }
}
