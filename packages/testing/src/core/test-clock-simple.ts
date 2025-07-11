/* eslint-disable @typescript-eslint/no-this-alias */
/**
 * Simplified TestClock implementation focused on core functionality and test isolation.
 * Provides time control for testing without complex global state management.
 */

import type { TestClockState, TimeAdvanceOptions } from './test-clock';

export class TestClockSimple {
  private _isFrozen = false;
  private _frozenTime: Date | null = null;
  private _totalAdvanced = 0;
  private _originalDateNow: () => number;
  private _originalDateConstructor: DateConstructor;

  constructor() {
    this._originalDateNow = Date.now;
    this._originalDateConstructor = global.Date;
  }

  /**
   * Freezes time at the specified date/time
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
    const instance = this;

    // Mock Date.now()
    global.Date.now = () => {
      return instance._frozenTime?.getTime() ?? instance._originalDateNow();
    };

    // Mock Date constructor
    const OriginalDate = this._originalDateConstructor;
    global.Date = class extends OriginalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(instance._frozenTime?.getTime() ?? instance._originalDateNow());
        } else {
          super(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
        }
      }

      static override now(): number {
        return instance._frozenTime?.getTime() ?? instance._originalDateNow();
      }

      // Copy all static methods from original Date
      static override parse = OriginalDate.parse;
      static override UTC = OriginalDate.UTC;
    } as DateConstructor;

    return this;
  }

  /**
   * Advances time by the specified amount
   */
  advance(options: TimeAdvanceOptions): this;
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
   * Resets the clock to its initial state
   */
  reset(): this {
    this.restore();
    this._totalAdvanced = 0;
    return this;
  }

  /**
   * Static utility for running a function with frozen time
   */
  static runWithFrozenTime<T>(date: Date, fn: () => T): T;
  static runWithFrozenTime<T>(date: Date, fn: () => Promise<T>): Promise<T>;
  static runWithFrozenTime<T>(date: Date, fn: () => T | Promise<T>): T | Promise<T> {
    const clock = new TestClockSimple();
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
   * Static utility for time progression scenarios
   */
  static async runWithTimeProgression<T>(
    startDate: Date,
    steps: { advance: TimeAdvanceOptions; execute: () => T | Promise<T> }[]
  ): Promise<T[]> {
    const clock = new TestClockSimple();
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
}
