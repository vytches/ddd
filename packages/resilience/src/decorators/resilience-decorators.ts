import type { ResilienceContext } from '../core/resilience-context';
import { DefaultResilienceContext } from '../core/resilience-context';
import type { CircuitBreakerConfig } from '../patterns/circuit-breaker';
import type { RetryConfig } from '../patterns/retry';
import type { BulkheadConfig } from '../patterns/bulkhead';
import { ResiliencePolicyBuilder } from '../patterns/resilience-strategy';

// Base interface for all resilience decorators
export interface BaseResilienceDecoratorConfig {
  contextProvider?: () => ResilienceContext;
  enableMetrics?: boolean;
  decoratorName?: string;
}

// Individual pattern decorator configs
export interface CircuitBreakerDecoratorConfig extends Omit<CircuitBreakerConfig, 'name'>, BaseResilienceDecoratorConfig {
  name?: string;
}

export interface RetryDecoratorConfig extends RetryConfig, BaseResilienceDecoratorConfig {}

export interface BulkheadDecoratorConfig extends Omit<BulkheadConfig, 'name'>, BaseResilienceDecoratorConfig {
  name?: string;
}

export interface TimeoutDecoratorConfig extends BaseResilienceDecoratorConfig {
  timeout: number;
}

// Composite decorator config
export interface CompositeResilienceConfig extends BaseResilienceDecoratorConfig {
  circuitBreaker?: CircuitBreakerConfig;
  retry?: RetryConfig;
  bulkhead?: BulkheadConfig;
  timeout?: number;
}

// Legacy export for backward compatibility
export type ResilienceDecoratorConfig = BaseResilienceDecoratorConfig;

import type { ResilienceStrategy } from '../patterns/resilience-strategy';

