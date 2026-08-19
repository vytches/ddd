import type { ResilienceContext } from '../core/resilience-context';
import { DefaultResilienceContext } from '../core/resilience-context';
import type { BulkheadConfig } from '../patterns/bulkhead';
import type { CircuitBreakerConfig } from '../patterns/circuit-breaker';
import { ResiliencePolicyBuilder } from '../patterns/resilience-strategy';
import type { RetryConfig } from '../patterns/retry';

export interface BaseResilienceDecoratorConfig {
  contextProvider?: () => ResilienceContext;
  enableMetrics?: boolean;
  decoratorName?: string;
  /**
   * Controls whether the resilience policy built by this decorator is
   * private to each decorated instance or shared by the whole class
   * (AC2/AC7, SA-M2).
   *
   * - `'instance'` (default): each `this` the decorated method is called on
   *   gets its own lazily-created policy (circuit breaker, retry state,
   *   bulkhead slots, ...), keyed by a `WeakMap<instance, policy>`. This is
   *   almost always what you want — a circuit breaker/bulkhead that trips
   *   for one instance no longer silently affects every other instance of
   *   the same class (the pre-AC2 bug: the policy used to be built once, at
   *   decoration time, and shared by every instance regardless of this
   *   setting).
   * - `'shared'`: restores the pre-AC2 behavior — one policy for the entire
   *   decorated method, shared across every instance of the class. Opt into
   *   this **explicitly** if you want a single breaker/bulkhead to protect a
   *   shared downstream resource across all instances (e.g. a connection
   *   pool). If you want that sharing without opting out of per-instance
   *   isolation for everything else, prefer sharing the instance itself, or
   *   building a single named policy with `ResiliencePolicyBuilder` and
   *   reusing it directly instead of the decorator.
   *
   * When `this` is not an object at call time (a detached method reference,
   * a destructured call, `.call(undefined)`) `'instance'` scope falls back
   * to a single lazily-created policy shared by those calls — there is no
   * object to key a `WeakMap` on.
   */
  scope?: 'instance' | 'shared';
}

export interface CircuitBreakerDecoratorConfig
  extends Omit<CircuitBreakerConfig, 'name'>,
    BaseResilienceDecoratorConfig {
  name?: string;
}

export interface RetryDecoratorConfig extends RetryConfig, BaseResilienceDecoratorConfig {}

export interface BulkheadDecoratorConfig
  extends Omit<BulkheadConfig, 'name'>,
    BaseResilienceDecoratorConfig {
  name?: string;
}

export interface TimeoutDecoratorConfig extends BaseResilienceDecoratorConfig {
  timeout: number;
}

export interface CompositeResilienceConfig extends BaseResilienceDecoratorConfig {
  circuitBreaker?: CircuitBreakerConfig;
  retry?: RetryConfig;
  bulkhead?: BulkheadConfig;
  timeout?: number;
}

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

      // AC7: 'shared' (opt-in, D9) restores the pre-AC2 behavior — one policy
      // built once at decoration time, shared by every instance.
      const scope = config.scope ?? 'instance';
      const sharedPolicy = scope === 'shared' ? policyFactory(config) : undefined;

      // AC2: per-instance policies, created lazily on first call and keyed by
      // the runtime `this`, so a circuit breaker/bulkhead/retry state tripped
      // by one instance no longer silently leaks into every other instance of
      // the decorated class.
      const instancePolicies = new WeakMap<object, ResilienceStrategy>();
      // D11: WeakMap keys must be objects. When `this` is not one (a
      // detached method reference, a destructured call, `.call(undefined)`)
      // fall back to a single lazily-created "unbound" policy shared by those
      // calls, instead of throwing (WeakMap.set(undefined, ...) would).
      let unboundPolicy: ResilienceStrategy | undefined;

      const resolvePolicy = (thisArg: unknown): ResilienceStrategy => {
        if (sharedPolicy) {
          return sharedPolicy;
        }

        if (thisArg !== null && (typeof thisArg === 'object' || typeof thisArg === 'function')) {
          const key = thisArg as object;
          let policy = instancePolicies.get(key);
          if (!policy) {
            policy = policyFactory(config);
            instancePolicies.set(key, policy);
          }
          return policy;
        }

        if (!unboundPolicy) {
          unboundPolicy = policyFactory(config);
        }
        return unboundPolicy;
      };

      descriptor.value = async function (...args: unknown[]) {
        const policy = resolvePolicy(this);
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

export const CircuitBreaker = createSimpleDecorator<CircuitBreakerDecoratorConfig>(
  config =>
    ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        failureThreshold: config.failureThreshold,
        recoveryTimeout: config.recoveryTimeout,
        successThreshold: config.successThreshold,
        timeout: config.timeout,
        name: config.name ?? config.decoratorName ?? 'circuit-breaker',
        ...(config.halfOpenMaxProbes !== undefined && {
          halfOpenMaxProbes: config.halfOpenMaxProbes,
        }),
      })
      .build(),
  'circuit-breaker'
);

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

// D9: composite decorator now goes through the same createResilienceDecorator
// factory as the individual decorators (dedup) — this is what unlocks AC2's
// per-instance WeakMap and AC7's scope option here for free, with zero
// change to the strategy-assembly logic below.
export const Resilience = createSimpleDecorator<CompositeResilienceConfig>(config => {
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

  return policyBuilder.build();
}, 'composite-resilience');

export const Timeout = createSimpleDecorator<TimeoutDecoratorConfig>(
  config => ResiliencePolicyBuilder.create().withTimeout(config.timeout).build(),
  'timeout'
);

/**
 * Reads back the resilience decorator configuration attached to a decorated
 * method — the `resilienceConfig` set by `@Resilience`/`@Timeout`/etc, not
 * live runtime metrics (no call counts, latencies, or open/closed state).
 *
 * @param instance - Object holding the decorated method
 * @param methodName - Name of the decorated method
 * @returns The decorator config plus class/method name for identification
 */
export function getResilienceConfig(
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

  return {
    config,
    className: instance.constructor.name,
    methodName,
  };
}

/**
 * @deprecated This does NOT return runtime metrics (call counts, latencies,
 * circuit state) — despite the name, it only returns the static decorator
 * configuration. Use {@link getResilienceConfig} instead, which is named
 * accurately for what it returns. Kept for backward compatibility; behavior
 * is unchanged.
 */
export function getResilienceMetrics(
  instance: Record<string, unknown>,
  methodName: string
): {
  config: BaseResilienceDecoratorConfig;
  className: string;
  methodName: string;
} {
  return getResilienceConfig(instance, methodName);
}
