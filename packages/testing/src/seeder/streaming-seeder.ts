/**
 * Streaming-first architecture for generating millions of aggregates efficiently
 * with memory management, backpressure handling, and configurable batch processing.
 * Designed for performance testing and large-scale data generation scenarios.
 */

import { Result } from '@vytches/ddd-utils';
import { AggregateSeeder, type AggregateSeederConfig } from './aggregate-seeder.js';
import type {
  DomainSeederConfig,
  IStreamingSeeder,
  SeederResult,
  SeedableAggregate,
} from './domain-seeder.js';
import { EventEmitter } from 'events';

/**
 * Configuration for streaming behavior and performance tuning
 */
export interface StreamingConfig {
  /** Batch size for each generation cycle */
  batchSize?: number;

  /** Enable backpressure handling */
  enableBackpressure?: boolean;

  /** High water mark for backpressure (items in memory) */
  highWaterMark?: number;

  /** Enable progress tracking and metrics */
  enableProgressTracking?: boolean;

  /** Progress reporting interval (number of items) */
  progressInterval?: number;

  /** Maximum concurrent batch processing */
  maxConcurrency?: number;

  /** Enable memory monitoring and garbage collection hints */
  enableMemoryManagement?: boolean;

  /** Memory limit in MB before forcing GC */
  memoryLimit?: number;

  /** Delay between batches in milliseconds (for throttling) */
  batchDelay?: number;

  /** Enable detailed performance metrics */
  enableMetrics?: boolean;
}

/**
 * Progress information for streaming operations
 */
export interface StreamingProgress {
  /** Number of items completed */
  completed: number;

  /** Total items to process */
  total: number;

  /** Current processing rate (items per second) */
  rate: number;

  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining: number;

  /** Current memory usage in MB */
  memoryUsage?: number;

  /** Number of errors encountered */
  errorCount: number;

  /** Current batch being processed */
  currentBatch: number;

  /** Total number of batches */
  totalBatches: number;
}

/**
 * Performance metrics for streaming operations
 */
export interface StreamingMetrics {
  /** Total items processed */
  totalItems: number;

  /** Total processing time in milliseconds */
  totalTime: number;

  /** Average items per second */
  averageRate: number;

  /** Peak items per second */
  peakRate: number;

  /** Memory usage statistics */
  memoryStats: {
    peak: number;
    average: number;
    current: number;
  };

  /** Error statistics */
  errorStats: {
    total: number;
    byType: Map<string, number>;
    failureRate: number;
  };

  /** Batch processing statistics */
  batchStats: {
    totalBatches: number;
    averageBatchTime: number;
    slowestBatch: number;
    fastestBatch: number;
  };
}

/**
 * Streaming seeder implementation with high-performance architecture.
 *
 * This seeder is specifically designed for large-scale data generation
 * scenarios where memory efficiency and performance are critical.
 * It provides streaming interfaces that can handle millions of records
 * without overwhelming system resources.
 *
 * The architecture includes:
 * - Lazy evaluation with generator functions
 * - Configurable batch processing
 * - Memory management with garbage collection hints
 * - Backpressure handling to prevent resource exhaustion
 * - Comprehensive metrics and progress tracking
 * - Error recovery with partial failure tolerance
 */
