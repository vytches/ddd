import type { ResilienceContext } from '../core/resilience-context';
import { DefaultResilienceContext } from '../core/resilience-context';
import type { CircuitBreakerConfig } from '../patterns/circuit-breaker';
import type { RetryConfig } from '../patterns/retry';
import type { BulkheadConfig } from '../patterns/bulkhead';
import { ResiliencePolicyBuilder } from '../patterns/resilience-strategy';

// Base interface for all resilience decorators

/**
 * @llm-summary Contract for base resilience decorator config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * BaseResilienceDecoratorConfig interface implementing infrastructure service for base resilience decorator config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteBaseResilienceDecoratorConfig implements BaseResilienceDecoratorConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface BaseResilienceDecoratorConfig {
  contextProvider?: () => ResilienceContext;
  enableMetrics?: boolean;
  decoratorName?: string;
}

// Individual pattern decorator configs

/**
 * @llm-summary Contract for circuit breaker decorator config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CircuitBreakerDecoratorConfig interface implementing infrastructure service for circuit breaker decorator config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCircuitBreakerDecoratorConfig implements CircuitBreakerDecoratorConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CircuitBreakerDecoratorConfig
  extends Omit<CircuitBreakerConfig, 'name'>,
    BaseResilienceDecoratorConfig {
  name?: string;
}

/**
 * @llm-summary Contract for retry decorator config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * RetryDecoratorConfig interface implementing infrastructure service for retry decorator config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteRetryDecoratorConfig implements RetryDecoratorConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface RetryDecoratorConfig extends RetryConfig, BaseResilienceDecoratorConfig {}

/**
 * @llm-summary Contract for bulkhead decorator config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * BulkheadDecoratorConfig interface implementing infrastructure service for bulkhead decorator config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteBulkheadDecoratorConfig implements BulkheadDecoratorConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface BulkheadDecoratorConfig
  extends Omit<BulkheadConfig, 'name'>,
    BaseResilienceDecoratorConfig {
  name?: string;
}

/**
 * @llm-summary Contract for timeout decorator config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * TimeoutDecoratorConfig interface implementing infrastructure service for timeout decorator config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTimeoutDecoratorConfig implements TimeoutDecoratorConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface TimeoutDecoratorConfig extends BaseResilienceDecoratorConfig {
  timeout: number;
}

// Composite decorator config

/**
 * @llm-summary Contract for composite resilience config functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * CompositeResilienceConfig interface implementing infrastructure service for composite resilience config operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCompositeResilienceConfig implements CompositeResilienceConfig {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CompositeResilienceConfig extends BaseResilienceDecoratorConfig {
  circuitBreaker?: CircuitBreakerConfig;
  retry?: RetryConfig;
  bulkhead?: BulkheadConfig;
  timeout?: number;
}

// Legacy export for backward compatibility

/**
 * @llm-summary Type definition for resilience decorator config
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * ResilienceDecoratorConfig type implementing infrastructure service for resilience decorator config operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ResilienceDecoratorConfig = {} as ResilienceDecoratorConfig;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type ResilienceDecoratorConfig = BaseResilienceDecoratorConfig;

import type { ResilienceStrategy } from '../patterns/resilience-strategy';

// Core decorator factory - DRY principle
function createResilienceDecorator<T extends BaseResilienceDecoratorConfig>(
  policyFactory: (config: T) => ResilienceStrategy,
  defaultDecoratorName = 'resilience'
) {
  return function (config: T) {
    return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      const policy = policyFactory(config);

      descriptor.value = async function (...args: unknown[]) {
        const context =
          config.contextProvider?.() ??
          DefaultResilienceContext.create({
            metadata: {
              className: (target as { constructor: { name: string } }).constructor.name,
              methodName: propertyKey,
              decoratorName: config.decoratorName ?? defaultDecoratorName,
            },
          });

        return policy.execute(
          (ctx: ResilienceContext) => originalMethod.apply(this, [...args, ctx]),
          context
        );
      };

      // Preserve metadata for reflection
      Object.defineProperty(descriptor.value, 'resilienceConfig', {
        value: config,
        writable: false,
        enumerable: false,
      });

      return descriptor;
    };
  };
}

// Simple decorator factory for single-argument decorators
function createSimpleDecorator<T extends BaseResilienceDecoratorConfig>(
  policyFactory: (config: T) => ResilienceStrategy,
  defaultDecoratorName: string
) {
  return function (config: T) {
    const decorator = createResilienceDecorator(policyFactory, defaultDecoratorName);
    return decorator(config);
  };
}

// ===========================================
// INDIVIDUAL PATTERN DECORATORS
// ===========================================

/**
 * @llm-summary CircuitBreaker constant
 * @llm-domain Infrastructure
 *
 * @description
 * CircuitBreaker constant implementing infrastructure service for circuit breaker operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(CircuitBreaker);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const CircuitBreaker = createSimpleDecorator<CircuitBreakerDecoratorConfig>(
  config =>
    ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        failureThreshold: config.failureThreshold,
        recoveryTimeout: config.recoveryTimeout,
        successThreshold: config.successThreshold,
        timeout: config.timeout,
        name: config.name ?? config.decoratorName ?? 'circuit-breaker',
      })
      .build(),
  'circuit-breaker'
);

/**
 * @llm-summary Retry constant
 * @llm-domain Infrastructure
 *
 * @description
 * Retry constant implementing infrastructure service for retry operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(Retry);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const Retry = createSimpleDecorator<RetryDecoratorConfig>(
  config =>
    ResiliencePolicyBuilder.create()
      .withRetry({
        maxAttempts: config.maxAttempts,
        baseDelay: config.baseDelay,
        maxDelay: config.maxDelay,
        backoffMultiplier: config.backoffMultiplier,
        jitter: config.jitter,
        ...(config.retryableErrors && { retryableErrors: config.retryableErrors }),
      })
      .build(),
  'retry'
);

/**
 * @llm-summary Bulkhead constant
 * @llm-domain Infrastructure
 *
 * @description
 * Bulkhead constant implementing infrastructure service for bulkhead operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(Bulkhead);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const Bulkhead = createSimpleDecorator<BulkheadDecoratorConfig>(
  config =>
    ResiliencePolicyBuilder.create()
      .withBulkhead({
        maxConcurrency: config.maxConcurrency,
        queueCapacity: config.queueCapacity,
        ...(config.timeout && { timeout: config.timeout }),
        name: config.name ?? config.decoratorName ?? 'bulkhead',
      })
      .build(),
  'bulkhead'
);

/**
 * @llm-summary Resilience constant
 * @llm-domain Infrastructure
 *
 * @description
 * Resilience constant implementing infrastructure service for resilience operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(Resilience);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const Resilience = function (config: CompositeResilienceConfig) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    const policyBuilder = ResiliencePolicyBuilder.create();

    if (config.bulkhead) {
      policyBuilder.withBulkhead({
        ...config.bulkhead,
        name: config.decoratorName ? `${config.decoratorName}-bulkhead` : 'bulkhead',
      });
    }

    if (config.circuitBreaker) {
      policyBuilder.withCircuitBreaker({
        ...config.circuitBreaker,
        name: config.decoratorName ? `${config.decoratorName}-circuit-breaker` : 'circuit-breaker',
      });
    }

    if (config.retry) {
      policyBuilder.withRetry(config.retry);
    }

    if (config.timeout) {
      policyBuilder.withTimeout(config.timeout);
    }

    const policy = policyBuilder.build();

    descriptor.value = async function (...args: unknown[]) {
      const context =
        config.contextProvider?.() ??
        DefaultResilienceContext.create({
          metadata: {
            className: (target as { constructor: { name: string } }).constructor.name,
            methodName: propertyKey,
            decoratorName: config.decoratorName ?? 'composite-resilience',
          },
        });

      return policy.execute(
        (ctx: ResilienceContext) => originalMethod.apply(this, [...args, ctx]),
        context
      );
    };

    // Preserve metadata for reflection
    Object.defineProperty(descriptor.value, 'resilienceConfig', {
      value: config,
      writable: false,
      enumerable: false,
    });

    return descriptor;
  };
};

/**
 * @llm-summary Timeout constant
 * @llm-domain Infrastructure
 *
 * @description
 * Timeout constant implementing infrastructure service for timeout operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * console.log(Timeout);
 * ```
 *
 * @since 1.0.0
 * @public
 */
export const Timeout = createSimpleDecorator<TimeoutDecoratorConfig>(
  config => ResiliencePolicyBuilder.create().withTimeout(config.timeout).build(),
  'timeout'
);

/**
 * @llm-summary get resilience metrics function
 * @llm-domain Infrastructure
 * @llm-pure true
 *
 * @description
 * getResilienceMetrics function implementing infrastructure service for get resilience metrics operations.
 *
 *
 * @param {Record<string} instance - instance parameter
 * @param {string} methodName - methodName parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = getResilienceMetrics(instance, methodName);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => getResilienceMetrics(instance, methodName));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function getResilienceMetrics(
  instance: Record<string, unknown>,
  methodName: string
): {
  config: BaseResilienceDecoratorConfig;
  className: string;
  methodName: string;
} {
  const method = instance[methodName] as { resilienceConfig?: BaseResilienceDecoratorConfig };
  const config = method?.resilienceConfig;

  if (!config) {
    throw new Error(`Method ${methodName} is not decorated with resilience patterns`);
  }

  // In a real implementation, you'd maintain a registry of policy instances
  // and return their metrics. For now, return the config.
  return {
    config,
    // metrics would come from the actual policy instance
    className: instance.constructor.name,
    methodName,
  };
}
