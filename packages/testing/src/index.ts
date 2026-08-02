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
// VF-024 (AC6): explicit named exports (was `export *`) — mirrors the
// curation already done inside seeder/index.ts itself (VP-005).
export {
  AggregateFactory,
  AggregateSeeder,
  AIEnhancedSeeder,
  DomainSeeder,
  EntityIdGenerator,
  EventSourcedSeeder,
  GeographicSeeder,
  ScenarioSeeder,
  StreamingSeeder,
  ValueObjectBuilder,
} from './seeder';

// Phase 3: GWT Aggregate Testing - Given-When-Then fluent API
export { Test, GWTAssertionError, matching, eventsMatch, eventArraysMatch } from './gwt';
export type { GivenStep, WhenStep, ThenStep, AsyncThenStep } from './gwt';

// Phase 4: Outbox testing - in-memory IOutboxRepository for driving OutboxProcessor
export { InMemoryOutboxRepository } from './outbox';
export type { InMemoryOutboxRepositoryOptions } from './outbox';
