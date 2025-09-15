/**
 * VP-012: Realistic Testing Helpers
 * ZERO TOLERANCE for performance theater - only real operations
 */

import type { HandlerInfo, IHandlerDiscoveryPlugin } from '../../src';
import { safeRun } from '@vytches/ddd-utils';

/**
 * Real business handler with actual CPU and memory workload
 * NOT a mock - this performs real work to test performance
 */
export class RealBusinessHandler {
  private readonly data: number[];
  private readonly metadata: Record<string, any>;

  constructor(
    private readonly id: string,
    private readonly config: { size?: number } = {}
  ) {
    // Realistic memory usage - each handler uses configurable memory
    const size = config.size || 250;
    this.data = Array.from({ length: size }, (_, i) => Math.random() * i);
    this.metadata = {
      id: this.id,
      created: Date.now(),
      version: '1.0.0',
      tags: ['realistic', 'enterprise', 'business'],
      config: { ...config },
    };
  }

  async handle(payload: any): Promise<any> {
    // REAL CPU WORK: Actual data processing
    const processed = this.data
      .map((x, i) => x * (payload.factor || 1) + i * 0.001)
      .filter(x => x > 0.5)
      .sort((a, b) => a - b)
      .slice(0, Math.min(100, this.data.length));

    // Realistic async operation (not setTimeout)
    await new Promise(resolve => {
      // Simulate realistic I/O work
      const work = () => {
        const result = JSON.stringify(this.metadata).length > 0;
        if (result) resolve(undefined);
      };
      setImmediate(work);
    });

    return {
      handlerId: this.id,
      processed: processed.length,
      checksum: processed.reduce((sum, val) => sum + val, 0),
      timestamp: Date.now(),
      metadata: this.metadata,
    };
  }

  dispose(): void {
    // Proper cleanup for memory testing
    (this.data as any).length = 0;
    Object.keys(this.metadata).forEach(key => delete this.metadata[key]);
  }

  getMemoryFootprint(): number {
    // Calculate approximate memory usage
    return this.data.length * 8 + JSON.stringify(this.metadata).length;
  }
}

/**
 * Performance timing utilities for realistic measurements
 */
export class PerformanceTimer {
  private measurements = new Map<string, number>();

  start(operation: string): void {
    this.measurements.set(operation, performance.now());
  }

  end(operation: string): number {
    const startTime = this.measurements.get(operation);
    if (!startTime) {
      throw new Error(`No measurement started for operation: ${operation}`);
    }

    const duration = performance.now() - startTime;
    this.measurements.delete(operation);
    return duration;
  }

  measure<T>(operation: string, fn: () => T): T;
  measure<T>(operation: string, fn: () => Promise<T>): Promise<T>;
  measure<T>(operation: string, fn: () => T | Promise<T>): T | Promise<T> {
    this.start(operation);

    try {
      const result = fn();

      if (result instanceof Promise) {
        return result.finally(() => {
          const duration = this.end(operation);
          console.log(`⏱️  ${operation}: ${duration.toFixed(2)}ms`);
        });
      } else {
        const duration = this.end(operation);
        console.log(`⏱️  ${operation}: ${duration.toFixed(2)}ms`);
        return result;
      }
    } catch (error) {
      this.end(operation); // Clean up measurement
      throw error;
    }
  }
}
