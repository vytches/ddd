// Core testing utilities - Foundation Layer
// Export all core testing functionality

export {
  safeRun,
  safeRunTest,
  expectError,
  expectSuccess,
  safeRunWithTimeout,
  type SafeRunResult
} from './safe-run';

export {
  TestClock,
  TimeScenarioBuilder,
  withTestClock,
  type TimeAdvanceOptions,
  type TestClockState
} from './test-clock';

export {
  TestClockSimple,
} from './test-clock-simple';

export {
  TestHarness,
  SimpleTestHarness,
  TestResourceBuilder,
  type TestHarnessOptions,
  type TestHarnessState,
  type TestResource
} from './test-harness';

export {
  TestDataBuilder,
  EntityIdBuilder,
  UserBuilder,
  DomainEventBuilder,
  type TestDataBuilderOptions,
  type SequenceOptions,
  type RandomOptions,
  type TestUser,
  type TestDomainEvent
} from './test-data-builder';
