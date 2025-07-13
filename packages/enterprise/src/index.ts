/**
 * @file Enterprise package - Meta-package for enterprise features
 * @module @vytches-ddd/enterprise
 */

// This is a placeholder enterprise package
// TODO: Implement enterprise features like health checks, monitoring, etc.

export * from '@vytches-ddd/core';
export * from '@vytches-ddd/events';
export * from '@vytches-ddd/cqrs';
export * from '@vytches-ddd/acl';
export * from '@vytches-ddd/messaging';
export * from '@vytches-ddd/validation';
export * from '@vytches-ddd/projections';
export * from '@vytches-ddd/di';

// Resolve naming conflicts by using qualified exports
export { RetryPolicy as ResilienceRetryPolicy } from '@vytches-ddd/resilience';

// Export all policies except conflicting RetryPolicy names
export {
  type PolicyCondition,
  type IPolicyRegistry,
  type PolicyQuery,
  type IUnifiedRegistry,
  // Models and classes
  PolicyViolation,
  PolicyViolationCollection,
  PolicyDefinitionBuilder,
  PolicyMetadataBuilder,
  type PolicyViolationSeverity,
  type PolicyViolationOptions,
  type PolicyViolationData,

  // Base implementations
  BaseBusinessPolicy,
  BaseCompositePolicy,
  SpecificationPolicy,
  AsyncSpecificationPolicy,

  // Registry
  PolicyRegistry,
  type PolicyRegistryStatistics,

  // Utilities and builders
  PolicyContextBuilder,
  PolicyContextFactory,
  PolicyRequestBuilder,
  PolicyRequestFactory,

  // Builder System
  type IPolicyBuilder,
  type IPolicyStepBuilder,
  type IPolicyGroup,
  type IPolicyGroupStepBuilder,
  type IConditionalPolicyBuilder,
  type IConditionalPolicyElse,
  type IConditionalPolicyThenStepBuilder,
  type IConditionalPolicyElseStepBuilder,
  type PolicyBuilderConfig,
  PolicyBuilder,
  PolicyStepBuilder,
  PolicyGroup,
  PolicyGroupStepBuilder,
  ConditionalPolicyBuilder,
  ConditionalPolicyThenStepBuilder,
  ConditionalPolicyElseStepBuilder,
  ConditionalPolicyElse,
  type PolicyBuildStep,
  type PolicyGroupStep,

  // Specification adapters
  BusinessRuleValidatorAdapter,
  BusinessRuleValidatorPolicy,
  PolicySpecificationFactory,

  // Policy Behaviors (MediatR pattern)
  PolicyCachingBehavior,
  PolicyCachingBehaviorFactory,
  PolicyRetryBehavior,
  PolicyRetryBehaviorFactory,
  PolicyTemporalBehavior,
  PolicyTemporalBehaviorBuilder,
  PolicyTemporalBehaviorFactory,
  type PolicyCacheConfig,
  type PolicyRetryConfig,
  type RetryAttempt,
  type RetryMetrics,
  type TemporalPolicyConfig,
  type BusinessCalendar,
  type TemporalCondition,
  type TemporalInfo,

  // Events and Observability
  type PolicyEvaluationEvent,
  type PolicyEvaluationErrorEvent,
  type PolicyEvaluationStartedEvent,
  type PolicyEvent,
  type PolicyExecutionMetrics,
  type PolicyEventHandler,
  type PolicyEventSubscription,
  type PolicyEventBusConfig,
  type PolicyEventBusMetrics,
  type EventDrivenPolicyConfig,
  PolicyEventBuilder,
  PolicyMetricsAggregator,
  PolicyEventBus,
  PolicyEventHandlers,
  globalPolicyEventBus,
  EventDrivenPolicy,
  EventDrivenPolicyFactory,
  withEvents,
} from '@vytches-ddd/policies';
