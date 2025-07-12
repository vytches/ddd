import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { TestClock, withTestClock, type TimeAdvanceOptions } from '../../src';

describe('TestClock', () => {
  let testClock: TestClock;

  beforeEach(() => {
    testClock = TestClock.create();
  });

  afterEach(() => {
    testClock.restore();
    // Also restore the singleton instance
    TestClock.getInstance().restore();
  });

  describe('basic functionality', () => {
    it('should create a new instance', () => {
      expect(testClock).toBeInstanceOf(TestClock);
      expect(testClock.isFrozen()).toBe(false);
    });

    it('should provide singleton access', () => {
      const instance1 = TestClock.getInstance();
      const instance2 = TestClock.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return current time when not frozen', () => {
      const beforeNow = Date.now();
      const clockNow = testClock.now().getTime();
      const afterNow = Date.now();

      expect(clockNow).toBeGreaterThanOrEqual(beforeNow);
      expect(clockNow).toBeLessThanOrEqual(afterNow);
    });
  });

  describe('time freezing', () => {
    it('should freeze time at specified date', () => {
      const freezeDate = new Date('2024-01-01T12:00:00Z');
      testClock.freeze(freezeDate);

      expect(testClock.isFrozen()).toBe(true);
      expect(testClock.now().getTime()).toBe(freezeDate.getTime());
      expect(Date.now()).toBe(freezeDate.getTime());
      expect(new Date().getTime()).toBe(freezeDate.getTime());
    });

    it('should freeze at current time when no date specified', () => {
      const beforeFreeze = Date.now();
      testClock.freeze();
      const afterFreeze = testClock.now().getTime();

      expect(testClock.isFrozen()).toBe(true);
      expect(afterFreeze).toBeGreaterThanOrEqual(beforeFreeze);
      // Should be very close to the freeze time
      expect(Math.abs(afterFreeze - beforeFreeze)).toBeLessThan(100);
    });

    it('should maintain frozen time across Date.now() calls', () => {
      const freezeDate = new Date('2024-06-15T10:30:00Z');
      testClock.freeze(freezeDate);

      const time1 = Date.now();
      // Simulate some time passing
      setTimeout(() => {
        return;
      }, 1);
      const time2 = Date.now();

      expect(time1).toBe(freezeDate.getTime());
      expect(time2).toBe(freezeDate.getTime());
      expect(time1).toBe(time2);
    });

    it('should maintain frozen time across new Date() calls', () => {
      const freezeDate = new Date('2024-12-25T00:00:00Z');
      testClock.freeze(freezeDate);

      const date1 = new Date();
      const date2 = new Date();

      expect(date1.getTime()).toBe(freezeDate.getTime());
      expect(date2.getTime()).toBe(freezeDate.getTime());
      expect(date1.getTime()).toBe(date2.getTime());
    });
  });

  describe('time advancement', () => {
    beforeEach(() => {
      const freezeDate = new Date('2024-01-01T12:00:00Z');
      testClock.freeze(freezeDate);
    });

    it('should advance time by milliseconds', () => {
      const initialTime = testClock.now().getTime();
      testClock.advance(5000); // 5 seconds

      expect(testClock.now().getTime()).toBe(initialTime + 5000);
      expect(Date.now()).toBe(initialTime + 5000);
    });

    it('should advance time using options object', () => {
      const initialTime = testClock.now().getTime();
      const options: TimeAdvanceOptions = {
        milliseconds: 500,
        seconds: 30,
        minutes: 2,
        hours: 1,
        days: 1,
      };

      testClock.advance(options);

      const expectedAdvancement =
        500 + 30 * 1000 + 2 * 60 * 1000 + 1 * 60 * 60 * 1000 + 1 * 24 * 60 * 60 * 1000;
      expect(testClock.now().getTime()).toBe(initialTime + expectedAdvancement);
    });

    it('should track total advanced time', () => {
      expect(testClock.getTotalAdvanced()).toBe(0);

      testClock.advance(1000);
      expect(testClock.getTotalAdvanced()).toBe(1000);

      testClock.advance({ seconds: 5 });
      expect(testClock.getTotalAdvanced()).toBe(6000);

      testClock.advance({ minutes: 1 });
      expect(testClock.getTotalAdvanced()).toBe(66000);
    });

    it('should throw error when advancing unfrozen clock', () => {
      testClock.restore();
      const [advanceError] = safeRun(() => testClock.advance(1000));
      expect(advanceError?.message).toBe(
        'Cannot advance time when clock is not frozen. Call freeze() first.'
      );
    });

    it('should handle multiple advances correctly', () => {
      const initialTime = testClock.now().getTime();

      testClock.advance(1000);
      testClock.advance(2000);
      testClock.advance({ minutes: 1 });

      expect(testClock.now().getTime()).toBe(initialTime + 1000 + 2000 + 60000);
    });
  });

  describe('state management', () => {
    it('should provide current state information', () => {
      const state = testClock.getState();

      expect(state.isFrozen).toBe(false);
      expect(state.frozenTime).toBeNull();
      expect(state.totalAdvanced).toBe(0);
    });

    it('should update state when frozen', () => {
      const freezeDate = new Date('2024-07-04T16:00:00Z');
      testClock.freeze(freezeDate);

      const state = testClock.getState();

      expect(state.isFrozen).toBe(true);
      expect(state.frozenTime?.getTime()).toBe(freezeDate.getTime());
      expect(state.totalAdvanced).toBe(0);
    });

    it('should update state when time is advanced', () => {
      testClock.freeze(new Date('2024-01-01T00:00:00Z'));
      testClock.advance(5000);

      const state = testClock.getState();

      expect(state.isFrozen).toBe(true);
      expect(state.totalAdvanced).toBe(5000);
    });
  });

  describe('restoration', () => {
    it('should restore normal time behavior', () => {
      const freezeDate = new Date('2024-01-01T12:00:00Z');
      testClock.freeze(freezeDate);

      expect(testClock.isFrozen()).toBe(true);
      expect(Date.now()).toBe(freezeDate.getTime());

      testClock.restore();

      expect(testClock.isFrozen()).toBe(false);
      expect(Date.now()).not.toBe(freezeDate.getTime());

      // Should be close to current time
      const now = Date.now();
      expect(Math.abs(now - Date.now())).toBeLessThan(100);
    });

    it('should handle multiple restore calls safely', () => {
      testClock.freeze(new Date());
      testClock.restore();

      const [restoreError] = safeRun(() => testClock.restore());
      expect(restoreError).toBeUndefined();
      expect(testClock.isFrozen()).toBe(false);
    });

    it('should reset total advanced time on restore', () => {
      testClock.freeze(new Date());
      testClock.advance(5000);
      expect(testClock.getTotalAdvanced()).toBe(5000);

      testClock.restore();
      // Note: restore() sets totalAdvanced to 0
      expect(testClock.getTotalAdvanced()).toBe(0);
    });
  });

  describe('reset functionality', () => {
    it('should reset clock to initial state', () => {
      testClock.freeze(new Date('2024-01-01T12:00:00Z'));
      testClock.advance(5000);

      expect(testClock.isFrozen()).toBe(true);
      expect(testClock.getTotalAdvanced()).toBe(5000);

      testClock.reset();

      expect(testClock.isFrozen()).toBe(false);
      expect(testClock.getTotalAdvanced()).toBe(0);
    });
  });

  describe('static utility methods', () => {
    it('should run function with frozen time', () => {
      const freezeDate = new Date('2024-01-01T12:00:00Z');
      let capturedTime: number;

      const result = TestClock.runWithFrozenTime(freezeDate, () => {
        capturedTime = Date.now();
        return 'test result';
      });

      expect(result).toBe('test result');
      expect(capturedTime!).toBe(freezeDate.getTime());

      // Time should be restored after function execution
      expect(Date.now()).not.toBe(freezeDate.getTime());
    });

    it('should run async function with frozen time', async () => {
      const freezeDate = new Date('2024-06-15T08:30:00Z');
      let capturedTime: number;

      const result = await TestClock.runWithFrozenTime(freezeDate, async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        capturedTime = Date.now();
        return 'async result';
      });

      expect(result).toBe('async result');
      expect(capturedTime!).toBe(freezeDate.getTime());

      // Time should be restored after async function execution
      expect(Date.now()).not.toBe(freezeDate.getTime());
    });

    it('should restore time even if function throws', () => {
      const freezeDate = new Date('2024-01-01T12:00:00Z');

      const [throwError] = safeRun(() => {
        TestClock.runWithFrozenTime(freezeDate, () => {
          throw new Error('test error');
        });
      });
      expect(throwError?.message).toBe('test error');

      // Time should still be restored
      expect(Date.now()).not.toBe(freezeDate.getTime());
    });

    it('should run time progression scenario', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const capturedTimes: number[] = [];

      const results = await TestClock.runWithTimeProgression(startDate, [
        {
          advance: { minutes: 5 },
          execute: () => {
            capturedTimes.push(Date.now());
            return 'step1';
          },
        },
        {
          advance: { hours: 1 },
          execute: () => {
            capturedTimes.push(Date.now());
            return 'step2';
          },
        },
        {
          advance: { days: 1 },
          execute: async () => {
            capturedTimes.push(Date.now());
            return 'step3';
          },
        },
      ]);

      expect(results).toEqual(['step1', 'step2', 'step3']);
      expect(capturedTimes[0]).toBe(startDate.getTime() + 5 * 60 * 1000);
      expect(capturedTimes[1]).toBe(startDate.getTime() + 5 * 60 * 1000 + 1 * 60 * 60 * 1000);
      expect(capturedTimes[2]).toBe(
        startDate.getTime() + 5 * 60 * 1000 + 1 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000
      );
    });
  });

  describe('TimeScenarioBuilder', () => {
    it('should build and run time scenarios', async () => {
      const startDate = new Date('2024-01-01T12:00:00Z');
      const capturedTimes: number[] = [];

      const results = await TestClock.createTimeScenario()
        .freezeAt(startDate)
        .execute(() => {
          capturedTimes.push(Date.now());
          return 'initial';
        })
        .advanceBy({ minutes: 30 })
        .execute(() => {
          capturedTimes.push(Date.now());
          return 'after 30min';
        })
        .advanceBy(5000) // 5 seconds
        .execute(async () => {
          capturedTimes.push(Date.now());
          return 'after 5sec';
        })
        .run();

      expect(results).toEqual(['initial', 'after 30min', 'after 5sec']);
      expect(capturedTimes[0]).toBe(startDate.getTime());
      expect(capturedTimes[1]).toBe(startDate.getTime() + 30 * 60 * 1000);
      expect(capturedTimes[2]).toBe(startDate.getTime() + 30 * 60 * 1000 + 5000);
    });

    it('should restore time after scenario completion', async () => {
      const beforeScenario = Date.now();

      await TestClock.createTimeScenario()
        .freezeAt(new Date('2020-01-01T00:00:00Z'))
        .execute(() => 'test')
        .run();

      const afterScenario = Date.now();
      expect(afterScenario).toBeGreaterThanOrEqual(beforeScenario);
    });
  });

  describe('integration with domain patterns', () => {
    it('should work with event timestamps', () => {
      const eventTime = new Date('2024-01-01T12:00:00Z');
      testClock.freeze(eventTime);

      interface DomainEvent {
        timestamp: Date;
        type: string;
        data: any;
      }

      const createEvent = (type: string, data: any): DomainEvent => ({
        timestamp: new Date(),
        type,
        data,
      });

      const event1 = createEvent('UserCreated', { id: 1 });
      testClock.advance({ minutes: 5 });
      const event2 = createEvent('UserUpdated', { id: 1 });

      expect(event1.timestamp.getTime()).toBe(eventTime.getTime());
      expect(event2.timestamp.getTime()).toBe(eventTime.getTime() + 5 * 60 * 1000);
    });

    it('should work with timeout testing', async () => {
      const startTime = new Date('2024-01-01T12:00:00Z');
      testClock.freeze(startTime);

      // Advance time to trigger timeout
      testClock.advance(5000);

      // In a real test, you might need to use fake timers
      // This is a simplified example
      expect(testClock.now().getTime()).toBe(startTime.getTime() + 5000);
    });

    it('should support business rule testing with time constraints', () => {
      // Use local time to avoid timezone issues
      const businessDate = new Date('2024-12-31T12:00:00');
      testClock.freeze(businessDate);

      const isEndOfYear = () => {
        const now = new Date();
        return now.getMonth() === 11 && now.getDate() === 31;
      };

      expect(isEndOfYear()).toBe(true);

      testClock.advance({ hours: 24 }); // Move to next year
      const afterAdvance = new Date();
      expect(afterAdvance.getFullYear()).toBe(2025); // Should be next year
      expect(isEndOfYear()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle Date.now restoration properly', () => {
      const originalNow = Date.now;
      testClock.freeze(new Date());

      expect(Date.now).not.toBe(originalNow);

      testClock.restore();
      expect(Date.now).toBe(originalNow);
    });

    it('should handle Date constructor restoration properly', () => {
      const originalDate = global.Date;
      testClock.freeze(new Date());

      expect(global.Date).not.toBe(originalDate);

      testClock.restore();
      expect(global.Date).toBe(originalDate);
    });

    it('should maintain Date static methods after mocking', () => {
      testClock.freeze(new Date());

      expect(typeof Date.parse).toBe('function');
      expect(typeof Date.UTC).toBe('function');

      testClock.restore();

      expect(typeof Date.parse).toBe('function');
      expect(typeof Date.UTC).toBe('function');
    });
  });
});

