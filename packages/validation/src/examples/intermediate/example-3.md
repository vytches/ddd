# Batch Validation with Performance Optimization

**Version**: 1.0.0
**Package**: @vytches-ddd/validation
**Complexity**: Intermediate
**Domain**: Data Processing
**Patterns**: Batch Processing, Performance Optimization, Parallel Validation, Caching Strategies
**Dependencies**: @vytches-ddd/validation, @vytches-ddd/utils, @vytches-ddd/core

## Description

This example demonstrates high-performance batch validation with advanced optimization techniques including parallel processing, intelligent caching, result streaming, and memory-efficient processing for large datasets.

## Business Context

Enterprise data processing systems often need to validate millions of records efficiently. A financial services company processing 10M transactions daily needs validation to complete within 30-minute processing windows. Poor validation performance can delay critical business processes, cause SLA violations, and impact customer experience.

## Code Example

```typescript
// batch-validation-optimizer.ts
import { 
  IValidator,
  ValidationResult,
  BatchValidationRequest,
  BatchValidationResult,
  ValidationMetrics 
} from '@vytches-ddd/validation';
import { Result } from '@vytches-ddd/utils';
import { EventEmitter } from 'events';

// Performance optimization configuration
interface BatchOptimizationConfig {
  batchSize: number;
  maxConcurrency: number;
  enableCaching: boolean;
  cacheSize: number;
  cacheTtl: number;
  enableStreaming: boolean;
  memoryThreshold: number;
  enableProgressTracking: boolean;
}

// Validation cache entry
interface CacheEntry {
  result: ValidationResult;
  timestamp: number;
  hitCount: number;
}

// Progress tracking interface
interface ValidationProgress {
  total: number;
  processed: number;
  valid: number;
  invalid: number;
  percentage: number;
  estimatedTimeRemaining: number;
  currentBatchSize: number;
  throughput: number; // items per second
}

// High-performance batch validator
export class BatchValidationOptimizer<T> extends EventEmitter {
  private config: BatchOptimizationConfig;
  private validationCache: Map<string, CacheEntry>;
  private processingQueue: Array<{ entity: T; index: number }>;
  private results: Map<number, ValidationResult>;
  private metrics: ValidationMetrics;

  constructor(
    private validator: IValidator<T>,
    config?: Partial<BatchOptimizationConfig>
  ) {
    super();
    
    this.config = {
      batchSize: 1000,
      maxConcurrency: 4,
      enableCaching: true,
      cacheSize: 10000,
      cacheTtl: 3600000, // 1 hour
      enableStreaming: true,
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      enableProgressTracking: true,
      ...config
    };

    this.validationCache = new Map();
    this.processingQueue = [];
    this.results = new Map();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      averageValidationTime: 0,
      slowestValidations: [],
      mostFailedRules: [],
      periodStart: new Date(),
      periodEnd: new Date()
    };
  }

  async validateBatch<TEntity extends T>(
    request: BatchValidationRequest<TEntity>
  ): Promise<BatchValidationResult<TEntity>> {
    const startTime = Date.now();
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Initialize progress tracking
      if (this.config.enableProgressTracking) {
        this.initializeProgressTracking(request.entities.length);
      }

      // Determine optimal processing strategy
      const strategy = this.determineProcessingStrategy(request);
      
      let result: BatchValidationResult<TEntity>;

      switch (strategy) {
        case 'memory-efficient':
          result = await this.processMemoryEfficient(request, batchId);
          break;
        case 'parallel':
          result = await this.processParallel(request, batchId);
          break;
        case 'streaming':
          result = await this.processStreaming(request, batchId);
          break;
        default:
          result = await this.processStandard(request, batchId);
      }

      // Update metrics
      this.updateMetrics(result, Date.now() - startTime);

      // Cleanup cache if needed
      if (this.config.enableCaching) {
        this.cleanupCache();
      }

      return result;

    } catch (error) {
      this.emit('error', { batchId, error, timestamp: new Date() });
      throw error;
    }
  }

  private determineProcessingStrategy(request: BatchValidationRequest<any>): string {
    const entityCount = request.entities.length;
    const estimatedMemoryUsage = entityCount * 1024; // Rough estimate

    if (estimatedMemoryUsage > this.config.memoryThreshold) {
      return 'memory-efficient';
    }

    if (entityCount > 10000 && this.config.maxConcurrency > 1) {
      return 'parallel';
    }

    if (this.config.enableStreaming && entityCount > 5000) {
      return 'streaming';
    }

    return 'standard';
  }

  private async processParallel<TEntity extends T>(
    request: BatchValidationRequest<TEntity>,
    batchId: string
  ): Promise<BatchValidationResult<TEntity>> {
    const { entities, context, batchSize, parallelProcessing } = request;
    const chunks = this.chunkArray(entities, batchSize || this.config.batchSize);
    const concurrency = parallelProcessing ? this.config.maxConcurrency : 1;
    
    const results: ValidationResult[] = [];
    const validEntities: TEntity[] = [];
    const invalidEntities: Array<{ entity: TEntity; errors: ValidationError[] }> = [];

    // Process chunks in parallel with concurrency limit
    const processChunk = async (chunk: TEntity[], startIndex: number): Promise<void> => {
      const chunkPromises = chunk.map(async (entity, index) => {
        const globalIndex = startIndex + index;
        const cacheKey = this.generateCacheKey(entity);
        
        // Check cache first
        if (this.config.enableCaching) {
          const cachedResult = this.getCachedResult(cacheKey);
          if (cachedResult) {
            this.updateProgress(globalIndex, cachedResult);
            return cachedResult;
          }
        }

        // Validate entity
        const result = await this.validator.validate(entity, context);
        
        // Cache result
        if (this.config.enableCaching) {
          this.cacheResult(cacheKey, result);
        }

        this.updateProgress(globalIndex, result);
        return result;
      });

      const chunkResults = await Promise.all(chunkPromises);
      
      // Categorize results
      chunkResults.forEach((result, index) => {
        const entity = chunk[index];
        results.push(result);
        
        if (result.isValid) {
          validEntities.push(entity);
        } else {
          invalidEntities.push({ entity, errors: result.errors });
        }
      });
    };

    // Execute chunks with concurrency control
    const chunksWithIndex = chunks.map((chunk, i) => ({ 
      chunk, 
      startIndex: i * (batchSize || this.config.batchSize) 
    }));

    const semaphore = new Semaphore(concurrency);
    const processingPromises = chunksWithIndex.map(({ chunk, startIndex }) =>
      semaphore.acquire().then(async (release) => {
        try {
          await processChunk(chunk, startIndex);
        } finally {
          release();
        }
      })
    );

    await Promise.all(processingPromises);

    return this.buildBatchResult(
      batchId,
      entities,
      validEntities,
      invalidEntities,
      results
    );
  }

  private async processMemoryEfficient<TEntity extends T>(
    request: BatchValidationRequest<TEntity>,
    batchId: string
  ): Promise<BatchValidationResult<TEntity>> {
    const { entities, context } = request;
    const chunkSize = Math.min(this.config.batchSize, 100); // Smaller chunks for memory efficiency
    
    const validEntities: TEntity[] = [];
    const invalidEntities: Array<{ entity: TEntity; errors: ValidationError[] }> = [];
    const results: ValidationResult[] = [];

    // Process in small chunks to minimize memory usage
    for (let i = 0; i < entities.length; i += chunkSize) {
      const chunk = entities.slice(i, i + chunkSize);
      
      for (const [index, entity] of chunk.entries()) {
        const globalIndex = i + index;
        const cacheKey = this.generateCacheKey(entity);
        
        // Check cache
        let result: ValidationResult;
        if (this.config.enableCaching) {
          const cachedResult = this.getCachedResult(cacheKey);
          if (cachedResult) {
            result = cachedResult;
          } else {
            result = await this.validator.validate(entity, context);
            this.cacheResult(cacheKey, result);
          }
        } else {
          result = await this.validator.validate(entity, context);
        }

        results.push(result);
        
        if (result.isValid) {
          validEntities.push(entity);
        } else {
          invalidEntities.push({ entity, errors: result.errors });
        }

        this.updateProgress(globalIndex, result);
      }

      // Force garbage collection hint between chunks
      if (global.gc) {
        global.gc();
      }
    }

    return this.buildBatchResult(
      batchId,
      entities,
      validEntities,
      invalidEntities,
      results
    );
  }

  private async processStreaming<TEntity extends T>(
    request: BatchValidationRequest<TEntity>,
    batchId: string
  ): Promise<BatchValidationResult<TEntity>> {
    const { entities, context } = request;
    
    const validEntities: TEntity[] = [];
    const invalidEntities: Array<{ entity: TEntity; errors: ValidationError[] }> = [];
    const results: ValidationResult[] = [];

    // Create readable stream for entities
    const entityStream = this.createEntityStream(entities);
    
    return new Promise((resolve, reject) => {
      let processed = 0;
      
      entityStream.on('data', async (entity: TEntity) => {
        try {
          const cacheKey = this.generateCacheKey(entity);
          
          // Check cache
          let result: ValidationResult;
          if (this.config.enableCaching) {
            const cachedResult = this.getCachedResult(cacheKey);
            if (cachedResult) {
              result = cachedResult;
            } else {
              result = await this.validator.validate(entity, context);
              this.cacheResult(cacheKey, result);
            }
          } else {
            result = await this.validator.validate(entity, context);
          }

          results.push(result);
          
          if (result.isValid) {
            validEntities.push(entity);
          } else {
            invalidEntities.push({ entity, errors: result.errors });
          }

          this.updateProgress(processed, result);
          processed++;

          // Emit progress events for streaming
          this.emit('validationComplete', {
            entity,
            result,
            processed,
            total: entities.length
          });

        } catch (error) {
          reject(error);
        }
      });

      entityStream.on('end', () => {
        const batchResult = this.buildBatchResult(
          batchId,
          entities,
          validEntities,
          invalidEntities,
          results
        );
        resolve(batchResult);
      });

      entityStream.on('error', reject);
    });
  }

  private async processStandard<TEntity extends T>(
    request: BatchValidationRequest<TEntity>,
    batchId: string
  ): Promise<BatchValidationResult<TEntity>> {
    const { entities, context } = request;
    
    const validationPromises = entities.map(async (entity, index) => {
      const cacheKey = this.generateCacheKey(entity);
      
      // Check cache
      if (this.config.enableCaching) {
        const cachedResult = this.getCachedResult(cacheKey);
        if (cachedResult) {
          this.updateProgress(index, cachedResult);
          return { entity, result: cachedResult, index };
        }
      }

      // Validate entity
      const result = await this.validator.validate(entity, context);
      
      // Cache result
      if (this.config.enableCaching) {
        this.cacheResult(cacheKey, result);
      }

      this.updateProgress(index, result);
      return { entity, result, index };
    });

    const validationResults = await Promise.all(validationPromises);
    
    const validEntities: TEntity[] = [];
    const invalidEntities: Array<{ entity: TEntity; errors: ValidationError[] }> = [];
    const results: ValidationResult[] = [];

    validationResults.forEach(({ entity, result }) => {
      results.push(result);
      
      if (result.isValid) {
        validEntities.push(entity);
      } else {
        invalidEntities.push({ entity, errors: result.errors });
      }
    });

    return this.buildBatchResult(
      batchId,
      entities,
      validEntities,
      invalidEntities,
      results
    );
  }

  private generateCacheKey(entity: T): string {
    // Generate deterministic hash based on entity content
    const entityStr = JSON.stringify(entity, Object.keys(entity).sort());
    return this.simpleHash(entityStr);
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private getCachedResult(key: string): ValidationResult | null {
    const entry = this.validationCache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.cacheTtl) {
      this.validationCache.delete(key);
      return null;
    }

    // Update hit count
    entry.hitCount++;
    return entry.result;
  }

  private cacheResult(key: string, result: ValidationResult): void {
    // Check cache size limit
    if (this.validationCache.size >= this.config.cacheSize) {
      // Remove least recently used entries
      this.evictLRUEntries();
    }

    this.validationCache.set(key, {
      result,
      timestamp: Date.now(),
      hitCount: 1
    });
  }

  private evictLRUEntries(): void {
    const entries = Array.from(this.validationCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = Math.floor(this.config.cacheSize * 0.1); // Remove 10%
    for (let i = 0; i < toRemove; i++) {
      this.validationCache.delete(entries[i][0]);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.validationCache.entries()) {
      if (now - entry.timestamp > this.config.cacheTtl) {
        this.validationCache.delete(key);
      }
    }
  }

  private chunkArray<TEntity>(array: TEntity[], size: number): TEntity[][] {
    const chunks: TEntity[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private createEntityStream<TEntity>(entities: TEntity[]): NodeJS.ReadableStream {
    const { Readable } = require('stream');
    let index = 0;

    return new Readable({
      objectMode: true,
      read() {
        if (index < entities.length) {
          this.push(entities[index++]);
        } else {
          this.push(null); // End of stream
        }
      }
    });
  }

  private initializeProgressTracking(total: number): void {
    this.emit('progressStart', {
      total,
      timestamp: new Date()
    });
  }

  private updateProgress(index: number, result: ValidationResult): void {
    if (!this.config.enableProgressTracking) return;

    const progress: ValidationProgress = {
      total: 0, // Will be set by caller
      processed: index + 1,
      valid: result.isValid ? 1 : 0, // Simplified for single update
      invalid: result.isValid ? 0 : 1,
      percentage: 0, // Will be calculated by caller
      estimatedTimeRemaining: 0,
      currentBatchSize: this.config.batchSize,
      throughput: 0
    };

    this.emit('progress', progress);
  }

  private buildBatchResult<TEntity extends T>(
    batchId: string,
    originalEntities: TEntity[],
    validEntities: TEntity[],
    invalidEntities: Array<{ entity: TEntity; errors: ValidationError[] }>,
    results: ValidationResult[]
  ): BatchValidationResult<TEntity> {
    const endTime = Date.now();
    const startTime = endTime - results.reduce((sum, r) => sum + (r.metadata.validationDuration || 0), 0);

    return {
      totalProcessed: originalEntities.length,
      validEntities,
      invalidEntities,
      processingTime: endTime - startTime,
      batchMetadata: {
        batchId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        batchSize: this.config.batchSize,
        successRate: validEntities.length / originalEntities.length,
        averageValidationTime: results.reduce((sum, r) => sum + (r.metadata.validationDuration || 0), 0) / results.length
      }
    };
  }

  private updateMetrics(result: BatchValidationResult<any>, processingTime: number): void {
    this.metrics.totalValidations += result.totalProcessed;
    this.metrics.successfulValidations += result.validEntities.length;
    this.metrics.failedValidations += result.invalidEntities.length;
    this.metrics.averageValidationTime = 
      (this.metrics.averageValidationTime + result.batchMetadata.averageValidationTime) / 2;
    this.metrics.periodEnd = new Date();
  }

  // Public API for getting performance metrics
  getPerformanceMetrics(): ValidationMetrics {
    return { ...this.metrics };
  }

  getCacheStatistics(): { size: number; hitRate: number; totalHits: number } {
    const totalHits = Array.from(this.validationCache.values())
      .reduce((sum, entry) => sum + entry.hitCount, 0);
    
    return {
      size: this.validationCache.size,
      hitRate: totalHits / Math.max(this.metrics.totalValidations, 1),
      totalHits
    };
  }

  clearCache(): void {
    this.validationCache.clear();
  }
}

// Semaphore for concurrency control
class Semaphore {
  private permits: number;
  private tasks: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.tasks.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (task) task();
    }
  }
}

// Usage example
const batchOptimizer = new BatchValidationOptimizer(validator, {
  batchSize: 2000,
  maxConcurrency: 8,
  enableCaching: true,
  cacheSize: 50000,
  enableStreaming: true,
  enableProgressTracking: true
});

// Setup progress tracking
batchOptimizer.on('progress', (progress: ValidationProgress) => {
  console.log(`Progress: ${progress.percentage}% (${progress.processed}/${progress.total})`);
});

batchOptimizer.on('validationComplete', (event) => {
  console.log(`Completed validation for entity ${event.processed}/${event.total}`);
});

// Large dataset validation
const largeDataset: User[] = generateLargeUserDataset(100000); // 100K users

const batchRequest: BatchValidationRequest<User> = {
  entities: largeDataset,
  context: {
    operationType: 'bulk_import',
    environment: 'production',
    validationLevel: 'standard'
  },
  batchSize: 2000,
  parallelProcessing: true,
  continueOnError: true
};

// Execute optimized batch validation
const result = await batchOptimizer.validateBatch(batchRequest);

console.log(`Batch validation completed:`);
console.log(`- Total processed: ${result.totalProcessed}`);
console.log(`- Valid entities: ${result.validEntities.length}`);
console.log(`- Invalid entities: ${result.invalidEntities.length}`);
console.log(`- Success rate: ${result.batchMetadata.successRate.toFixed(3)}`);
console.log(`- Processing time: ${result.processingTime}ms`);
console.log(`- Average validation time: ${result.batchMetadata.averageValidationTime.toFixed(2)}ms`);

// Get performance metrics
const metrics = batchOptimizer.getPerformanceMetrics();
console.log('Performance metrics:', metrics);

// Get cache statistics
const cacheStats = batchOptimizer.getCacheStatistics();
console.log('Cache statistics:', cacheStats);
```

## Key Features

- **Parallel Processing**: Concurrent validation with configurable concurrency limits
- **Intelligent Caching**: LRU cache with TTL for validation results
- **Memory Management**: Memory-efficient processing for large datasets
- **Streaming Support**: Process large datasets without loading everything into memory
- **Progress Tracking**: Real-time progress updates with throughput metrics
- **Performance Optimization**: Automatic strategy selection based on dataset characteristics
- **Comprehensive Metrics**: Detailed performance and cache statistics

## Common Pitfalls

- **Memory Leaks**: Ensure proper cleanup of cache and processing queues
- **Concurrency Limits**: Don't exceed system capabilities with too many parallel processes
- **Cache Invalidation**: Implement proper cache invalidation for changing validation rules
- **Error Handling**: Handle individual validation failures without stopping the entire batch

## Related Examples

- [Composite Validation with Policy Integration](./example-1.md)
- [Advanced Data Quality Validation](./example-2.md)
- [Enterprise Validation Orchestration](../advanced/example-1.md)