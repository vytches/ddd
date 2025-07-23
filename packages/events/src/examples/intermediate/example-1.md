# Batch Event Processing and Performance Optimization

**Version**: 1.0.0  
**Package**: @vytches-ddd/events  
**Complexity**: intermediate  
**Domain**: E-commerce Inventory  
**Patterns**: batch-processing, performance-optimization, bulk-operations  
**Dependencies**: @vytches-ddd/events, @vytches-ddd/di, @vytches-ddd/utils

## Description

Demonstrates advanced event processing patterns including batch publishing, bulk
operations, and performance optimizations for high-throughput scenarios. Shows
how to efficiently handle large volumes of events while maintaining consistency
and reliability.

## Business Context

In high-volume e-commerce scenarios, inventory updates, bulk order processing,
and batch imports can generate thousands of events. Processing these events
individually would create performance bottlenecks and resource contention. Batch
processing enables efficient handling of large event volumes while maintaining
system responsiveness.

## Code Example

````typescript
// batch-inventory-processor.ts
import { UnifiedEventBus, UniversalEventDispatcher } from '@vytches-ddd/events';
import { DomainEvent } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import {
  Product,
  InventoryUpdateCommand,
  InventoryUpdatedEventData,
} from '../types';

/**
 * @llm-summary High-performance batch inventory processor with event optimization
 * @llm-domain Inventory Management
 * @llm-complexity Intermediate
 *
 * @description
 * Processes inventory updates in batches to optimize performance and reduce
 * resource contention. Demonstrates bulk event publishing and transaction batching.
 *
 * @example
 * ```typescript
 * const processor = new BatchInventoryProcessor(eventBus, { batchSize: 100 });
 * await processor.processBulkUpdates(inventoryUpdates);
 * // ↳ Processes updates in batches and publishes events efficiently
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class BatchInventoryProcessor {
  private readonly eventDispatcher: UniversalEventDispatcher;
  private readonly config: BatchProcessingConfig;
  private readonly pendingUpdates: Map<string, InventoryUpdateCommand> =
    new Map();

  constructor(
    eventBus: UnifiedEventBus,
    config: Partial<BatchProcessingConfig> = {}
  ) {
    this.eventDispatcher = new UniversalEventDispatcher(eventBus);
    this.config = {
      batchSize: 50,
      flushInterval: 1000,
      maxRetries: 3,
      concurrentBatches: 5,
      enableMetrics: true,
      ...config,
    };
  }

  /**
   * @llm-summary Processes bulk inventory updates with batch optimization
   * @llm-domain Inventory Management
   * @llm-complexity Intermediate
   *
   * @description
   * Efficiently processes large volumes of inventory updates by batching
   * operations and optimizing event publishing for performance.
   *
   * @param updates - Array of inventory update commands
   * @returns Promise with processing results and metrics
   *
   * @example
   * ```typescript
   * const updates = [
   *   { productId: 'prod-1', quantityChange: -5, reason: 'sale' },
   *   { productId: 'prod-2', quantityChange: 10, reason: 'restock' },
   *   // ... 1000+ more updates
   * ];
   *
   * const result = await processor.processBulkUpdates(updates);
   * console.log(`Processed ${result.totalProcessed} updates in ${result.duration}ms`);
   * ```
   *
   * @since 1.0.0
   * @public
   */
  async processBulkUpdates(
    updates: InventoryUpdateCommand[]
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now();
    const metrics = new ProcessingMetrics();

    try {
      console.log(
        `📦 Starting batch processing of ${updates.length} inventory updates`
      );

      // Split updates into optimized batches
      const batches = this.createOptimizedBatches(updates);
      console.log(`  ✅ Created ${batches.length} optimized batches`);

      // Process batches concurrently with limit
      const batchResults = await this.processBatchesConcurrently(
        batches,
        metrics
      );

      // Aggregate results
      const totalProcessed = batchResults.reduce(
        (sum, result) => sum + result.processed,
        0
      );
      const totalFailed = batchResults.reduce(
        (sum, result) => sum + result.failed,
        0
      );
      const totalEvents = batchResults.reduce(
        (sum, result) => sum + result.eventsPublished,
        0
      );

      const duration = Date.now() - startTime;

      console.log(`✅ Batch processing completed:`);
      console.log(`   📊 Processed: ${totalProcessed} updates`);
      console.log(`   ❌ Failed: ${totalFailed} updates`);
      console.log(`   📡 Events Published: ${totalEvents} events`);
      console.log(`   ⏱️ Duration: ${duration}ms`);
      console.log(
        `   🚀 Throughput: ${Math.round(totalProcessed / (duration / 1000))} updates/sec`
      );

      return {
        totalProcessed,
        totalFailed,
        eventsPublished: totalEvents,
        duration,
        throughput: Math.round(totalProcessed / (duration / 1000)),
        batchCount: batches.length,
        metrics: metrics.getMetrics(),
      };
    } catch (error) {
      console.error('❌ Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * @llm-summary Creates optimized batches for efficient processing
   * @llm-domain Performance Optimization
   * @llm-complexity Intermediate
   *
   * @description
   * Intelligently groups inventory updates into batches based on product
   * categories, update types, and processing characteristics.
   *
   * @param updates - Raw inventory update commands
   * @returns Array of optimized batch groups
   *
   * @since 1.0.0
   * @private
   */
  private createOptimizedBatches(
    updates: InventoryUpdateCommand[]
  ): InventoryUpdateCommand[][] {
    const batches: InventoryUpdateCommand[][] = [];

    // Group updates by product category for better cache locality
    const categoryGroups = this.groupByCategory(updates);

    for (const [category, categoryUpdates] of categoryGroups) {
      // Further split category groups into processing batches
      for (let i = 0; i < categoryUpdates.length; i += this.config.batchSize) {
        const batch = categoryUpdates.slice(i, i + this.config.batchSize);
        batches.push(batch);
      }
    }

    return batches;
  }

  /**
   * @llm-summary Processes batches concurrently with controlled parallelism
   * @llm-domain Performance Optimization
   * @llm-complexity Intermediate
   *
   * @description
   * Executes batch processing with controlled concurrency to optimize
   * performance while preventing resource exhaustion.
   *
   * @param batches - Array of batch groups to process
   * @param metrics - Metrics collection instance
   * @returns Promise with individual batch results
   *
   * @since 1.0.0
   * @private
   */
  private async processBatchesConcurrently(
    batches: InventoryUpdateCommand[][],
    metrics: ProcessingMetrics
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];

    // Process batches in controlled concurrent groups
    for (let i = 0; i < batches.length; i += this.config.concurrentBatches) {
      const currentGroup = batches.slice(i, i + this.config.concurrentBatches);

      const groupPromises = currentGroup.map(async (batch, index) => {
        const batchId = `batch-${i + index}`;
        return await this.processSingleBatch(batch, batchId, metrics);
      });

      const groupResults = await Promise.all(groupPromises);
      results.push(...groupResults);
    }

    return results;
  }

  /**
   * @llm-summary Processes individual batch with event publishing
   * @llm-domain Batch Processing
   * @llm-complexity Intermediate
   *
   * @description
   * Processes a single batch of inventory updates, publishes events
   * in bulk, and collects processing metrics.
   *
   * @param batch - Single batch of inventory updates
   * @param batchId - Unique identifier for the batch
   * @param metrics - Metrics collection instance
   * @returns Promise with batch processing results
   *
   * @since 1.0.0
   * @private
   */
  private async processSingleBatch(
    batch: InventoryUpdateCommand[],
    batchId: string,
    metrics: ProcessingMetrics
  ): Promise<BatchResult> {
    const batchStartTime = Date.now();

    try {
      console.log(`  🔄 Processing ${batchId} with ${batch.length} updates`);

      // Process updates and collect events
      const events: InventoryUpdatedEvent[] = [];
      let processed = 0;
      let failed = 0;

      for (const update of batch) {
        try {
          const event = await this.processInventoryUpdate(update);
          if (event) {
            events.push(event);
            processed++;
          }
        } catch (error) {
          console.error(
            `    ❌ Failed to process update for ${update.productId}:`,
            error
          );
          failed++;
          metrics.recordFailure(error);
        }
      }

      // Publish events in bulk for efficiency
      if (events.length > 0) {
        await this.eventDispatcher.publishMany(events);
        console.log(`    📡 Published ${events.length} events for ${batchId}`);
      }

      const batchDuration = Date.now() - batchStartTime;
      metrics.recordBatch(batchId, processed, failed, batchDuration);

      console.log(
        `  ✅ ${batchId} completed: ${processed} processed, ${failed} failed (${batchDuration}ms)`
      );

      return {
        batchId,
        processed,
        failed,
        eventsPublished: events.length,
        duration: batchDuration,
      };
    } catch (error) {
      const batchDuration = Date.now() - batchStartTime;
      console.error(`  ❌ ${batchId} failed completely:`, error);

      metrics.recordBatch(batchId, 0, batch.length, batchDuration);

      return {
        batchId,
        processed: 0,
        failed: batch.length,
        eventsPublished: 0,
        duration: batchDuration,
      };
    }
  }

  /**
   * @llm-summary Processes individual inventory update with business logic
   * @llm-domain Inventory Management
   * @llm-complexity Intermediate
   *
   * @description
   * Applies business logic to individual inventory update and creates
   * corresponding domain event for publication.
   *
   * @param update - Single inventory update command
   * @returns Promise with inventory updated event or null if invalid
   *
   * @since 1.0.0
   * @private
   */
  private async processInventoryUpdate(
    update: InventoryUpdateCommand
  ): Promise<InventoryUpdatedEvent | null> {
    // Simulate business logic and validation
    const currentStock = await this.getCurrentStock(update.productId);
    const newStock = currentStock + update.quantityChange;

    // Validate business rules
    if (newStock < 0 && update.reason === 'sale') {
      throw new Error(
        `Insufficient inventory for product ${update.productId}: ${currentStock} available, ${Math.abs(update.quantityChange)} requested`
      );
    }

    if (Math.abs(update.quantityChange) > 10000) {
      throw new Error(
        `Inventory change too large: ${update.quantityChange} for product ${update.productId}`
      );
    }

    // Simulate database update
    await new Promise(resolve => setTimeout(resolve, 1));

    // Create domain event
    const eventData: InventoryUpdatedEventData = {
      productId: update.productId,
      previousStock: currentStock,
      newStock,
      reason: update.reason,
      updatedAt: new Date(),
    };

    return new InventoryUpdatedEvent(eventData);
  }

  private groupByCategory(
    updates: InventoryUpdateCommand[]
  ): Map<string, InventoryUpdateCommand[]> {
    const groups = new Map<string, InventoryUpdateCommand[]>();

    for (const update of updates) {
      // Simulate category extraction from product ID
      const category = update.productId.split('-')[0] || 'general';

      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(update);
    }

    return groups;
  }

  private async getCurrentStock(productId: string): Promise<number> {
    // Simulate database lookup with caching
    const stockLevels: Record<string, number> = {
      'electronics-laptop': 100,
      'electronics-phone': 250,
      'clothing-shirt': 500,
      'books-novel': 75,
    };

    return stockLevels[productId] || Math.floor(Math.random() * 100) + 10;
  }
}

/**
 * @llm-summary Domain event for inventory updates
 * @llm-domain Inventory Management
 * @llm-complexity Simple
 *
 * @description
 * Domain event representing inventory level changes for products.
 *
 * @since 1.0.0
 * @public
 */
export class InventoryUpdatedEvent extends DomainEvent<InventoryUpdatedEventData> {
  constructor(data: InventoryUpdatedEventData) {
    super('InventoryUpdated', data);
  }
}

/**
 * @llm-summary Configuration for batch processing behavior
 * @llm-domain Configuration
 * @llm-complexity Simple
 *
 * @description
 * Configuration object that controls batch processing performance
 * characteristics and resource utilization.
 *
 * @since 1.0.0
 * @public
 */
export interface BatchProcessingConfig {
  batchSize: number; // Number of items per batch
  flushInterval: number; // Auto-flush interval in milliseconds
  maxRetries: number; // Maximum retry attempts for failed items
  concurrentBatches: number; // Number of batches to process concurrently
  enableMetrics: boolean; // Whether to collect performance metrics
}

/**
 * @llm-summary Result of batch processing operation
 * @llm-domain Metrics
 * @llm-complexity Simple
 *
 * @description
 * Comprehensive result object containing processing statistics,
 * performance metrics, and operational insights.
 *
 * @since 1.0.0
 * @public
 */
export interface BatchProcessingResult {
  totalProcessed: number;
  totalFailed: number;
  eventsPublished: number;
  duration: number;
  throughput: number;
  batchCount: number;
  metrics: Record<string, unknown>;
}

export interface BatchResult {
  batchId: string;
  processed: number;
  failed: number;
  eventsPublished: number;
  duration: number;
}

/**
 * @llm-summary Metrics collection for batch processing analysis
 * @llm-domain Observability
 * @llm-complexity Intermediate
 *
 * @description
 * Collects and aggregates performance metrics for batch processing
 * operations to enable monitoring and optimization.
 *
 * @since 1.0.0
 * @public
 */
export class ProcessingMetrics {
  private batchMetrics: Map<string, BatchResult> = new Map();
  private failures: Error[] = [];
  private startTime: number = Date.now();

  recordBatch(
    batchId: string,
    processed: number,
    failed: number,
    duration: number
  ): void {
    this.batchMetrics.set(batchId, {
      batchId,
      processed,
      failed,
      eventsPublished: processed, // Simplified - in real scenario this might differ
      duration,
    });
  }

  recordFailure(error: Error): void {
    this.failures.push(error);
  }

  getMetrics(): Record<string, unknown> {
    const batches = Array.from(this.batchMetrics.values());
    const totalDuration = Date.now() - this.startTime;

    return {
      totalBatches: batches.length,
      averageBatchDuration:
        batches.reduce((sum, b) => sum + b.duration, 0) / batches.length,
      minBatchDuration: Math.min(...batches.map(b => b.duration)),
      maxBatchDuration: Math.max(...batches.map(b => b.duration)),
      totalFailures: this.failures.length,
      failureRate:
        this.failures.length /
        batches.reduce((sum, b) => sum + b.processed + b.failed, 0),
      processingDuration: totalDuration,
    };
  }
}

// Usage demonstration
async function demonstrateBatchProcessing(): Promise<void> {
  console.log('🚀 Demonstrating batch event processing...\n');

  const eventBus = new UnifiedEventBus();
  const processor = new BatchInventoryProcessor(eventBus, {
    batchSize: 25,
    concurrentBatches: 3,
    enableMetrics: true,
  });

  // Generate large volume of inventory updates
  const updates: InventoryUpdateCommand[] = [];
  const productTypes = ['electronics', 'clothing', 'books', 'home'];
  const reasons: Array<InventoryUpdatedEventData['reason']> = [
    'sale',
    'restock',
    'adjustment',
    'damage',
  ];

  for (let i = 0; i < 500; i++) {
    const productType =
      productTypes[Math.floor(Math.random() * productTypes.length)];
    const productId = `${productType}-${Math.floor(Math.random() * 100)}`;
    const reason = reasons[Math.floor(Math.random() * reasons.length)];
    const quantityChange =
      reason === 'sale'
        ? -Math.floor(Math.random() * 10) - 1
        : Math.floor(Math.random() * 50) + 1;

    updates.push({
      productId,
      quantityChange,
      reason,
    });
  }

  try {
    const result = await processor.processBulkUpdates(updates);

    console.log('\n📊 Final Processing Summary:');
    console.log(
      `✅ Success Rate: ${((result.totalProcessed / (result.totalProcessed + result.totalFailed)) * 100).toFixed(1)}%`
    );
    console.log(`🚀 Throughput: ${result.throughput} updates/second`);
    console.log(
      `📦 Batch Efficiency: ${(result.totalProcessed / result.batchCount).toFixed(1)} updates/batch`
    );
    console.log(
      `📡 Event Publishing: ${result.eventsPublished} events published`
    );
  } catch (error) {
    console.error('❌ Demonstration failed:', error);
  }
}
````

## Key Features

- **📦 Intelligent Batching**: Groups updates by category and characteristics
  for optimal processing
- **⚡ Concurrent Processing**: Controlled parallelism prevents resource
  exhaustion while maximizing throughput
- **📊 Performance Metrics**: Comprehensive metrics collection for monitoring
  and optimization
- **🔄 Bulk Event Publishing**: Efficient batch event publishing reduces
  overhead and improves performance
- **🛡️ Error Isolation**: Individual update failures don't affect the entire
  batch
- **🎯 Resource Management**: Configurable batch sizes and concurrency limits
  for different environments

## Performance Benefits

1. **Reduced Event Publishing Overhead**: Bulk publishing eliminates per-event
   processing costs
2. **Improved Database Efficiency**: Batch operations reduce connection overhead
   and improve cache locality
3. **Controlled Resource Usage**: Concurrency limits prevent system overload
   during peak processing
4. **Better Error Recovery**: Isolated failures enable partial success scenarios
5. **Optimized Memory Usage**: Streaming processing prevents memory exhaustion
   with large datasets

## Common Pitfalls

- **❌ Oversized Batches**: Too large batches can cause memory issues and
  transaction timeouts
- **❌ Undersized Batches**: Too small batches reduce efficiency gains from
  batching
- **❌ Uncontrolled Concurrency**: Too many concurrent batches can overwhelm
  system resources
- **❌ Poor Error Handling**: Not isolating failures can cause entire batch
  operations to fail

## Related Examples

- [Example 2: Event Sourcing](./example-2.md) - Event sourcing with batch replay
  capabilities
- [Example 3: Multi-Context Processing](./example-3.md) - Context-aware batch
  processing for multi-tenant scenarios
- [Advanced: Performance Monitoring](../advanced/example-1.md) - Advanced
  monitoring and optimization techniques
