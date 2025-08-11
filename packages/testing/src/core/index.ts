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

export {
  DomainEventBuilder,
  EntityIdBuilder,
  TestDataBuilder,
  UserBuilder,
  type RandomOptions,
  type SequenceOptions,
  type TestDataBuilderOptions,
  type TestDomainEvent,
  type TestUser,
} from './test-data-builder';
