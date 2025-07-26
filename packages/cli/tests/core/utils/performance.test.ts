import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { Performance } from '../../../src/core/utils/performance';

describe('Performance', () => {
  let originalHrtime: typeof process.hrtime;
  let originalUptime: typeof process.uptime;
  let originalMemoryUsage: typeof process.memoryUsage;
  let mockHrtime: any;

  beforeEach(() => {
    originalHrtime = process.hrtime;
    originalUptime = process.uptime;
    originalMemoryUsage = process.memoryUsage;

    mockHrtime = {
      bigint: vi.fn(),
    };
    process.hrtime = mockHrtime as any;

    // Clear any existing timers
    Performance['startTimes'] = new Map();
  });

  afterEach(() => {
    process.hrtime = originalHrtime;
    process.uptime = originalUptime;
    process.memoryUsage = originalMemoryUsage;
  });

  describe('now method', () => {
    it('should use hrtime.bigint when available', () => {
      const mockTime = BigInt(1234567890123456); // nanoseconds
      mockHrtime.bigint.mockReturnValue(mockTime);

      const result = Performance.now();

      expect(result).toBe(1234567890.123456); // converted to milliseconds
      expect(mockHrtime.bigint).toHaveBeenCalled();
    });

    it('should fallback to Date.now when hrtime.bigint not available', () => {
      process.hrtime = undefined as any;
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890123);

      const result = Performance.now();

      expect(result).toBe(1234567890123);
      expect(dateSpy).toHaveBeenCalled();

      dateSpy.mockRestore();
    });

    it('should fallback to Date.now when hrtime exists but bigint does not', () => {
      process.hrtime = {} as any;
      const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890123);

      const result = Performance.now();

      expect(result).toBe(1234567890123);
      expect(dateSpy).toHaveBeenCalled();

      dateSpy.mockRestore();
    });
  });

  describe('since method', () => {
    it('should calculate elapsed time correctly', () => {
      const nowSpy = vi.spyOn(Performance, 'now').mockReturnValue(1000);

      const elapsed = Performance.since(500);

      expect(elapsed).toBe(500);
      expect(nowSpy).toHaveBeenCalled();

      nowSpy.mockRestore();
    });

    it('should handle negative elapsed time', () => {
      const nowSpy = vi.spyOn(Performance, 'now').mockReturnValue(100);

      const elapsed = Performance.since(500);

      expect(elapsed).toBe(-400);

      nowSpy.mockRestore();
    });
  });

  describe('named timers', () => {
    describe('start method', () => {
      it('should start a named timer', () => {
        const nowSpy = vi.spyOn(Performance, 'now').mockReturnValue(1000);

        Performance.start('test-timer');

        expect(Performance['startTimes'].get('test-timer')).toBe(1000);
        expect(nowSpy).toHaveBeenCalled();

        nowSpy.mockRestore();
      });

      it('should overwrite existing timer with same name', () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(2000);

        Performance.start('test-timer');
        Performance.start('test-timer');

        expect(Performance['startTimes'].get('test-timer')).toBe(2000);

        nowSpy.mockRestore();
      });
    });

    describe('end method', () => {
      it('should end a named timer and return elapsed time', () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);

        Performance.start('test-timer');
        const elapsed = Performance.end('test-timer');

        expect(elapsed).toBe(500);
        expect(Performance['startTimes'].has('test-timer')).toBe(false);

        nowSpy.mockRestore();
      });

      it('should throw error if timer was not started', () => {
        const [error] = safeRun(() => Performance.end('non-existent-timer'));

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe("Timer 'non-existent-timer' was not started");
      });

      it('should remove timer after ending', () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);

        Performance.start('test-timer');
        Performance.end('test-timer');

        expect(Performance['startTimes'].has('test-timer')).toBe(false);

        nowSpy.mockRestore();
      });
    });
  });

  describe('measure method', () => {
    describe('synchronous functions', () => {
      it('should measure execution time of sync function', () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);

        const testFn = () => 'result';
        const result = Performance.measure(testFn);

        expect(result).toEqual({
          result: 'result',
          duration: 500,
        });

        nowSpy.mockRestore();
      });

      it('should handle functions that throw errors', () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);

        const testFn = () => {
          throw new Error('Test error');
        };

        const [error] = safeRun(() => Performance.measure(testFn));

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('Test error');

        nowSpy.mockRestore();
      });
    });

    describe('asynchronous functions', () => {
      it('should measure execution time of async function', async () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);

        const testFn = async () => {
          await new Promise(resolve => setTimeout(resolve, 0));
          return 'async result';
        };

        const result = await Performance.measure(testFn);

        expect(result).toEqual({
          result: 'async result',
          duration: 500,
        });

        nowSpy.mockRestore();
      });

      it('should handle async functions that throw errors', async () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);

        const testFn = async () => {
          throw new Error('Async error');
        };

        const [error] = await safeRun(async () => await Performance.measure(testFn));

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('Async error');

        nowSpy.mockRestore();
      });
    });
  });

  describe('formatDuration method', () => {
    it('should format microseconds for values less than 1ms', () => {
      expect(Performance.formatDuration(0.5)).toBe('500μs');
      expect(Performance.formatDuration(0.123)).toBe('123μs');
    });

    it('should format milliseconds for values less than 1s', () => {
      expect(Performance.formatDuration(1)).toBe('1.0ms');
      expect(Performance.formatDuration(123.456)).toBe('123.5ms');
      expect(Performance.formatDuration(999.9)).toBe('999.9ms');
    });

    it('should format seconds for values less than 1m', () => {
      expect(Performance.formatDuration(1000)).toBe('1.00s');
      expect(Performance.formatDuration(5432.1)).toBe('5.43s');
      expect(Performance.formatDuration(59999)).toBe('60.00s');
    });

    it('should format minutes and seconds for values >= 1m', () => {
      expect(Performance.formatDuration(60000)).toBe('1m 0.0s');
      expect(Performance.formatDuration(65432)).toBe('1m 5.4s');
      expect(Performance.formatDuration(125000)).toBe('2m 5.0s');
    });

    it('should handle zero duration', () => {
      expect(Performance.formatDuration(0)).toBe('0μs');
    });
  });

  describe('benchmark method', () => {
    it('should benchmark multiple operations', () => {
      const nowSpy = vi
        .spyOn(Performance, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100)
        .mockReturnValueOnce(1100)
        .mockReturnValueOnce(1300);

      const operations = {
        operation1: () => 'result1',
        operation2: () => 'result2',
      };

      const results = Performance.benchmark(operations);

      expect(results).toEqual({
        operation1: 100,
        operation2: 200,
      });

      nowSpy.mockRestore();
    });

    it('should handle operations that throw errors', () => {
      const nowSpy = vi
        .spyOn(Performance, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100);

      const operations = {
        working: () => 'result',
        throwing: () => {
          throw new Error('Test error');
        },
      };

      const [error] = safeRun(() => Performance.benchmark(operations));

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Test error');

      nowSpy.mockRestore();
    });
  });

  describe('getMemoryUsage method', () => {
    it('should return formatted memory usage', () => {
      const mockMemoryUsage = {
        rss: 50 * 1024 * 1024, // 50MB
        heapTotal: 30 * 1024 * 1024, // 30MB
        heapUsed: 20 * 1024 * 1024, // 20MB
        external: 5 * 1024 * 1024, // 5MB
      };

      (process.memoryUsage as any) = vi.fn().mockReturnValue(mockMemoryUsage);

      const result = Performance.getMemoryUsage();

      expect(result).toEqual({
        rss: 50,
        heapTotal: 30,
        heapUsed: 20,
        external: 5,
      });
    });

    it('should handle fractional memory values', () => {
      const mockMemoryUsage = {
        rss: 50.5 * 1024 * 1024,
        heapTotal: 30.7 * 1024 * 1024,
        heapUsed: 20.3 * 1024 * 1024,
        external: 5.1 * 1024 * 1024,
      };

      (process.memoryUsage as any) = vi.fn().mockReturnValue(mockMemoryUsage);

      const result = Performance.getMemoryUsage();

      expect(result.rss).toBe(50.5);
      expect(result.heapTotal).toBe(30.7);
      expect(result.heapUsed).toBe(20.3);
      expect(result.external).toBe(5.1);
    });
  });

  describe('formatMemory method', () => {
    it('should format KB for values less than 1MB', () => {
      expect(Performance.formatMemory(0.5)).toBe('512.0KB');
      expect(Performance.formatMemory(0.123)).toBe('126.0KB');
    });

    it('should format MB for values less than 1GB', () => {
      expect(Performance.formatMemory(1)).toBe('1.0MB');
      expect(Performance.formatMemory(123.45)).toBe('123.5MB');
      expect(Performance.formatMemory(1023.9)).toBe('1023.9MB');
    });

    it('should format GB for values >= 1GB', () => {
      expect(Performance.formatMemory(1024)).toBe('1.00GB');
      expect(Performance.formatMemory(2048.5)).toBe('2.00GB');
    });
  });

  describe('getSummary method', () => {
    it('should return system performance summary', () => {
      const mockMemoryUsage = {
        rss: 50 * 1024 * 1024,
        heapTotal: 30 * 1024 * 1024,
        heapUsed: 20 * 1024 * 1024,
        external: 5 * 1024 * 1024,
      };

      (process.memoryUsage as any) = vi.fn().mockReturnValue(mockMemoryUsage);
      process.uptime = vi.fn().mockReturnValue(3661); // 1 hour, 1 minute, 1 second

      const result = Performance.getSummary();

      expect(result).toEqual({
        uptime: '61m 1.0s',
        memory: '20.0MB / 30.0MB',
        cpu: expect.any(String),
        platform: expect.stringContaining('v'),
      });
    });
  });

  describe('profile method', () => {
    describe('when enabled', () => {
      it('should create profiler with mark functionality', () => {
        const nowSpy = vi.spyOn(Performance, 'now').mockReturnValue(1000);

        const profiler = Performance.profile(true);
        profiler.mark('test-mark');

        expect(nowSpy).toHaveBeenCalled();

        nowSpy.mockRestore();
      });

      it('should create profiler with measure functionality', () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);

        const profiler = Performance.profile(true);
        profiler.mark('start');
        const duration = profiler.measure('test-measure', 'start');

        expect(duration).toBe(500);

        nowSpy.mockRestore();
      });

      it('should throw error when measuring non-existent mark', () => {
        const profiler = Performance.profile(true);

        const [error] = safeRun(() => profiler.measure('test', 'non-existent'));

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe("Mark 'non-existent' not found");
      });

      it('should measure between two marks', () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);

        const profiler = Performance.profile(true);
        profiler.mark('start');
        profiler.mark('end');

        const duration = profiler.measure('test', 'start', 'end');

        expect(duration).toBe(500);

        nowSpy.mockRestore();
      });

      it('should store measurements in entries', () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);

        const profiler = Performance.profile(true);
        profiler.mark('start');
        profiler.measure('test-measure', 'start');

        const entries = profiler.getEntries();

        expect(entries).toEqual([{ name: 'test-measure', duration: 500 }]);

        nowSpy.mockRestore();
      });

      it('should clear marks and measurements', () => {
        const nowSpy = vi
          .spyOn(Performance, 'now')
          .mockReturnValueOnce(1000)
          .mockReturnValueOnce(1500);

        const profiler = Performance.profile(true);
        profiler.mark('start');
        profiler.measure('test-measure', 'start');

        profiler.clear();

        expect(profiler.getEntries()).toEqual([]);

        const [error] = safeRun(() => profiler.measure('test', 'start'));
        expect(error).toBeInstanceOf(Error);

        nowSpy.mockRestore();
      });
    });

    describe('when disabled', () => {
      it('should return no-op profiler', () => {
        const profiler = Performance.profile(false);

        profiler.mark('test');
        const duration = profiler.measure('test', 'start');
        const entries = profiler.getEntries();

        expect(duration).toBe(0);
        expect(entries).toEqual([]);
      });

      it('should default to disabled when no parameter provided', () => {
        const profiler = Performance.profile();

        const duration = profiler.measure('test', 'start');
        expect(duration).toBe(0);
      });
    });
  });
});
