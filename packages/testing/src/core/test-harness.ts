/**
 * TestHarness - Base class for all testing utilities in the VytchesDDD framework.
 * Provides common testing infrastructure, setup/teardown patterns, and utility methods.
 *
 * This is the foundation class that all specialized test harnesses extend from,
 * ensuring consistent behavior and shared functionality across the testing framework.
 */

import { TestClock } from './test-clock';
import { safeRun, expectError, expectSuccess, type SafeRunResult } from './safe-run';

/**
 * @llm-summary Contract for test harness options functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * TestHarnessOptions interface implementing infrastructure service for test harness options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTestHarnessOptions implements TestHarnessOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface TestHarnessOptions {
  /**
   * Automatically clean up resources after each test
   */
  autoCleanup?: boolean;
  /**
   * Enable time control features
   */
  enableTimeFreezing?: boolean;
  /**
   * Custom setup timeout in milliseconds
   */
  setupTimeout?: number;
  /**
   * Custom teardown timeout in milliseconds
   */
  teardownTimeout?: number;
  /**
   * Enable detailed logging for debugging
   */
  verbose?: boolean;
}

/**
 * @llm-summary Contract for test harness state functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * TestHarnessState interface implementing infrastructure service for test harness state operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTestHarnessState implements TestHarnessState {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface TestHarnessState {
  readonly isInitialized: boolean;
  readonly isSetup: boolean;
  readonly setupTime: Date | null;
  readonly teardownTime: Date | null;
  readonly resourceCount: number;
  readonly hasErrors: boolean;
}

/**
 * @llm-summary Contract for test resource functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * TestResource interface implementing infrastructure service for test resource operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTestResource implements TestResource {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface TestResource {
  readonly id: string;
  readonly type: string;
  readonly created: Date;
  dispose(): Promise<void> | void;
}

/**
 * @llm-summary TestHarness class for test harness operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * TestHarness class implementing infrastructure service for test harness operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TestHarness();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new TestHarness());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class TestHarness {
  protected readonly options: Required<TestHarnessOptions>;
  protected _isInitialized = false;
  protected _isSetup = false;
  protected _setupTime: Date | null = null;
  protected _teardownTime: Date | null = null;
  protected _resources: Map<string, TestResource> = new Map();
  protected _errors: Error[] = [];
  protected _testClock: TestClock | null = null;

  constructor(options: TestHarnessOptions = {}) {
    this.options = {
      autoCleanup: options.autoCleanup ?? true,
      enableTimeFreezing: options.enableTimeFreezing ?? false,
      setupTimeout: options.setupTimeout ?? 30000,
      teardownTimeout: options.teardownTimeout ?? 10000,
      verbose: options.verbose ?? false,
    };

    if (this.options.enableTimeFreezing) {
      this._testClock = TestClock.create();
    }
  }

  /**
   * Initialize the test harness. Must be called before using the harness.
   */
  async initialize(): Promise<this> {
    if (this._isInitialized) {
      return this;
    }

    try {
      await this.performInitialization();
      this._isInitialized = true;
      this.log('TestHarness initialized successfully');
    } catch (error) {
      this._errors.push(error as Error);
      throw new Error(`Failed to initialize TestHarness: ${(error as Error).message}`);
    }

    return this;
  }

  /**
   * Set up the test environment. Called before each test.
   */
  async setup(): Promise<this> {
    this.ensureInitialized();

    if (this._isSetup) {
      this.log('TestHarness already set up, performing reset');
      await this.reset();
    }

    try {
      this._setupTime = new Date();
      await this.performSetup();
      this._isSetup = true;
      this.log('TestHarness setup completed');
    } catch (error) {
      this._errors.push(error as Error);
      throw new Error(`Failed to setup TestHarness: ${(error as Error).message}`);
    }

    return this;
  }

  /**
   * Clean up the test environment. Called after each test.
   */
  async teardown(): Promise<this> {
    if (!this._isSetup) {
      return this;
    }

    try {
      await this.performTeardown();

      if (this.options.autoCleanup) {
        await this.disposeAllResources();
      }

      if (this._testClock) {
        this._testClock.restore();
      }

      this._teardownTime = new Date();
      this._isSetup = false;
      this.log('TestHarness teardown completed');
    } catch (error) {
      this._errors.push(error as Error);
      this.log(`Error during teardown: ${(error as Error).message}`);
      // Don't throw during teardown to avoid masking test failures
    }

    return this;
  }

  /**
   * Reset the harness to a clean state without full teardown/setup cycle
   */
  async reset(): Promise<this> {
    this.ensureInitialized();

    try {
      await this.performReset();
      this._errors.length = 0; // Clear previous errors
      this.log('TestHarness reset completed');
    } catch (error) {
      this._errors.push(error as Error);
      throw new Error(`Failed to reset TestHarness: ${(error as Error).message}`);
    }

    return this;
  }

  /**
   * Dispose of the harness and all resources. Called when completely done.
   */
  async dispose(): Promise<void> {
    try {
      if (this._isSetup) {
        await this.teardown();
      }

      await this.disposeAllResources();
      await this.performDisposal();

      if (this._testClock) {
        this._testClock.restore();
        this._testClock = null;
      }

      this._isInitialized = false;
      this.log('TestHarness disposed successfully');
    } catch (error) {
      this._errors.push(error as Error);
      this.log(`Error during disposal: ${(error as Error).message}`);
    }
  }

  /**
   * Get the current state of the test harness
   */
  getState(): TestHarnessState {
    return {
      isInitialized: this._isInitialized,
      isSetup: this._isSetup,
      setupTime: this._setupTime ? new Date(this._setupTime) : null,
      teardownTime: this._teardownTime ? new Date(this._teardownTime) : null,
      resourceCount: this._resources.size,
      hasErrors: this._errors.length > 0,
    };
  }

  /**
   * Get all errors that occurred during harness operations
   */
  getErrors(): readonly Error[] {
    return [...this._errors];
  }

  /**
   * Register a resource for automatic cleanup
   */
  protected registerResource(resource: TestResource): void {
    this._resources.set(resource.id, resource);
    this.log(`Registered resource: ${resource.type}#${resource.id}`);
  }

  /**
   * Unregister a resource
   */
  protected unregisterResource(resourceId: string): boolean {
    const removed = this._resources.delete(resourceId);
    if (removed) {
      this.log(`Unregistered resource: ${resourceId}`);
    }
    return removed;
  }

  /**
   * Get access to the test clock (if enabled)
   */
  protected getTestClock(): TestClock {
    if (!this._testClock) {
      throw new Error('TestClock is not enabled. Set enableTimeFreezing: true in options.');
    }
    return this._testClock;
  }

  /**
   * Execute a function safely and return result/error tuple
   */
  protected safeExecute<T>(fn: () => T): SafeRunResult<T>;
  protected safeExecute<T>(fn: () => Promise<T>): Promise<SafeRunResult<T>>;
  protected safeExecute<T>(fn: () => T | Promise<T>): SafeRunResult<T> | Promise<SafeRunResult<T>> {
    return safeRun(fn) as SafeRunResult<T> | Promise<SafeRunResult<T>>;
  }

  /**
   * Assert that an operation throws the expected error type
   */
  protected expectError<E extends Error>(
    errorType: new (...args: any[]) => E
  ): (result: SafeRunResult<any, E>) => E {
    return expectError(errorType);
  }

  /**
   * Assert that an operation succeeds and return the value
   */
  protected expectSuccess<T>(result: SafeRunResult<T>): T {
    return expectSuccess(result);
  }

  /**
   * Log a message if verbose logging is enabled
   */
  protected log(message: string): void {
    if (this.options.verbose) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${this.constructor.name}] ${message}`);
    }
  }

  /**
   * Ensure the harness is initialized before proceeding
   */
  protected ensureInitialized(): void {
    if (!this._isInitialized) {
      throw new Error('TestHarness must be initialized before use. Call initialize() first.');
    }
  }

  /**
   * Ensure the harness is set up before proceeding
   */
  protected ensureSetup(): void {
    this.ensureInitialized();
    if (!this._isSetup) {
      throw new Error('TestHarness must be set up before use. Call setup() first.');
    }
  }

  /**
   * Dispose of all registered resources
   */
  private async disposeAllResources(): Promise<void> {
    const disposalPromises = Array.from(this._resources.values()).map(async resource => {
      try {
        await resource.dispose();
        this.log(`Disposed resource: ${resource.type}#${resource.id}`);
      } catch (error) {
        this._errors.push(error as Error);
        this.log(`Error disposing resource ${resource.id}: ${(error as Error).message}`);
      }
    });

    await Promise.allSettled(disposalPromises);
    this._resources.clear();
  }

  // Abstract methods that subclasses must implement

  /**
   * Perform harness-specific initialization logic
   */
  protected abstract performInitialization(): Promise<void>;

  /**
   * Perform harness-specific setup logic
   */
  protected abstract performSetup(): Promise<void>;

  /**
   * Perform harness-specific teardown logic
   */
  protected abstract performTeardown(): Promise<void>;

  /**
   * Perform harness-specific reset logic
   */
  protected abstract performReset(): Promise<void>;

  /**
   * Perform harness-specific disposal logic
   */
  protected abstract performDisposal(): Promise<void>;
}

