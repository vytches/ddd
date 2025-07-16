/**
 * @llm-summary Contract for time advance options functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * TimeAdvanceOptions interface implementing infrastructure service for time advance options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTimeAdvanceOptions implements TimeAdvanceOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */

export interface TimeAdvanceOptions {
  /**
   * Number of milliseconds to advance
   */
  milliseconds?: number;
  /**
   * Number of seconds to advance
   */
  seconds?: number;
  /**
   * Number of minutes to advance
   */
  minutes?: number;
  /**
   * Number of hours to advance
   */
  hours?: number;
  /**
   * Number of days to advance
   */
  days?: number;
}

/**
 * @llm-summary Contract for test clock state functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * TestClockState interface implementing infrastructure service for test clock state operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTestClockState implements TestClockState {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface TestClockState {
  readonly isFrozen: boolean;
  readonly frozenTime: Date | null;
  readonly totalAdvanced: number;
}

/**
 * @llm-summary TestClock class for test clock operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * TestClock class implementing infrastructure service for test clock operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TestClock();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new TestClock());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class TestClock {
  private static instance: TestClock | null = null;
  private _isFrozen = false;
  private _frozenTime: Date | null = null;
  private _totalAdvanced = 0;
  private _originalDateNow: () => number;
  private _originalDateConstructor: DateConstructor;

  private constructor() {
    this._originalDateNow = Date.now;
    this._originalDateConstructor = global.Date;
  }

  /**
   * Gets the singleton TestClock instance
   */
  static getInstance(): TestClock {
    if (!TestClock.instance) {
      TestClock.instance = new TestClock();
    }
    return TestClock.instance;
  }

  /**
   * Creates a new TestClock instance for isolated testing
   */
  static create(): TestClock {
    return new TestClock();
  }

  /**
   * Freezes time at the specified date/time
   * @param date - The date to freeze time at (defaults to current time)
   */
  freeze(date?: Date): this {
    if (this._isFrozen) {
      this.restore(); // Clean up previous freeze
    }

    const freezeTime = date || new Date();
    this._frozenTime = new Date(freezeTime);
    this._isFrozen = true;
    this._totalAdvanced = 0;

    // Store reference to this instance
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const instance = this;

    // Mock Date constructor and Date.now together
    const OriginalDate = this._originalDateConstructor;
    const MockedDate = function (this: any, ...args: any[]) {
      if (new.target) {
        // Called with new
        if (args.length === 0) {
          return new OriginalDate(instance._frozenTime?.getTime() ?? instance._originalDateNow());
        } else {
          return new (OriginalDate as any)(...args);
        }
      } else {
        // Called as function
        return new OriginalDate().toString();
      }
    } as any;

    // Copy all static methods from original Date
    MockedDate.now = () => {
      return instance._frozenTime?.getTime() ?? instance._originalDateNow();
    };
    MockedDate.parse = OriginalDate.parse;
    MockedDate.UTC = OriginalDate.UTC;
    MockedDate.prototype = OriginalDate.prototype;

    global.Date = MockedDate;

    return this;
  }

  /**
   * Advances time by the specified amount
   * @param options - Time advancement options
   */
  advance(options: TimeAdvanceOptions): this;
  /**
   * Advances time by the specified number of milliseconds
   * @param milliseconds - Number of milliseconds to advance
   */
  advance(milliseconds: number): this;
  advance(optionsOrMs: TimeAdvanceOptions | number): this {
    if (!this._isFrozen) {
      throw new Error('Cannot advance time when clock is not frozen. Call freeze() first.');
    }

    let totalMs: number;

    if (typeof optionsOrMs === 'number') {
      totalMs = optionsOrMs;
    } else {
      const options = optionsOrMs;
      totalMs =
        (options.milliseconds || 0) +
        (options.seconds || 0) * 1000 +
        (options.minutes || 0) * 60 * 1000 +
        (options.hours || 0) * 60 * 60 * 1000 +
        (options.days || 0) * 24 * 60 * 60 * 1000;
    }

    if (this._frozenTime) {
      this._frozenTime = new Date(this._frozenTime.getTime() + totalMs);
      this._totalAdvanced += totalMs;
    }

    return this;
  }

  /**
   * Restores normal time behavior
   */
  restore(): this {
    if (this._isFrozen) {
      global.Date.now = this._originalDateNow;
      global.Date = this._originalDateConstructor;
      this._isFrozen = false;
      this._frozenTime = null;
      this._totalAdvanced = 0;
    }
    return this;
  }

  /**
   * Gets the current time (frozen or real)
   */
  now(): Date {
    return this._isFrozen && this._frozenTime ? new Date(this._frozenTime) : new Date();
  }

  /**
   * Gets the current state of the clock
   */
  getState(): TestClockState {
    return {
      isFrozen: this._isFrozen,
      frozenTime: this._frozenTime ? new Date(this._frozenTime) : null,
      totalAdvanced: this._totalAdvanced,
    };
  }

  /**
   * Checks if the clock is currently frozen
   */
  isFrozen(): boolean {
    return this._isFrozen;
  }

  /**
   * Gets the total time advanced in milliseconds
   */
  getTotalAdvanced(): number {
    return this._totalAdvanced;
  }

  /**
   * Resets the clock to its initial state
   */
  reset(): this {
    this.restore();
    this._totalAdvanced = 0;
    return this;
  }

  /**
   * Runs a function with time frozen at the specified date
   * @param date - The date to freeze time at
   * @param fn - The function to run with frozen time
   */
  static runWithFrozenTime<T>(date: Date, fn: () => T): T;
  /**
   * Runs an async function with time frozen at the specified date
   * @param date - The date to freeze time at
   * @param fn - The async function to run with frozen time
   */
  static runWithFrozenTime<T>(date: Date, fn: () => Promise<T>): Promise<T>;
  static runWithFrozenTime<T>(date: Date, fn: () => T | Promise<T>): T | Promise<T> {
    const clock = TestClock.create();
    clock.freeze(date);

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result.finally(() => clock.restore());
      } else {
        clock.restore();
        return result;
      }
    } catch (error) {
      clock.restore();
      throw error;
    }
  }

  /**
   * Utility for testing time-dependent operations with step-by-step time advancement
   */
  static async runWithTimeProgression<T>(
    startDate: Date,
    steps: { advance: TimeAdvanceOptions; execute: () => T | Promise<T> }[]
  ): Promise<T[]> {
    const clock = TestClock.create();
    const results: T[] = [];

    try {
      clock.freeze(startDate);

      for (const step of steps) {
        clock.advance(step.advance);
        const result = await step.execute();
        results.push(result);
      }

      return results;
    } finally {
      clock.restore();
    }
  }

  /**
   * Utility for creating time-based test scenarios
   */
  static createTimeScenario() {
    return new TimeScenarioBuilder();
  }
}

