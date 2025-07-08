// Domain-specific testing utilities - Phase 2: Domain Layer
// Export domain testing functionality

export {
  EventTestHarness,
  type EventTestHarnessOptions,
  type EventCapture,
  type EventSubscription,
  type EventTestScenario,
  type EventAssertions
} from './event-test-harness';

export {
  AggregateTestBuilder,
  EventSourcedAggregateTestBuilder,
  createAggregateTestBuilder,
  createEventSourcedAggregateTestBuilder,
  type AggregateTestOptions,
  type AggregateEventScenario,
  type AggregateStateSnapshot
} from './aggregate-test-builder';

// Export version for domain layer
export const domainTestingVersion = '1.0.0';
