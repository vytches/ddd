// Test utilities for DDD patterns

// Phase 1: Foundation Layer - Core testing utilities
export {
  DomainEventBuilder,
  EntityIdBuilder,
  expectError,
  expectSuccess,
  // Safe execution utilities
  safeRun,
  safeRunTest,
  safeRunWithTimeout,
  SimpleTestHarness,
  // Time control utilities
  TestClock,
  // Test data building utilities
  TestDataBuilder,
  // Test harness utilities
  TestHarness,
  TestResourceBuilder,
  TimeScenarioBuilder,
  UserBuilder,
  withTestClock,
  type RandomOptions,
  type SafeRunResult,
  type SequenceOptions,
  type TestClockState,
  type TestDataBuilderOptions,
  type TestDomainEvent,
  type TestHarnessOptions,
  type TestHarnessState,
  type TestResource,
  type TestUser,
  type TimeAdvanceOptions,
} from './core';
