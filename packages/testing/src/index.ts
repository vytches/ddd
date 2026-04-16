// Test utilities for DDD patterns

// Phase 1: Foundation Layer - Core testing utilities
export {
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
  // Test harness utilities
  TestHarness,
  TestResourceBuilder,
  TimeScenarioBuilder,
  withTestClock,
  type SafeRunResult,
  type TestClockState,
  type TestHarnessOptions,
  type TestHarnessState,
  type TestResource,
  type TimeAdvanceOptions,
} from './core';

// Phase 2: DDD Seeder Framework - Domain-aware test data generation
export * from './seeder';

// Phase 3: GWT Aggregate Testing - Given-When-Then fluent API
export { Test, GWTAssertionError, matching, eventsMatch, eventArraysMatch } from './gwt';
export type { GivenStep, WhenStep, ThenStep, AsyncThenStep } from './gwt';