/**
 * @llm-summary TimeScenarioBuilder class for time scenario builder operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * TimeScenarioBuilder class implementing infrastructure service for time scenario builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TimeScenarioBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new TimeScenarioBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class TimeScenarioBuilder {
  private steps: Array<{
    type: 'freeze' | 'advance' | 'execute';
    data: any;
  }> = [];

  /**
   * Freeze time at the specified date
   */
  freezeAt(date: Date): this {
    this.steps.push({ type: 'freeze', data: date });
    return this;
  }

  /**
   * Advance time by the specified amount
   */
  advanceBy(options: TimeAdvanceOptions): this;
  advanceBy(milliseconds: number): this;
  advanceBy(optionsOrMs: TimeAdvanceOptions | number): this {
    this.steps.push({ type: 'advance', data: optionsOrMs });
    return this;
  }

  /**
   * Execute a function at the current time
   */
  execute<T>(fn: () => T | Promise<T>): this {
    this.steps.push({ type: 'execute', data: fn });
    return this;
  }

  /**
   * Run the scenario and return all execution results
   */
  async run<T = any>(): Promise<T[]> {
    const clock = TestClock.create();
    const results: T[] = [];

    try {
      for (const step of this.steps) {
        switch (step.type) {
          case 'freeze':
            clock.freeze(step.data);
            break;
          case 'advance':
            clock.advance(step.data);
            break;
          case 'execute':
            // eslint-disable-next-line no-case-declarations
            const result = await step.data();
            results.push(result);
            break;
        }
      }

      return results;
    } finally {
      clock.restore();
    }
  }
}

/**
 * @llm-summary with test clock function
 * @llm-domain Infrastructure
 * @llm-pure false
 *
 * @description
 * withTestClock function implementing infrastructure service for with test clock operations.
 *
 *
 * @param {{ freezeAt?: Date; autoRestore?: boolean }} options? - options? parameter
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = withTestClock(options?);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => withTestClock(options?));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function withTestClock(options?: { freezeAt?: Date; autoRestore?: boolean }) {
  return function <T extends (...args: any[]) => any>(
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const clock = TestClock.create();

      try {
        if (options?.freezeAt) {
          clock.freeze(options.freezeAt);
        }

        const result = await originalMethod.apply(this, args);

        if (options?.autoRestore !== false) {
          clock.restore();
        }

        return result;
      } catch (error) {
        if (options?.autoRestore !== false) {
          clock.restore();
        }
        throw error;
      }
    };

    return descriptor;
  };
}
