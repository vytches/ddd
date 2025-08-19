/**
 * Core testing interfaces for VytchesDDD
 * @module @vytches/ddd-contracts/testing
 * @since 1.0.0
 */

/**
 * Interface for test clock implementations
 * @since 1.0.0
 */
export interface ITestClock {
  /**
   * Get the current time
   */
  now(): Date;

  /**
   * Advance time by specified milliseconds
   */
  advance(ms: number): void;

  /**
   * Set specific time
   */
  setTime(date: Date): void;

  /**
   * Reset clock to initial state
   */
  reset(): void;
}

/**
 * Interface for test harness implementations
 * @since 1.0.0
 */
export interface ITestHarness<T = unknown> {
  /**
   * Setup test environment
   */
  setup(): Promise<void>;

  /**
   * Teardown test environment
   */
  teardown(): Promise<void>;

  /**
   * Execute test scenario
   */
  execute(scenario: () => Promise<T>): Promise<T>;

  /**
   * Get test context
   */
  getContext(): unknown;
}

/**
 * Result of safe run execution
 * @since 1.0.0
 */
export interface ISafeRunResult<T = unknown, E = Error> {
  /**
   * Error if operation failed
   */
  error?: E;

  /**
   * Result if operation succeeded
   */
  result?: T;

  /**
   * Whether operation succeeded
   */
  isSuccess(): boolean;

  /**
   * Whether operation failed
   */
  isFailure(): boolean;
}

/**
 * Interface for test data builders
 * @since 1.0.0
 */
export interface ITestDataBuilder<T> {
  /**
   * Build the test data
   */
  build(): T;

  /**
   * Reset builder to initial state
   */
  reset(): ITestDataBuilder<T>;

  /**
   * Clone the builder
   */
  clone(): ITestDataBuilder<T>;
}

/**
 * Interface for test scenarios
 * @since 1.0.0
 */
export interface ITestScenario {
  /**
   * Scenario name
   */
  name: string;

  /**
   * Scenario description
   */
  description?: string;

  /**
   * Setup function
   */
  setup?: () => Promise<void>;

  /**
   * Execution function
   */
  execute: () => Promise<void>;

  /**
   * Cleanup function
   */
  cleanup?: () => Promise<void>;

  /**
   * Expected outcome
   */
  expectedOutcome?: unknown;
}

/**
 * Interface for test fixtures
 * @since 1.0.0
 */
export interface ITestFixture<T = unknown> {
  /**
   * Create fixture instance
   */
  create(): T;

  /**
   * Create multiple fixture instances
   */
  createMany(count: number): T[];

  /**
   * Create fixture with overrides
   */
  createWith(overrides: Partial<T>): T;

  /**
   * Get default values
   */
  getDefaults(): T;
}
