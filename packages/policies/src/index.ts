// Classes that can be instantiated
export {
  PolicyViolation,
  PolicyViolationCollection,
  PolicyDefinitionBuilder,
  PolicyMetadataBuilder,
  AsyncSpecificationPolicy,
  BaseBusinessPolicy,
  BaseCompositePolicy,
  SpecificationPolicy,
} from './core';

// Types and interfaces
export type {
  PolicyViolationSeverity,
  PolicyViolationOptions,
  PolicyViolationData,
  IBusinessPolicy,
  IPolicyComposer,
  PolicyRequest,
  PolicyContext,
  PolicyDefinition,
  IGroupedPolicyComposer,
  PolicyMetadata,
  IPolicyRegistry,
  PolicyQuery,
  IUnifiedRegistry,
  PolicyCondition,
} from './core';

// Registry
export { PolicyRegistry, type PolicyRegistryStatistics } from './registry';

// Utilities and builders
export {
  PolicyContextBuilder,
  PolicyContextFactory,
  PolicyRequestBuilder,
  PolicyRequestFactory,
} from './utils';

// Phase 2: Builder System
export type {
  IPolicyBuilder,
  IPolicyStepBuilder,
  IPolicyGroup,
  IPolicyGroupStepBuilder,
  IConditionalPolicyBuilder,
  IConditionalPolicyElse,
  IConditionalPolicyThenStepBuilder,
  IConditionalPolicyElseStepBuilder,
  PolicyBuilderConfig,
} from './builders';

export {
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
} from './builders';

// Re-export specification interfaces from contracts
export type { ISpecification, IAsyncSpecification } from '@vytches-ddd/contracts';

// Specification adapters for integration
export {
  BusinessRuleValidatorAdapter,
  BusinessRuleValidatorPolicy,
  PolicySpecificationFactory,
} from './adapters';

// Phase 4: Policy Behaviors (domain-focused, following MediatR pattern)
export {
  // New behavior classes
  PolicyCachingBehavior,
  PolicyCachingBehaviorFactory,
  PolicyRetryBehavior,
  PolicyRetryBehaviorFactory,
  PolicyTemporalBehavior,
  PolicyTemporalBehaviorBuilder,
  PolicyTemporalBehaviorFactory,

  // Types
  type PolicyCacheConfig,
  type PolicyRetryConfig,
  type RetryAttempt,
  type RetryMetrics,
  type TemporalPolicyConfig,
  type BusinessCalendar,
  type TemporalCondition,
  type TemporalInfo,
} from './decorators';

// Phase 3: Events and Observability
export type {
  PolicyEvaluationEvent,
  PolicyEvaluationErrorEvent,
  PolicyEvaluationStartedEvent,
  PolicyEvent,
  PolicyExecutionMetrics,
  PolicyEventHandler,
  PolicyEventSubscription,
  PolicyEventBusConfig,
  PolicyEventBusMetrics,
  EventDrivenPolicyConfig,
} from './events';

export {
  PolicyEventBuilder,
  PolicyMetricsAggregator,
  PolicyEventBus,
  PolicyEventHandlers,
  globalPolicyEventBus,
  EventDrivenPolicy,
  EventDrivenPolicyFactory,
  withEvents,
} from './events';

// Common types from utils
export type { Result } from '@vytches-ddd/utils';