export class StreamingSeeder<T extends SeedableAggregate>
  extends EventEmitter
  implements IStreamingSeeder<T>
{
  private readonly aggregateSeeder: AggregateSeeder<T>;
  private readonly config: StreamingConfig;
  private metrics: Partial<StreamingMetrics> = {};
  private isStreaming = false;
  private shouldStop = false;

  /**
   * Creates a new StreamingSeeder instance.
   *
   * @param AggregateClass Constructor for the aggregate type
   * @param globalConfig Global seeder configuration
   * @param streamingConfig Streaming-specific configuration
   */
  constructor(
    AggregateClass: new (...args: any[]) => T,
    globalConfig: DomainSeederConfig = {},
    streamingConfig: StreamingConfig = {}
  ) {
    super();

    this.config = {
      batchSize: globalConfig.defaultBatchSize ?? 1000,
      enableBackpressure: true,
      highWaterMark: 10000,
      enableProgressTracking: true,
      progressInterval: 1000,
      maxConcurrency: 3,
      enableMemoryManagement: true,
      memoryLimit: globalConfig.memoryLimit ?? 500, // 500MB default
      batchDelay: 0,
      enableMetrics: globalConfig.enableMetrics ?? true,
      ...streamingConfig,
    };

    this.aggregateSeeder = new AggregateSeeder(AggregateClass, globalConfig);

    // Initialize metrics
    this.resetMetrics();
  }

  /**
   * Configures batch processing parameters.
   *
   * @param size Batch size for each generation cycle
   * @returns StreamingSeeder instance for method chaining
   */
  withBatchSize(size: number): this {
    this.config.batchSize = size;
    return this;
  }

  /**
   * Configures backpressure handling.
   *
   * @param config Backpressure configuration
   * @returns StreamingSeeder instance for method chaining
   */
  withBackpressure(config: { highWaterMark: number }): this {
    this.config.enableBackpressure = true;
    this.config.highWaterMark = config.highWaterMark;
    return this;
  }

  /**
   * Configures progress tracking.
   *
   * @param enabled Whether to enable progress tracking
   * @param interval Optional interval for progress reports
   * @returns StreamingSeeder instance for method chaining
   */
  withProgressTracking(enabled: boolean, interval?: number): this {
    this.config.enableProgressTracking = enabled;
    if (interval) {
      this.config.progressInterval = interval;
    }
    return this;
  }

  /**
   * Configures memory management settings.
   *
   * @param limit Memory limit in MB
   * @param enableGC Whether to enable garbage collection hints
   * @returns StreamingSeeder instance for method chaining
   */
  withMemoryManagement(limit: number, enableGC = true): this {
    this.config.memoryLimit = limit;
    this.config.enableMemoryManagement = enableGC;
    return this;
  }

  /**
   * Configures concurrency settings.
   *
   * @param maxConcurrency Maximum concurrent batch processing
   * @returns StreamingSeeder instance for method chaining
   */
  withConcurrency(maxConcurrency: number): this {
    this.config.maxConcurrency = maxConcurrency;
    return this;
  }

  /**
   * Creates a streaming iterator for large-scale aggregate generation.
   *
   * @param count Total number of aggregates to generate
   * @param batchSize Optional batch size override
   * @returns Async iterable of aggregate results
   */
  async *stream(
    count: number,
    batchSize: number = this.config.batchSize!
  ): AsyncIterable<SeederResult<T>> {
    this.isStreaming = true;
    this.shouldStop = false;

    const startTime = Date.now();
    let completed = 0;
    let batchNumber = 0;
    const totalBatches = Math.ceil(count / batchSize);

    // Initialize metrics
    this.metrics = {
      totalItems: 0,
      totalTime: 0,
      memoryStats: { peak: 0, average: 0, current: 0 },
      errorStats: { total: 0, byType: new Map(), failureRate: 0 },
      batchStats: {
        totalBatches,
        averageBatchTime: 0,
        slowestBatch: 0,
        fastestBatch: Number.MAX_SAFE_INTEGER,
      },
    };

    // Emit streaming start event
    this.emit('start', { total: count, batchSize, totalBatches });

    try {
      while (completed < count && !this.shouldStop) {
        batchNumber++;
        const batchStartTime = Date.now();
        const currentBatchSize = Math.min(batchSize, count - completed);

        // Check memory usage before processing batch
        if (this.config.enableMemoryManagement) {
          const memoryUsage = this.getCurrentMemoryUsage();
          if (memoryUsage > this.config.memoryLimit!) {
            this.triggerGarbageCollection();
            await this.delay(10); // Brief pause for GC
          }
        }

        // Check backpressure
        if (this.config.enableBackpressure) {
          await this.waitForBackpressureRelief();
        }

        // Generate batch
        try {
          const batchResult = await this.aggregateSeeder.buildMany(currentBatchSize, index => ({
            _streamBatch: batchNumber,
            _streamIndex: completed + index,
            _streamTotal: count,
          }));

          const batchEndTime = Date.now();
          const batchTime = batchEndTime - batchStartTime;

          // Update batch statistics
          this.updateBatchStats(batchTime);

          if (batchResult.isSuccess) {
            // Yield individual items from the batch
            for (const aggregate of batchResult.value) {
              yield Result.ok(aggregate);
              completed++;

              // Report progress
              if (
                this.config.enableProgressTracking &&
                completed % this.config.progressInterval! === 0
              ) {
                await this.reportProgress(completed, count, startTime);
              }
            }
          } else {
            // Handle batch failure
            this.handleBatchError(batchResult.error, batchNumber);

            // Yield error result
            yield Result.fail(
              new Error(`Batch ${batchNumber} failed: ${batchResult.error.message}`)
            );
          }
        } catch (error) {
          // Handle unexpected batch error
          const batchError = error instanceof Error ? error : new Error(String(error));
          this.handleBatchError(batchError, batchNumber);

          yield Result.fail(new Error(`Batch ${batchNumber} error: ${batchError.message}`));
        }

        // Optional delay between batches for throttling
        if (this.config.batchDelay && this.config.batchDelay > 0) {
          await this.delay(this.config.batchDelay);
        }
      }
    } finally {
      this.isStreaming = false;

      // Finalize metrics
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      if (this.metrics.totalTime !== undefined) {
        this.metrics.totalTime = totalTime;
      }
      if (this.metrics.totalItems !== undefined) {
        this.metrics.totalItems = completed;
      }
      if (this.metrics.averageRate !== undefined) {
        this.metrics.averageRate = completed / (totalTime / 1000);
      }

      // Emit completion event
      this.emit('complete', {
        completed,
        total: count,
        totalTime,
        metrics: this.getMetrics(),
      });
    }
  }

  /**
   * Implements the ISeeder interface for single item generation.
   * Note: This delegates to the underlying AggregateSeeder.
   */
  async build(): Promise<SeederResult<T>> {
    return await this.aggregateSeeder.build();
  }

  /**
   * Implements the ISeeder interface for multiple item generation.
   * Note: For large counts, prefer using the stream() method.
   */
  async buildMany(count: number): Promise<SeederResult<T[]>> {
    if (count > 10000) {
      console.warn(
        `buildMany() called with ${count} items. Consider using stream() for better performance.`
      );
    }
    return await this.aggregateSeeder.buildMany(count);
  }

  /**
   * Stops the streaming process gracefully.
   */
  stop(): void {
    this.shouldStop = true;
    this.emit('stop');
  }

  /**
   * Gets current streaming metrics.
   *
   * @returns Current metrics object
   */
  getMetrics(): Readonly<StreamingMetrics> {
    return { ...this.metrics } as StreamingMetrics;
  }

  /**
   * Resets streaming metrics.
   */
  resetMetrics(): void {
    this.metrics = {
      totalItems: 0,
      totalTime: 0,
      averageRate: 0,
      peakRate: 0,
      memoryStats: { peak: 0, average: 0, current: 0 },
      errorStats: { total: 0, byType: new Map(), failureRate: 0 },
      batchStats: {
        totalBatches: 0,
        averageBatchTime: 0,
        slowestBatch: 0,
        fastestBatch: Number.MAX_SAFE_INTEGER,
      },
    };
  }

  /**
   * Checks if streaming is currently active.
   *
   * @returns True if streaming is in progress
   */
  isActive(): boolean {
    return this.isStreaming;
  }

  /**
   * Gets streaming configuration.
   *
   * @returns Current streaming configuration
   */
  getConfig(): Readonly<StreamingConfig> {
    return { ...this.config };
  }

  /**
   * Reports progress to listeners.
   */
  private async reportProgress(completed: number, total: number, startTime: number): Promise<void> {
    const currentTime = Date.now();
    const elapsedTime = currentTime - startTime;
    const rate = completed / (elapsedTime / 1000);
    const estimatedTimeRemaining = ((total - completed) / rate) * 1000;
    const memoryUsage = this.getCurrentMemoryUsage();

    const progress: StreamingProgress = {
      completed,
      total,
      rate,
      estimatedTimeRemaining,
      memoryUsage,
      errorCount: this.metrics.errorStats?.total ?? 0,
      currentBatch: Math.ceil(completed / this.config.batchSize!),
      totalBatches: Math.ceil(total / this.config.batchSize!),
    };

    // Update peak rate
    if (this.metrics.peakRate !== undefined && rate > this.metrics.peakRate) {
      this.metrics.peakRate = rate;
    }

    this.emit('progress', progress);
  }

  /**
   * Handles batch processing errors.
   */
  private handleBatchError(error: Error, batchNumber: number): void {
    if (this.metrics.errorStats) {
      this.metrics.errorStats.total++;

      const errorType = error.constructor.name;
      const currentCount = this.metrics.errorStats.byType.get(errorType) ?? 0;
      this.metrics.errorStats.byType.set(errorType, currentCount + 1);
    }

    this.emit('batchError', { error, batchNumber });
  }

  /**
   * Updates batch processing statistics.
   */
  private updateBatchStats(batchTime: number): void {
    if (this.metrics.batchStats) {
      const stats = this.metrics.batchStats;

      // Update averages (simplified - in real implementation would use running average)
      const totalBatches = stats.totalBatches;
      stats.averageBatchTime =
        (stats.averageBatchTime * totalBatches + batchTime) / (totalBatches + 1);

      // Update extremes
      if (batchTime > stats.slowestBatch) {
        stats.slowestBatch = batchTime;
      }
      if (batchTime < stats.fastestBatch) {
        stats.fastestBatch = batchTime;
      }
    }
  }

  /**
   * Gets current memory usage in MB.
   */
  private getCurrentMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      return Math.round(memoryUsage.heapUsed / 1024 / 1024);
    }
    return 0; // Fallback for non-Node environments
  }

  /**
   * Triggers garbage collection if available.
   */
  private triggerGarbageCollection(): void {
    if (typeof global !== 'undefined' && global.gc) {
      try {
        global.gc();
      } catch (error) {
        // GC not available, ignore
      }
    }
  }

  /**
   * Waits for backpressure relief.
   */
  private async waitForBackpressureRelief(): Promise<void> {
    const memoryUsage = this.getCurrentMemoryUsage();
    const watermark = (this.config.highWaterMark! / 1000) * 0.8; // 80% of high water mark in MB

    if (memoryUsage > watermark) {
      this.emit('backpressure', { memoryUsage, watermark });

      // Wait for memory to reduce
      while (this.getCurrentMemoryUsage() > watermark * 0.7) {
        // Wait until 70% of watermark
        await this.delay(100);
        if (this.shouldStop) break;
      }
    }
  }

  /**
   * Simple delay utility.
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
