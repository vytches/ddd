// Core testing utilities - Foundation Layer
// Export all core testing functionality

export {
  expectError,
  expectSuccess,
  safeRun,
  safeRunTest,
  safeRunWithTimeout,
  type SafeRunResult,
} from './safe-run';

export {
  TestClock,
  TimeScenarioBuilder,
  withTestClock,
  type TestClockState,
  type TimeAdvanceOptions,
} from './test-clock';

export { TestClockSimple } from './test-clock-simple';

export {
  SimpleTestHarness,
  TestHarness,
  TestResourceBuilder,
  type TestHarnessOptions,
  type TestHarnessState,
  type TestResource,
} from './test-harness';

// Test data builders removed - will be replaced by DDD-native seeder in v1.1.0
// See: /docs/adr/0019-ddd-seeder-framework-architecture.md