/**
 * @llm-summary SimpleTestHarness class for simple test harness operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * SimpleTestHarness class implementing infrastructure service for simple test harness operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new SimpleTestHarness();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new SimpleTestHarness());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class SimpleTestHarness extends TestHarness {
  private _customSetupFn: (() => Promise<void> | void) | undefined;
  private _customTeardownFn: (() => Promise<void> | void) | undefined;

  constructor(
    options: TestHarnessOptions & {
      setupFn?: () => Promise<void> | void;
      teardownFn?: () => Promise<void> | void;
    } = {}
  ) {
    super(options);
    this._customSetupFn = options.setupFn;
    this._customTeardownFn = options.teardownFn;
  }

  protected async performInitialization(): Promise<void> {
    // Basic initialization - nothing specific needed
  }

  protected async performSetup(): Promise<void> {
    if (this._customSetupFn) {
      await this._customSetupFn();
    }
  }

  protected async performTeardown(): Promise<void> {
    if (this._customTeardownFn) {
      await this._customTeardownFn();
    }
  }

  protected async performReset(): Promise<void> {
    // Basic reset - clear errors
    this._errors.length = 0;
  }

  protected async performDisposal(): Promise<void> {
    // Basic disposal - nothing specific needed
  }
}

/**
 * @llm-summary TestResourceBuilder class for test resource builder operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * TestResourceBuilder class implementing infrastructure service for test resource builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TestResourceBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new TestResourceBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class TestResourceBuilder {
  private _id: string;
  private _type: string;
  private _disposeFn: (() => Promise<void> | void) | null = null;

  constructor(type: string, id?: string) {
    this._type = type;
    this._id = id || `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  withId(id: string): this {
    this._id = id;
    return this;
  }

  withDisposal(disposeFn: () => Promise<void> | void): this {
    this._disposeFn = disposeFn;
    return this;
  }

  build(): TestResource {
    return {
      id: this._id,
      type: this._type,
      created: new Date(),
      dispose: this._disposeFn || (() => Promise.resolve()),
    };
  }

  static create(type: string, id?: string): TestResourceBuilder {
    return new TestResourceBuilder(type, id);
  }
}