describe('withTestClock decorator', () => {
  afterEach(() => {
    TestClock.getInstance().restore();
  });

  it('should automatically manage test clock with default options', async () => {
    class TestClass {
      @withTestClock()
      async testMethod(): Promise<number> {
        return Date.now();
      }
    }

    const instance = new TestClass();
    const result = await instance.testMethod();

    // Should return current time (not frozen by default)
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('should freeze time when specified', async () => {
    const freezeDate = new Date('2024-01-01T12:00:00Z');

    class TestClass {
      @withTestClock({ freezeAt: freezeDate })
      async testMethod(): Promise<number> {
        return Date.now();
      }
    }

    const instance = new TestClass();
    const result = await instance.testMethod();

    expect(result).toBe(freezeDate.getTime());

    // Time should be restored after method execution
    expect(Date.now()).not.toBe(freezeDate.getTime());
  });

  it('should restore time even if method throws', async () => {
    const freezeDate = new Date('2024-01-01T12:00:00Z');

    class TestClass {
      @withTestClock({ freezeAt: freezeDate })
      async testMethod(): Promise<void> {
        throw new Error('test error');
      }
    }

    const instance = new TestClass();

    const [methodError] = await safeRun(() => instance.testMethod());
    expect(methodError?.message).toBe('test error');

    // Time should still be restored
    expect(Date.now()).not.toBe(freezeDate.getTime());
  });

  it('should respect autoRestore option', async () => {
    const freezeDate = new Date('2024-01-01T12:00:00Z');

    class TestClass {
      @withTestClock({ freezeAt: freezeDate, autoRestore: false })
      async testMethod(): Promise<number> {
        return Date.now();
      }
    }

    const instance = new TestClass();
    const result = await instance.testMethod();

    expect(result).toBe(freezeDate.getTime());

    // Time should NOT be restored when autoRestore is false
    expect(Date.now()).toBe(freezeDate.getTime());

    // Manually restore for cleanup
    TestClock.getInstance().restore();
  });
});
