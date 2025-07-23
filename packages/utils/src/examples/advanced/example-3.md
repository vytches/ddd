# Performance-Optimized Utilities

**Version**: 1.0.0 **Package**: @vytches-ddd/utils **Complexity**: advanced
**Domain**: Infrastructure **Patterns**: Performance optimization, memoization,
lazy evaluation, algorithmic efficiency **Dependencies**: @vytches-ddd/utils

## Description

Advanced performance optimization techniques for utility functions including
memoization, lazy evaluation, batch processing, and algorithmic optimizations.
This example demonstrates how to build high-performance utility systems that
maintain functionality while maximizing efficiency.

## Business Context

Performance-critical applications require optimized utilities:

- High-frequency trading systems with microsecond latency requirements
- Real-time analytics processing millions of events per second
- Large-scale batch processing with memory and CPU constraints
- Mobile applications with limited resources
- IoT systems with constrained computing environments

Performance-optimized utilities ensure applications can scale to enterprise
demands while maintaining responsiveness.

## Code Example

```typescript
// performance-optimized-utilities.ts
import { Result, LibUtils } from '@vytches-ddd/utils';
import {
  UserData,
  PerformanceMetrics,
  OptimizationHints,
  MemoizeConfig,
  ThrottleConfig,
  RetryConfig,
} from '../types';

// ✅ FOCUS: High-performance utility implementations
export class PerformanceOptimizedUtilities {
  // 1. Advanced Memoization System
  private memoCache = new Map<
    string,
    { value: any; timestamp: number; hitCount: number }
  >();
  private performanceMetrics = new Map<string, PerformanceMetrics>();

  createMemoizedFunction<T extends (...args: any[]) => any>(
    fn: T,
    config: MemoizeConfig = {
      maxAge: 300000, // 5 minutes
      maxSize: 1000,
      keyGenerator: (...args) => JSON.stringify(args),
    }
  ): T {
    const memoizedFn = ((...args: Parameters<T>): ReturnType<T> => {
      const key = config.keyGenerator?.(...args) || JSON.stringify(args);
      const now = Date.now();

      // Check cache hit
      const cached = this.memoCache.get(key);
      if (cached && now - cached.timestamp < config.maxAge) {
        cached.hitCount++;
        return cached.value;
      }

      // Cache miss - compute value
      const startTime = performance.now();
      const result = fn.apply(this, args);
      const endTime = performance.now();

      // Store in cache
      this.memoCache.set(key, {
        value: result,
        timestamp: now,
        hitCount: 1,
      });

      // Cleanup old entries if cache is too large
      if (this.memoCache.size > config.maxSize) {
        this.evictLeastRecentlyUsed(Math.floor(config.maxSize * 0.1));
      }

      // Track performance metrics
      this.updatePerformanceMetrics(fn.name, endTime - startTime);

      return result;
    }) as T;

    // Add cache management methods
    (memoizedFn as any).clearCache = () => this.memoCache.clear();
    (memoizedFn as any).getCacheStats = () => this.getCacheStats();
    (memoizedFn as any).getCacheSize = () => this.memoCache.size;

    return memoizedFn;
  }

  private evictLeastRecentlyUsed(count: number): void {
    const entries = Array.from(this.memoCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, count);

    entries.forEach(([key]) => this.memoCache.delete(key));
  }

  private getCacheStats(): any {
    const entries = Array.from(this.memoCache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const avgHits = entries.length > 0 ? totalHits / entries.length : 0;

    return {
      size: this.memoCache.size,
      totalHits,
      averageHits: avgHits,
      oldestEntry:
        entries.length > 0 ? Math.min(...entries.map(e => e.timestamp)) : null,
      newestEntry:
        entries.length > 0 ? Math.max(...entries.map(e => e.timestamp)) : null,
    };
  }

  // 2. High-Performance Data Validation
  createOptimizedValidator<T>(
    validationRules: Array<{
      field: keyof T;
      validate: (value: any) => boolean;
      message: string;
      priority: number; // Higher priority rules run first
    }>
  ): (data: T) => Result<T, string[]> {
    // Sort rules by priority for optimal execution order
    const sortedRules = validationRules.sort((a, b) => b.priority - a.priority);

    // Pre-compile validation functions for better performance
    const compiledValidators = sortedRules.map(rule => ({
      ...rule,
      compiledValidate: this.compileValidationFunction(rule.validate),
    }));

    return (data: T): Result<T, string[]> => {
      const errors: string[] = [];
      const startTime = performance.now();

      try {
        // Fast-fail on null/undefined
        if (!data || typeof data !== 'object') {
          return Result.fail(['Invalid data format']);
        }

        // Execute validations in priority order
        for (const rule of compiledValidators) {
          const value = (data as any)[rule.field];

          if (!rule.compiledValidate(value)) {
            errors.push(rule.message);

            // Early termination for critical validation failures
            if (rule.priority >= 100) {
              break;
            }
          }
        }

        const endTime = performance.now();
        this.updatePerformanceMetrics('validation', endTime - startTime);

        return errors.length > 0 ? Result.fail(errors) : Result.ok(data);
      } catch (error) {
        return Result.fail([`Validation error: ${(error as Error).message}`]);
      }
    };
  }

  private compileValidationFunction(
    fn: (value: any) => boolean
  ): (value: any) => boolean {
    // In a real implementation, this could use techniques like:
    // - Function inlining
    // - Bytecode compilation
    // - JIT optimization hints
    // For this example, we'll just return the original function
    return fn;
  }

  // 3. Batch Processing with Optimized Memory Usage
  async processBatchOptimized<TInput, TOutput>(
    items: TInput[],
    processor: (item: TInput) => Promise<TOutput> | TOutput,
    options: {
      batchSize?: number;
      maxConcurrency?: number;
      memoryThreshold?: number; // MB
      progressCallback?: (progress: number) => void;
    } = {}
  ): Promise<Result<TOutput[], Error>> {
    const {
      batchSize = 100,
      maxConcurrency = 3,
      memoryThreshold = 500, // 500MB default
      progressCallback,
    } = options;

    const results: TOutput[] = [];
    const startTime = performance.now();
    let processedCount = 0;

    try {
      // Process in batches to manage memory usage
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        // Check memory usage before processing
        const memoryUsage = this.getMemoryUsage();
        if (memoryUsage.heapUsed > memoryThreshold * 1024 * 1024) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          // Wait a bit for GC to complete
          await LibUtils.sleep(10);
        }

        // Process batch with controlled concurrency
        const batchResults = await this.processConcurrentlyOptimized(
          batch,
          processor,
          maxConcurrency
        );

        results.push(...batchResults);
        processedCount += batch.length;

        // Report progress
        if (progressCallback) {
          const progress = (processedCount / items.length) * 100;
          progressCallback(progress);
        }

        // Small delay between batches to prevent overwhelming the system
        if (i + batchSize < items.length) {
          await LibUtils.sleep(1);
        }
      }

      const endTime = performance.now();
      const metrics: PerformanceMetrics = {
        executionTime: endTime - startTime,
        memoryUsage: this.getMemoryUsage(),
        operationsPerSecond: items.length / ((endTime - startTime) / 1000),
      };

      console.log('Batch processing metrics:', metrics);
      return Result.ok(results);
    } catch (error) {
      return Result.fail(error as Error);
    }
  }

  private async processConcurrentlyOptimized<TInput, TOutput>(
    items: TInput[],
    processor: (item: TInput) => Promise<TOutput> | TOutput,
    maxConcurrency: number
  ): Promise<TOutput[]> {
    const results: TOutput[] = [];
    const semaphore = new Semaphore(maxConcurrency);

    const promises = items.map(async (item, index) => {
      await semaphore.acquire();
      try {
        const result = await processor(item);
        results[index] = result;
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(promises);
    return results;
  }

  private getMemoryUsage(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
  } {
    // In Node.js environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
      };
    }

    // In browser environment (limited info)
    if (typeof window !== 'undefined' && (window as any).performance?.memory) {
      const memory = (window as any).performance.memory;
      return {
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        external: 0,
      };
    }

    // Fallback
    return { heapUsed: 0, heapTotal: 0, external: 0 };
  }

  // 4. Optimized String Processing
  createStringProcessor(): StringProcessor {
    return new StringProcessor();
  }

  // 5. High-Performance Object Comparison
  createOptimizedComparator(): ObjectComparator {
    return new ObjectComparator();
  }

  // 6. Lazy Evaluation System
  createLazyEvaluator<T>(computation: () => T): LazyValue<T> {
    return new LazyValue(computation);
  }

  // 7. Performance Monitoring and Profiling
  private updatePerformanceMetrics(
    operation: string,
    executionTime: number
  ): void {
    const existing = this.performanceMetrics.get(operation) || {
      executionTime: 0,
      memoryUsage: { before: 0, after: 0, delta: 0 },
      operationsPerSecond: 0,
    };

    const newMetrics: PerformanceMetrics = {
      executionTime: (existing.executionTime + executionTime) / 2, // Moving average
      memoryUsage: existing.memoryUsage,
      operationsPerSecond: 1000 / executionTime, // Ops per second for this execution
    };

    this.performanceMetrics.set(operation, newMetrics);
  }

  getPerformanceReport(): Record<string, PerformanceMetrics> {
    return Object.fromEntries(this.performanceMetrics.entries());
  }

  // 8. Resource Pool Management
  createResourcePool<T>(
    factory: () => T,
    options: {
      minSize: number;
      maxSize: number;
      idleTimeout: number;
      validateResource?: (resource: T) => boolean;
    }
  ): ResourcePool<T> {
    return new ResourcePool(factory, options);
  }
}

// High-performance string processing utility
class StringProcessor {
  private cache = new Map<string, any>();

  // Optimized string similarity calculation
  calculateSimilarity(str1: string, str2: string): number {
    const key = `${str1}|${str2}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Use efficient Levenshtein distance algorithm
    const result = this.levenshteinDistance(str1, str2);
    const similarity = 1 - result / Math.max(str1.length, str2.length);

    this.cache.set(key, similarity);
    return similarity;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Use single array instead of 2D matrix for better memory efficiency
    let prev = Array(n + 1)
      .fill(0)
      .map((_, i) => i);
    let curr = Array(n + 1).fill(0);

    for (let i = 1; i <= m; i++) {
      curr[0] = i;

      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          curr[j] = prev[j - 1];
        } else {
          curr[j] = Math.min(
            prev[j] + 1, // deletion
            curr[j - 1] + 1, // insertion
            prev[j - 1] + 1 // substitution
          );
        }
      }

      // Swap arrays
      [prev, curr] = [curr, prev];
    }

    return prev[n];
  }

  // Optimized text tokenization
  tokenize(
    text: string,
    options: { caseSensitive?: boolean; stemming?: boolean } = {}
  ): string[] {
    const key = `${text}|${JSON.stringify(options)}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    let processed = text;

    if (!options.caseSensitive) {
      processed = processed.toLowerCase();
    }

    // Efficient tokenization using regex
    const tokens = processed.match(/\b\w+\b/g) || [];

    if (options.stemming) {
      // Simple stemming - in production would use Porter Stemmer
      tokens.forEach((token, index) => {
        if (token.endsWith('ing')) {
          tokens[index] = token.slice(0, -3);
        } else if (token.endsWith('ed')) {
          tokens[index] = token.slice(0, -2);
        }
      });
    }

    this.cache.set(key, tokens);
    return tokens;
  }
}

// High-performance object comparison
class ObjectComparator {
  private comparisonCache = new WeakMap<object, Map<object, boolean>>();

  deepEqual(obj1: unknown, obj2: unknown): boolean {
    // Fast path for primitives and strict equality
    if (obj1 === obj2) return true;
    if (obj1 === null || obj2 === null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;

    // Check cache
    const obj1Map = this.comparisonCache.get(obj1 as object);
    if (obj1Map?.has(obj2 as object)) {
      return obj1Map.get(obj2 as object)!;
    }

    // Perform deep comparison
    const result = this.performDeepComparison(obj1, obj2);

    // Cache result
    if (!this.comparisonCache.has(obj1 as object)) {
      this.comparisonCache.set(obj1 as object, new Map());
    }
    this.comparisonCache.get(obj1 as object)!.set(obj2 as object, result);

    return result;
  }

  private performDeepComparison(obj1: unknown, obj2: unknown): boolean {
    // Handle arrays
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) return false;
      return obj1.every((item, index) => this.deepEqual(item, obj2[index]));
    }

    // Handle objects
    if (obj1 && obj2 && typeof obj1 === 'object' && typeof obj2 === 'object') {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);

      if (keys1.length !== keys2.length) return false;

      return keys1.every(
        key =>
          keys2.includes(key) &&
          this.deepEqual((obj1 as any)[key], (obj2 as any)[key])
      );
    }

    return false;
  }
}

// Lazy evaluation for expensive computations
class LazyValue<T> {
  private computed = false;
  private value?: T;
  private error?: Error;

  constructor(private computation: () => T) {}

  getValue(): T {
    if (!this.computed) {
      try {
        this.value = this.computation();
        this.computed = true;
      } catch (error) {
        this.error = error as Error;
        this.computed = true;
        throw error;
      }
    }

    if (this.error) {
      throw this.error;
    }

    return this.value!;
  }

  isComputed(): boolean {
    return this.computed;
  }

  reset(): void {
    this.computed = false;
    this.value = undefined;
    this.error = undefined;
  }
}

// Semaphore for concurrency control
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    return new Promise(resolve => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      this.permits--;
      const resolve = this.waiting.shift()!;
      resolve();
    }
  }
}

// Resource pool for expensive-to-create objects
class ResourcePool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();
  private createdCount = 0;

  constructor(
    private factory: () => T,
    private options: {
      minSize: number;
      maxSize: number;
      idleTimeout: number;
      validateResource?: (resource: T) => boolean;
    }
  ) {
    // Initialize with minimum resources
    for (let i = 0; i < options.minSize; i++) {
      this.available.push(this.factory());
      this.createdCount++;
    }
  }

  async acquire(): Promise<T> {
    // Check for available resource
    while (this.available.length > 0) {
      const resource = this.available.pop()!;

      // Validate resource if validator provided
      if (
        this.options.validateResource &&
        !this.options.validateResource(resource)
      ) {
        continue;
      }

      this.inUse.add(resource);
      return resource;
    }

    // Create new resource if under limit
    if (this.createdCount < this.options.maxSize) {
      const resource = this.factory();
      this.createdCount++;
      this.inUse.add(resource);
      return resource;
    }

    // Wait for resource to become available
    return new Promise(resolve => {
      const checkAvailable = () => {
        if (this.available.length > 0) {
          const resource = this.available.pop()!;
          this.inUse.add(resource);
          resolve(resource);
        } else {
          setTimeout(checkAvailable, 10);
        }
      };
      checkAvailable();
    });
  }

  release(resource: T): void {
    if (this.inUse.has(resource)) {
      this.inUse.delete(resource);
      this.available.push(resource);
    }
  }

  getStats(): { available: number; inUse: number; created: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      created: this.createdCount,
    };
  }
}
```

## Key Features

- **Advanced Memoization**: LRU cache eviction, hit rate tracking, configurable
  expiration
- **Optimized Validation**: Priority-based rule execution, early termination,
  compiled validators
- **Batch Processing**: Memory-aware processing, controlled concurrency,
  progress tracking
- **String Processing**: Efficient similarity calculations, optimized
  tokenization
- **Object Comparison**: Cached deep equality, optimized for performance
- **Lazy Evaluation**: Deferred computation, error handling, reset capability
- **Resource Pooling**: Managed resource lifecycle, validation, statistics

## Usage Examples

```typescript
const optimizer = new PerformanceOptimizedUtilities();

// Memoized expensive function
const expensiveCalculation = (x: number, y: number) => {
  // Simulate expensive computation
  let result = 0;
  for (let i = 0; i < 1000000; i++) {
    result += Math.sin(x) * Math.cos(y);
  }
  return result;
};

const memoized = optimizer.createMemoizedFunction(expensiveCalculation, {
  maxAge: 60000, // 1 minute
  maxSize: 500,
});

// First call - computes result
console.time('first-call');
const result1 = memoized(1, 2);
console.timeEnd('first-call');

// Second call - cached result
console.time('second-call');
const result2 = memoized(1, 2);
console.timeEnd('second-call');

// Optimized validator
const userValidator = optimizer.createOptimizedValidator<UserData>([
  {
    field: 'email',
    validate: v => !!v && v.includes('@'),
    message: 'Invalid email',
    priority: 100,
  },
  {
    field: 'name',
    validate: v => !!v && v.length >= 2,
    message: 'Name too short',
    priority: 90,
  },
  {
    field: 'role',
    validate: v => ['user', 'admin'].includes(v),
    message: 'Invalid role',
    priority: 50,
  },
]);

const validationResult = userValidator({
  id: '1',
  email: 'user@example.com',
  name: 'John',
  role: 'user',
  createdAt: new Date(),
});

// Batch processing with memory management
const items = Array.from({ length: 10000 }, (_, i) => ({
  id: i,
  value: Math.random(),
}));

const batchResult = await optimizer.processBatchOptimized(
  items,
  async item => ({ ...item, processed: true }),
  {
    batchSize: 100,
    maxConcurrency: 5,
    memoryThreshold: 200, // 200MB
    progressCallback: progress =>
      console.log(`Progress: ${progress.toFixed(1)}%`),
  }
);

// Performance monitoring
console.log('Performance report:', optimizer.getPerformanceReport());
```

## Performance Optimization Techniques

### **Memoization Strategies**

- **LRU Eviction**: Remove least recently used items when cache is full
- **Time-based Expiration**: Invalidate entries after specified duration
- **Hit Rate Tracking**: Monitor cache effectiveness

### **Batch Processing**

- **Memory Monitoring**: Track heap usage and trigger cleanup
- **Controlled Concurrency**: Limit parallel operations to prevent overload
- **Progressive Processing**: Process in chunks to maintain responsiveness

### **Algorithmic Optimizations**

- **Space-Time Tradeoffs**: Use more memory to reduce computation time
- **Early Termination**: Stop processing when conditions are met
- **Vectorized Operations**: Process multiple items simultaneously

### **Resource Management**

- **Object Pooling**: Reuse expensive-to-create objects
- **Lazy Loading**: Defer computation until needed
- **Resource Validation**: Ensure pooled resources are still valid

## Performance Metrics

Monitor these key performance indicators:

- **Execution Time**: Average operation duration
- **Memory Usage**: Heap utilization patterns
- **Cache Hit Ratio**: Memoization effectiveness
- **Throughput**: Operations per second
- **Resource Utilization**: CPU and memory efficiency

## Best Practices

- **Profile Before Optimizing**: Measure performance bottlenecks first
- **Optimize Hot Paths**: Focus on frequently executed code
- **Balance Memory vs Speed**: Consider tradeoffs for your use case
- **Monitor in Production**: Track performance metrics continuously
- **Test at Scale**: Validate optimizations with realistic data volumes

## Common Pitfalls

- **Premature Optimization**: Don't optimize without profiling
- **Memory Leaks**: Ensure caches and pools clean up properly
- **Over-Caching**: Too much caching can hurt performance
- **Ignoring Concurrency**: Consider thread safety in concurrent environments

## Related Examples

- [Monadic Operations](./example-1.md)
- [Railway-Oriented Programming](./example-2.md)
- [Async Result Patterns](../intermediate/example-2.md)
