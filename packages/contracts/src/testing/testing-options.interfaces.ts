/**
 * Options interfaces for testing contracts
 * @module @vytches/ddd-contracts/testing
 * @since 1.0.0
 */

/**
 * Options for test clock configuration
 * @since 1.0.0
 */
export interface TestClockOptions {
  /**
   * Initial time for the clock
   */
  initialTime?: Date;

  /**
   * Whether to freeze time
   */
  frozen?: boolean;

  /**
   * Time zone
   */
  timezone?: string;

  /**
   * Auto-advance configuration
   */
  autoAdvance?: {
    enabled: boolean;
    interval: number;
  };
}

/**
 * Options for test harness configuration
 * @since 1.0.0
 */
export interface TestHarnessOptions {
  /**
   * Timeout for test execution
   */
  timeout?: number;

  /**
   * Whether to capture errors
   */
  captureErrors?: boolean;

  /**
   * Whether to restore state after test
   */
  restoreState?: boolean;

  /**
   * Custom context data
   */
  context?: Record<string, unknown>;

  /**
   * Setup hooks
   */
  hooks?: {
    beforeSetup?: () => Promise<void>;
    afterSetup?: () => Promise<void>;
    beforeExecute?: () => Promise<void>;
    afterExecute?: () => Promise<void>;
    beforeTeardown?: () => Promise<void>;
    afterTeardown?: () => Promise<void>;
  };
}

/**
 * Options for test scenario configuration
 * @since 1.0.0
 */
export interface TestScenarioOptions {
  /**
   * Scenario tags for organization
   */
  tags?: string[];

  /**
   * Priority level
   */
  priority?: 'low' | 'medium' | 'high' | 'critical';

  /**
   * Whether scenario is skipped
   */
  skip?: boolean;

  /**
   * Whether scenario is focused
   */
  only?: boolean;

  /**
   * Retry configuration
   */
  retry?: {
    times: number;
    delay?: number;
  };

  /**
   * Timeout override
   */
  timeout?: number;

  /**
   * Required environment variables
   */
  requiredEnv?: string[];

  /**
   * Custom metadata
   */
  metadata?: Record<string, unknown>;
}
