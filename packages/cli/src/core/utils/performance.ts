/**
 * @fileoverview Performance - High-precision timing utilities
 * Minimal implementation for performance tracking without external dependencies
 */

/**
 * @llm-summary Performance class for performance operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * Performance class implementing infrastructure service for performance operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new Performance();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class Performance {
  private static startTimes = new Map<string, number>();

  /**
   * Get high-precision timestamp in milliseconds
   */
  static now(): number {
    // Use process.hrtime.bigint() for nanosecond precision, convert to milliseconds
    if (process.hrtime && process.hrtime.bigint) {
      return Number(process.hrtime.bigint()) / 1_000_000;
    }

    // Fallback to Date.now() (millisecond precision)
    return Date.now();
  }

  /**
   * Calculate time elapsed since a start time
   */
  static since(startTime: number): number {
    return this.now() - startTime;
  }

  /**
   * Start a named timer
   */
  static start(name: string): void {
    this.startTimes.set(name, this.now());
  }

  /**
   * End a named timer and return elapsed time
   */
  static end(name: string): number {
    const startTime = this.startTimes.get(name);
    if (!startTime) {
      throw new Error(`Timer '${name}' was not started`);
    }

    const elapsed = this.since(startTime);
    this.startTimes.delete(name);
    return elapsed;
  }

  /**
   * Measure the execution time of a function
   */
  static async measure<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }>;
  static measure<T>(fn: () => T): { result: T; duration: number };
  static measure<T>(
    fn: () => T | Promise<T>
  ): { result: T; duration: number } | Promise<{ result: T; duration: number }> {
    const startTime = this.now();
    const result = fn();

    if (result instanceof Promise) {
      return result.then(res => ({
        result: res,
        duration: this.since(startTime),
      }));
    }

    return {
      result,
      duration: this.since(startTime),
    };
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(milliseconds: number): string {
    if (milliseconds < 1) {
      return `${(milliseconds * 1000).toFixed(0)}μs`;
    }

    if (milliseconds < 1000) {
      return `${milliseconds.toFixed(1)}ms`;
    }

    if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(2)}s`;
    }

    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Create a performance benchmark for multiple operations
   */
  static benchmark(operations: Record<string, () => any>): Record<string, number> {
    const results: Record<string, number> = {};

    Object.entries(operations).forEach(([name, operation]) => {
      const { duration } = this.measure(operation);
      results[name] = duration;
    });

    return results;
  }

  /**
   * Memory usage information
   */
  static getMemoryUsage(): {
    rss: number; // Resident Set Size
    heapTotal: number; // Total heap allocated
    heapUsed: number; // Heap actually used
    external: number; // External memory
  } {
    const usage = process.memoryUsage();
    return {
      rss: Math.round((usage.rss / 1024 / 1024) * 100) / 100,
      heapTotal: Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100,
      heapUsed: Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100,
      external: Math.round((usage.external / 1024 / 1024) * 100) / 100,
    };
  }

  /**
   * Format memory usage in human-readable format
   */
  static formatMemory(megabytes: number): string {
    if (megabytes < 1) {
      return `${(megabytes * 1024).toFixed(1)}KB`;
    }

    if (megabytes < 1024) {
      return `${megabytes.toFixed(1)}MB`;
    }

    return `${(megabytes / 1024).toFixed(2)}GB`;
  }

  /**
   * Get system performance summary
   */
  static getSummary(): {
    uptime: string;
    memory: string;
    cpu: string;
    platform: string;
  } {
    const memory = this.getMemoryUsage();
    const uptime = process.uptime();

    return {
      uptime: this.formatDuration(uptime * 1000),
      memory: `${this.formatMemory(memory.heapUsed)} / ${this.formatMemory(memory.heapTotal)}`,
      cpu: `${process.arch}`,
      platform: `${process.platform} ${process.version}`,
    };
  }

  /**
   * Simple performance profiler for development
   */
  static profile(enabled = false): {
    mark: (label: string) => void;
    measure: (name: string, startMark: string, endMark?: string) => number;
    getEntries: () => Array<{ name: string; duration: number }>;
    clear: () => void;
  } {
    if (!enabled) {
      // No-op implementation when profiling is disabled
      return {
        mark: () => {
          return;
        },
        measure: () => 0,
        getEntries: () => [],
        clear: () => {
          return;
        },
      };
    }

    const marks = new Map<string, number>();
    const measurements: Array<{ name: string; duration: number }> = [];

    return {
      mark: (label: string) => {
        marks.set(label, this.now());
      },

      measure: (name: string, startMark: string, endMark?: string) => {
        const startTime = marks.get(startMark);
        if (!startTime) {
          throw new Error(`Mark '${startMark}' not found`);
        }

        const endTime = endMark ? marks.get(endMark) : this.now();
        if (endMark && !endTime) {
          throw new Error(`Mark '${endMark}' not found`);
        }

        const duration = (endTime || this.now()) - startTime;
        measurements.push({ name, duration });
        return duration;
      },

      getEntries: () => [...measurements],

      clear: () => {
        marks.clear();
        measurements.length = 0;
      },
    };
  }
}