// Core decorator factory - DRY principle
function createResilienceDecorator<T extends BaseResilienceDecoratorConfig>(
  policyFactory: (config: T) => ResilienceStrategy,
  defaultDecoratorName = 'resilience'
) {
  return function (config: T) {
    return function (
      target: unknown,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const policy = policyFactory(config);

      descriptor.value = async function (...args: unknown[]) {
        const context = config.contextProvider?.() ?? DefaultResilienceContext.create({
          metadata: {
            className: (target as { constructor: { name: string } }).constructor.name,
            methodName: propertyKey,
            decoratorName: config.decoratorName ?? defaultDecoratorName
          }
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
        enumerable: false
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
 * Circuit Breaker decorator - protects against cascading failures
 *
 * @example
 * ```typescript
 * class PaymentService {
 *   @CircuitBreaker({
 *     failureThreshold: 5,
 *     recoveryTimeout: 30000,
 *     successThreshold: 3,
 *     timeout: 10000,
 *     name: 'payment-gateway'
 *   })
 *   async processPayment(orderId: string): Promise<PaymentResult> {
 *     return await this.paymentGateway.charge(orderId);
 *   }
 * }
 * ```
 */
export const CircuitBreaker = createSimpleDecorator<CircuitBreakerDecoratorConfig>(
  (config) => ResiliencePolicyBuilder.create()
    .withCircuitBreaker({
      failureThreshold: config.failureThreshold,
      recoveryTimeout: config.recoveryTimeout,
      successThreshold: config.successThreshold,
      timeout: config.timeout,
      name: config.name ?? config.decoratorName ?? 'circuit-breaker'
    })
    .build(),
  'circuit-breaker'
);

/**
 * Retry decorator with exponential backoff - handles transient failures
 *
 * @example
 * ```typescript
 * class EmailService {
 *   @Retry({
 *     maxAttempts: 3,
 *     baseDelay: 1000,
 *     maxDelay: 30000,
 *     backoffMultiplier: 2,
 *     jitter: true,
 *     retryableErrors: (error) => error.message.includes('timeout')
 *   })
 *   async sendEmail(email: Email): Promise<void> {
 *     await this.emailProvider.send(email);
 *   }
 * }
 * ```
 */
export const Retry = createSimpleDecorator<RetryDecoratorConfig>(
  (config) => ResiliencePolicyBuilder.create()
    .withRetry({
      maxAttempts: config.maxAttempts,
      baseDelay: config.baseDelay,
      maxDelay: config.maxDelay,
      backoffMultiplier: config.backoffMultiplier,
      jitter: config.jitter,
      ...(config.retryableErrors && { retryableErrors: config.retryableErrors })
    })
    .build(),
  'retry'
);

/**
 * Bulkhead decorator for resource isolation
 *
 * @example
 * ```typescript
 * class ReportService {
 *   @Bulkhead({
 *     maxConcurrency: 5,
 *     queueCapacity: 20,
 *     timeout: 60000,
 *     name: 'report-generation'
 *   })
 *   async generateReport(params: ReportParams, context?: ResilienceContext): Promise<Report> {
 *     return await this.reportGenerator.create(params);
 *   }
 * }
 * ```
 */
export const Bulkhead = createSimpleDecorator<BulkheadDecoratorConfig>(
  (config) => ResiliencePolicyBuilder.create()
    .withBulkhead({
      maxConcurrency: config.maxConcurrency,
      queueCapacity: config.queueCapacity,
      ...(config.timeout && { timeout: config.timeout }),
      name: config.name ?? config.decoratorName ?? 'bulkhead'
    })
    .build(),
  'bulkhead'
);

/**
 * Composite resilience decorator combining multiple patterns
 *
 * @example
 * ```typescript
 * class OrderService {
 *   @Resilience({
 *     name: 'order-processing',
 *     timeout: 30000,
 *     bulkhead: {
 *       maxConcurrency: 10,
 *       queueCapacity: 50
 *     },
 *     circuitBreaker: {
 *       failureThreshold: 5,
 *       recoveryTimeout: 60000,
 *       successThreshold: 3,
 *       timeout: 10000
 *     },
 *     retry: {
 *       maxAttempts: 3,
 *       baseDelay: 1000,
 *       maxDelay: 10000,
 *       backoffMultiplier: 2,
 *       jitter: true
 *     }
 *   })
 *   async processOrder(order: Order, context?: ResilienceContext): Promise<OrderResult> {
 *     return await this.orderProcessor.process(order);
 *   }
 * }
 * ```
 */
export const Resilience = function (config: CompositeResilienceConfig) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    const policyBuilder = ResiliencePolicyBuilder.create();

    if (config.bulkhead) {
      policyBuilder.withBulkhead({
        ...config.bulkhead,
        name: config.decoratorName ? `${config.decoratorName}-bulkhead` : 'bulkhead'
      });
    }

    if (config.circuitBreaker) {
      policyBuilder.withCircuitBreaker({
        ...config.circuitBreaker,
        name: config.decoratorName ? `${config.decoratorName}-circuit-breaker` : 'circuit-breaker'
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
      const context = config.contextProvider?.() ?? DefaultResilienceContext.create({
        metadata: {
          className: (target as { constructor: { name: string } }).constructor.name,
          methodName: propertyKey,
          decoratorName: config.decoratorName ?? 'composite-resilience'
        }
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
      enumerable: false
    });

    return descriptor;
  };
};

/**
 * Timeout decorator - enforces operation timeout limits
 *
 * @example
 * ```typescript
 * class DatabaseService {
 *   @Timeout({
 *     timeout: 5000,
 *     decoratorName: 'db-timeout'
 *   })
 *   async findUser(id: string, context?: ResilienceContext): Promise<User> {
 *     return await this.db.users.findById(id);
 *   }
 * }
 * ```
 */
export const Timeout = createSimpleDecorator<TimeoutDecoratorConfig>(
  (config) => ResiliencePolicyBuilder.create()
    .withTimeout(config.timeout)
    .build(),
  'timeout'
);

/**
 * Utility to extract resilience metrics from decorated methods
 */
export function getResilienceMetrics(instance: Record<string, unknown>, methodName: string): {
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
    methodName
  };
}
