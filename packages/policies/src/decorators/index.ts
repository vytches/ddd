/**
 * Policy Behaviors - Domain-focused implementations following MediatR pattern
 *
 * These behaviors are specifically designed for business policy concerns,
 * NOT generic infrastructure abstractions. Each behavior addresses
 * specific policy domain needs following enterprise DDD principles.
 * Named "Behaviors" to align with MediatR conventions and avoid confusion with TypeScript decorators.
 */

// Policy Caching Behavior - Policy-specific caching with business semantics
export {
  PolicyCachingBehavior,
  PolicyCachingBehaviorFactory,
  type PolicyCacheConfig,
} from './cached-policy';

// Policy Retry Behavior - Business rule retry logic for transient failures
export {
  PolicyRetryBehavior,
  PolicyRetryBehaviorFactory,
  type PolicyRetryConfig,
  type RetryAttempt,
  type RetryMetrics,
} from './retry-policy';

// Policy Temporal Behavior - Time-aware policy execution for business rules
export {
  PolicyTemporalBehavior,
  PolicyTemporalBehaviorBuilder,
  PolicyTemporalBehaviorFactory,
  type TemporalPolicyConfig,
  type BusinessCalendar,
  type TemporalCondition,
  type TemporalInfo,
} from './temporal-policy';
