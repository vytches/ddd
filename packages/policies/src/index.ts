// Classes that can be instantiated
export {
  AsyncSpecificationPolicy,
  BaseBusinessPolicy,
  BaseCompositePolicy,
  PolicyDefinitionBuilder,
  PolicyMetadataBuilder,
  PolicyViolation,
  PolicyViolationCollection,
  SpecificationPolicy,
} from './core';

// Types and interfaces
export type {
  IBusinessPolicy,
  IGroupedPolicyComposer,
  IPolicyComposer,
  IPolicyRegistry,
  IUnifiedRegistry,
  PolicyCondition,
  PolicyContext,
  PolicyDefinition,
  PolicyMetadata,
  PolicyQuery,
  PolicyRequest,
  PolicyViolationData,
  PolicyViolationOptions,
  PolicyViolationSeverity,
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
  IConditionalPolicyBuilder,
  IConditionalPolicyElse,
  IConditionalPolicyElseStepBuilder,
  IConditionalPolicyThenStepBuilder,
  IPolicyBuilder,
  IPolicyGroup,
  IPolicyGroupStepBuilder,
  IPolicyStepBuilder,
  PolicyBuilderConfig,
} from './builders';

export {
  ConditionalPolicyBuilder,
  ConditionalPolicyElse,
  ConditionalPolicyElseStepBuilder,
  ConditionalPolicyThenStepBuilder,
  PolicyBuilder,
  PolicyGroup,
  PolicyGroupStepBuilder,
  PolicyStepBuilder,
  type PolicyBuildStep,
  type PolicyGroupStep,
} from './builders';

// Re-export specification interfaces from contracts
export type { IAsyncSpecification, ISpecification } from '@vytches/ddd-contracts';

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
  type BusinessCalendar,
  // Types
  type PolicyCacheConfig,
  type PolicyRetryConfig,
  type RetryAttempt,
  type RetryMetrics,
  type TemporalCondition,
  type TemporalInfo,
  type TemporalPolicyConfig,
} from './decorators';

// Phase 3: Events and Observability
export type {
  EventDrivenPolicyConfig,
  PolicyEvaluationErrorEvent,
  PolicyEvaluationEvent,
  PolicyEvaluationStartedEvent,
  PolicyEvent,
  PolicyEventBusConfig,
  PolicyEventBusMetrics,
  PolicyEventHandler,
  PolicyEventSubscription,
  PolicyExecutionMetrics,
} from './events';

export {
  EventDrivenPolicy,
  EventDrivenPolicyFactory,
  globalPolicyEventBus,
  PolicyEventBuilder,
  PolicyEventBus,
  PolicyEventHandlers,
  PolicyMetricsAggregator,
  withEvents,
} from './events';

// Common types from utils
export type { Result } from '@vytches/ddd-utils';
