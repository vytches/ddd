// Test utilities for DDD patterns

// Phase 1: Foundation Layer - Core testing utilities
export {
  // Safe execution utilities
  safeRun,
  safeRunTest,
  expectError,
  expectSuccess,
  safeRunWithTimeout,
  type SafeRunResult,

  // Time control utilities
  TestClock,
  TimeScenarioBuilder,
  withTestClock,
  type TimeAdvanceOptions,
  type TestClockState,

  // Test harness utilities
  TestHarness,
  SimpleTestHarness,
  TestResourceBuilder,
  type TestHarnessOptions,
  type TestHarnessState,
  type TestResource,

  // Test data building utilities
  TestDataBuilder,
  EntityIdBuilder,
  UserBuilder,
  DomainEventBuilder,
  type TestDataBuilderOptions,
  type SequenceOptions,
  type RandomOptions,
  type TestUser,
  type TestDomainEvent,
} from './core';

// Phase 2: Domain Layer - Domain-specific testing utilities
export {
  // Event testing utilities
  EventTestHarness,
  type EventTestHarnessOptions,
  type EventCapture,
  type EventSubscription,
  type EventTestScenario,
  type EventAssertions,

  // Aggregate testing utilities
  AggregateTestBuilder,
  EventSourcedAggregateTestBuilder,
  createAggregateTestBuilder,
  createEventSourcedAggregateTestBuilder,
  type AggregateTestOptions,
  type AggregateEventScenario,
  type AggregateStateSnapshot,
} from './domain';

// Testing framework version
export const testingVersion = '1.0.0';
