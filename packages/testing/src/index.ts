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
