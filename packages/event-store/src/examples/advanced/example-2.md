# High-Performance Event Store

**Version**: 1.0.0 **Package**: @vytches/ddd-event-store **Complexity**:
advanced **Domain**: Infrastructure **Patterns**: high-performance,
optimization, caching, partitioning, concurrent-processing **Dependencies**:
@vytches/ddd-event-store, @vytches/ddd-events, @vytches/ddd-utils,
@vytches/ddd-logging

## Description

Enterprise-grade high-performance event store implementation with advanced
optimization techniques including intelligent caching, stream partitioning,
concurrent processing, and sophisticated performance monitoring for extreme
throughput scenarios.

## Business Context

High-traffic enterprise systems require event stores that can handle millions of
events per second while maintaining low latency and high availability. This
implementation demonstrates advanced performance optimization techniques
essential for financial trading platforms, IoT data ingestion, and real-time
analytics systems.

## Code Example

```typescript
// high-performance-event-store.ts
import { InMemoryEventStore, IEventSerializer } from '@vytches/ddd-event-store';
import { DomainEvent, EntityId } from '@vytches/ddd-events';
import { Result } from '@vytches/ddd-utils';
import { Logger } from '@vytches/ddd-logging';
import {
  PerformanceOptimizer,
  CacheManager,
  StreamPartitioner,
  ConcurrencyManager,
  MetricsCollector,
} from './types'; // From your app

// ⭐ FOCUS: High-performance event store with advanced optimizations
export class HighPerformanceEventStore {
  private readonly eventStore: InMemoryEventStore;
  private readonly cacheManager: CacheManager;
  private readonly streamPartitioner: StreamPartitioner;
  private readonly concurrencyManager: ConcurrencyManager;
  private readonly metricsCollector: MetricsCollector;
  private readonly performanceOptimizer: PerformanceOptimizer;
  private readonly logger = Logger.forContext('HighPerformanceEventStore');

  // Performance configuration
  private readonly config = {
    batchSize: 1000,
    maxConcurrentReads: 50,
    maxConcurrentWrites: 20,
    cacheSize: 100000,
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    partitionSize: 10000,
    compressionThreshold: 1024,
    warmupEnabled: true,
    preloadStrategies: ['recent', 'frequent', 'predictive'],
  };

  constructor() {
    this.eventStore = new InMemoryEventStore({
      serializer: new HighPerformanceSerializer(),
      enableSnapshots: true,
      snapshotFrequency: 100,
    });

    this.cacheManager = new AdvancedCacheManager(
      this.config.cacheSize,
      this.config.cacheTTL
    );
    this.streamPartitioner = new StreamPartitioner(this.config.partitionSize);
    this.concurrencyManager = new ConcurrencyManager(
      this.config.maxConcurrentReads,
      this.config.maxConcurrentWrites
    );
    this.metricsCollector = new MetricsCollector();
    this.performanceOptimizer = new PerformanceOptimizer(this.metricsCollector);

    this.initializePerformanceOptimizations();
  }

  private async initializePerformanceOptimizations(): Promise<void> {
    // ⭐ FOCUS: Performance warmup and optimization
    if (this.config.warmupEnabled) {
      await this.warmupCache();
      await this.optimizePartitions();
      await this.preloadFrequentStreams();
    }

    // Start performance monitoring
    this.startPerformanceMonitoring();
  }

  async appendEvents(
    streamId: string,
    events: DomainEvent[],
    expectedVersion: number = -1
  ): Promise<Result<AppendResult, Error>> {
    const startTime = performance.now();
    const operationId = EntityId.createUuid().value;

    try {
      // ⭐ FOCUS: High-throughput append with optimizations
      this.logger.debug('High-performance append started', {
        operationId,
        streamId,
        eventCount: events.length,
        expectedVersion,
      });

      // 1. Acquire write semaphore for concurrency control
      await this.concurrencyManager.acquireWrite();

      try {
        // 2. Batch processing for efficiency
        const batches = this.createEventBatches(events, this.config.batchSize);
        const appendResults: BatchAppendResult[] = [];

        for (const batch of batches) {
          const batchResult = await this.appendEventBatch(
            streamId,
            batch,
            expectedVersion + appendResults.length * this.config.batchSize
          );

          if (batchResult.isFailure()) {
            // ⭐ FOCUS: Rollback previous batches on failure
            await this.rollbackBatches(streamId, appendResults);
            return Result.fail(batchResult.error);
          }

          appendResults.push(batchResult.value);
        }

        // 3. Update performance caches
        await this.updateCacheAfterAppend(streamId, events);

        // 4. Trigger async optimizations
        this.triggerAsyncOptimizations(streamId, events.length);

        const totalDuration = performance.now() - startTime;
        const throughput = events.length / (totalDuration / 1000);

        this.metricsCollector.recordAppend(
          streamId,
          events.length,
          totalDuration,
          throughput
        );

        const result: AppendResult = {
          operationId,
          streamId,
          eventsAppended: events.length,
          batchesProcessed: batches.length,
          duration: totalDuration,
          throughput,
          newVersion: expectedVersion + events.length,
        };

        this.logger.info('High-performance append completed', {
          operationId,
          streamId,
          eventsAppended: events.length,
          throughput: Math.round(throughput),
          duration: Math.round(totalDuration),
        });

        return Result.ok(result);
      } finally {
        this.concurrencyManager.releaseWrite();
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metricsCollector.recordAppendError(
        streamId,
        events.length,
        duration,
        error.message
      );

      this.logger.error('High-performance append failed', {
        operationId,
        streamId,
        eventCount: events.length,
        error: error.message,
        duration,
      });

      return Result.fail(
        new Error(`High-performance append failed: ${error.message}`)
      );
    }
  }

  async readEvents(
    streamId: string,
    options: HighPerformanceReadOptions = {}
  ): Promise<Result<ReadResult, Error>> {
    const startTime = performance.now();
    const operationId = EntityId.createUuid().value;

    try {
      // ⭐ FOCUS: Optimized read with intelligent caching
      this.logger.debug('High-performance read started', {
        operationId,
        streamId,
        options,
      });

      // 1. Check cache first with intelligent cache strategy
      const cacheResult = await this.readFromCache(streamId, options);
      if (cacheResult.isSuccess()) {
        const duration = performance.now() - startTime;
        this.metricsCollector.recordCacheHit(streamId, duration);

        return Result.ok({
          operationId,
          streamId,
          events: cacheResult.value,
          source: 'cache',
          duration,
          fromCache: true,
        });
      }

      // 2. Acquire read semaphore
      await this.concurrencyManager.acquireRead();

      try {
        // 3. Partitioned read for large streams
        const partitionedResult = await this.readFromPartitions(
          streamId,
          options
        );

        if (partitionedResult.isFailure()) {
          return Result.fail(partitionedResult.error);
        }

        const events = partitionedResult.value;

        // 4. Apply filters and transformations
        const filteredEvents = this.applyFiltersOptimized(events, options);
        const paginatedResult = this.applyPaginationOptimized(
          filteredEvents,
          options
        );

        // 5. Update cache with read results
        await this.updateCacheAfterRead(
          streamId,
          paginatedResult.events,
          options
        );

        // 6. Trigger predictive prefetching
        this.triggerPredictivePrefetch(streamId, options);

        const duration = performance.now() - startTime;
        const throughput = paginatedResult.events.length / (duration / 1000);

        this.metricsCollector.recordRead(
          streamId,
          paginatedResult.events.length,
          duration,
          throughput
        );

        const result: ReadResult = {
          operationId,
          streamId,
          events: paginatedResult.events,
          source: 'store',
          duration,
          throughput,
          hasMore: paginatedResult.hasMore,
          nextToken: paginatedResult.nextToken,
          fromCache: false,
        };

        this.logger.debug('High-performance read completed', {
          operationId,
          streamId,
          eventsRead: result.events.length,
          throughput: Math.round(throughput),
          duration: Math.round(duration),
        });

        return Result.ok(result);
      } finally {
        this.concurrencyManager.releaseRead();
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      this.metricsCollector.recordReadError(streamId, duration, error.message);

      this.logger.error('High-performance read failed', {
        operationId,
        streamId,
        error: error.message,
        duration,
      });

      return Result.fail(
        new Error(`High-performance read failed: ${error.message}`)
      );
    }
  }

  private createEventBatches(
    events: DomainEvent[],
    batchSize: number
  ): DomainEvent[][] {
    const batches: DomainEvent[][] = [];

    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize));
    }

    return batches;
  }

  private async appendEventBatch(
    streamId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<Result<BatchAppendResult, Error>> {
    try {
      // ⭐ FOCUS: Optimized batch append with compression
      const compressedEvents = await this.compressEventsIfNeeded(events);
      const partitionId = this.streamPartitioner.getPartition(
        streamId,
        expectedVersion
      );

      const appendResult = await this.eventStore.appendEvents(
        `${streamId}:${partitionId}`,
        compressedEvents,
        expectedVersion
      );

      if (appendResult.isFailure()) {
        return Result.fail(appendResult.error);
      }

      return Result.ok({
        partitionId,
        eventsAppended: events.length,
        compressed: compressedEvents.length !== events.length,
        newVersion: expectedVersion + events.length,
      });
    } catch (error) {
      return Result.fail(new Error(`Batch append failed: ${error.message}`));
    }
  }

  private async compressEventsIfNeeded(
    events: DomainEvent[]
  ): Promise<DomainEvent[]> {
    // ⭐ FOCUS: Intelligent event compression
    const serializedSize = this.calculateSerializedSize(events);

    if (serializedSize > this.config.compressionThreshold) {
      return await this.compressEvents(events);
    }

    return events;
  }

  private calculateSerializedSize(events: DomainEvent[]): number {
    // Estimate serialized size without full serialization
    return events.reduce((total, event) => {
      return total + JSON.stringify(event).length;
    }, 0);
  }

  private async compressEvents(events: DomainEvent[]): Promise<DomainEvent[]> {
    // ⭐ FOCUS: Advanced event compression
    try {
      const compressedPayload = await this.compress(JSON.stringify(events));

      const compressedEvent = {
        eventId: EntityId.createUuid().value,
        eventType: 'CompressedEventBatch',
        aggregateId: events[0].aggregateId,
        version: 1,
        timestamp: new Date(),
        payload: compressedPayload,
        metadata: {
          originalCount: events.length,
          compressionRatio:
            compressedPayload.length / JSON.stringify(events).length,
          compressed: true,
        },
      } as DomainEvent;

      return [compressedEvent];
    } catch (error) {
      this.logger.warn('Event compression failed, using uncompressed events', {
        eventCount: events.length,
        error: error.message,
      });
      return events;
    }
  }

  private async compress(data: string): Promise<string> {
    // Placeholder for actual compression implementation
    return `compressed:${data}`;
  }

  private async decompress(data: string): Promise<string> {
    // Placeholder for actual decompression implementation
    return data.replace('compressed:', '');
  }

  private async readFromCache(
    streamId: string,
    options: HighPerformanceReadOptions
  ): Promise<Result<DomainEvent[], Error>> {
    try {
      // ⭐ FOCUS: Intelligent cache lookup with options matching
      const cacheKey = this.generateCacheKey(streamId, options);
      const cachedResult = await this.cacheManager.get<DomainEvent[]>(cacheKey);

      if (cachedResult) {
        this.logger.debug('Cache hit for stream read', {
          streamId,
          cacheKey,
          eventCount: cachedResult.length,
        });

        return Result.ok(cachedResult);
      }

      return Result.fail(new Error('Cache miss'));
    } catch (error) {
      return Result.fail(new Error(`Cache read failed: ${error.message}`));
    }
  }

  private async readFromPartitions(
    streamId: string,
    options: HighPerformanceReadOptions
  ): Promise<Result<DomainEvent[], Error>> {
    try {
      // ⭐ FOCUS: Parallel partition reading
      const partitions =
        this.streamPartitioner.getPartitionsForStream(streamId);
      const readPromises = partitions.map(async partitionId => {
        const partitionStreamId = `${streamId}:${partitionId}`;
        const readResult = await this.eventStore.readStream(partitionStreamId);

        return readResult.isSuccess() ? readResult.value.events : [];
      });

      const partitionResults = await Promise.all(readPromises);
      const allEvents = partitionResults.flat();

      // Sort events by timestamp for chronological order
      allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Decompress events if needed
      const decompressedEvents = await this.decompressEventsIfNeeded(allEvents);

      return Result.ok(decompressedEvents);
    } catch (error) {
      return Result.fail(
        new Error(`Partitioned read failed: ${error.message}`)
      );
    }
  }

  private async decompressEventsIfNeeded(
    events: DomainEvent[]
  ): Promise<DomainEvent[]> {
    const decompressedEvents: DomainEvent[] = [];

    for (const event of events) {
      if (
        event.eventType === 'CompressedEventBatch' &&
        event.metadata?.compressed
      ) {
        try {
          const decompressedData = await this.decompress(
            event.payload as string
          );
          const originalEvents = JSON.parse(decompressedData) as DomainEvent[];
          decompressedEvents.push(...originalEvents);
        } catch (error) {
          this.logger.warn('Event decompression failed', {
            eventId: event.eventId,
            error: error.message,
          });
          decompressedEvents.push(event);
        }
      } else {
        decompressedEvents.push(event);
      }
    }

    return decompressedEvents;
  }

  private applyFiltersOptimized(
    events: DomainEvent[],
    options: HighPerformanceReadOptions
  ): DomainEvent[] {
    let filtered = events;

    // ⭐ FOCUS: Optimized filtering with early termination
    if (options.eventTypes && options.eventTypes.length > 0) {
      const eventTypeSet = new Set(options.eventTypes);
      filtered = filtered.filter(event => eventTypeSet.has(event.eventType));
    }

    if (options.fromTimestamp) {
      filtered = filtered.filter(
        event => event.timestamp >= options.fromTimestamp!
      );
    }

    if (options.toTimestamp) {
      filtered = filtered.filter(
        event => event.timestamp <= options.toTimestamp!
      );
    }

    if (options.correlationId) {
      filtered = filtered.filter(
        event => event.correlationId === options.correlationId
      );
    }

    return filtered;
  }

  private applyPaginationOptimized(
    events: DomainEvent[],
    options: HighPerformanceReadOptions
  ): PaginatedResult {
    const pageSize = options.pageSize || 1000;
    const startIndex = options.startIndex || 0;

    const paginatedEvents = events.slice(startIndex, startIndex + pageSize);
    const hasMore = events.length > startIndex + pageSize;

    let nextToken: string | undefined;
    if (hasMore) {
      nextToken = Buffer.from(
        JSON.stringify({
          startIndex: startIndex + pageSize,
        })
      ).toString('base64');
    }

    return {
      events: paginatedEvents,
      hasMore,
      nextToken,
    };
  }

  private async updateCacheAfterAppend(
    streamId: string,
    events: DomainEvent[]
  ): Promise<void> {
    try {
      // ⭐ FOCUS: Intelligent cache invalidation and update
      await this.cacheManager.invalidatePattern(`stream:${streamId}:*`);

      // Cache most recent events for quick access
      const cacheKey = this.generateCacheKey(streamId, { recent: true });
      await this.cacheManager.set(
        cacheKey,
        events.slice(-100),
        this.config.cacheTTL
      );
    } catch (error) {
      this.logger.warn('Cache update after append failed', {
        streamId,
        error: error.message,
      });
    }
  }

  private async updateCacheAfterRead(
    streamId: string,
    events: DomainEvent[],
    options: HighPerformanceReadOptions
  ): Promise<void> {
    try {
      // ⭐ FOCUS: Strategic caching based on read patterns
      const cacheKey = this.generateCacheKey(streamId, options);

      // Only cache if result set is reasonably sized
      if (events.length <= 1000) {
        await this.cacheManager.set(cacheKey, events, this.config.cacheTTL);
      }

      // Update access patterns for optimization
      this.metricsCollector.recordCachePattern(streamId, options);
    } catch (error) {
      this.logger.warn('Cache update after read failed', {
        streamId,
        error: error.message,
      });
    }
  }

  private generateCacheKey(
    streamId: string,
    options: HighPerformanceReadOptions
  ): string {
    const keyComponents = [
      'stream',
      streamId,
      options.eventTypes ? `types:${options.eventTypes.join(',')}` : '',
      options.fromTimestamp ? `from:${options.fromTimestamp.getTime()}` : '',
      options.toTimestamp ? `to:${options.toTimestamp.getTime()}` : '',
      options.correlationId ? `corr:${options.correlationId}` : '',
      options.pageSize ? `size:${options.pageSize}` : '',
      options.startIndex ? `idx:${options.startIndex}` : '',
    ].filter(Boolean);

    return keyComponents.join(':');
  }

  private async rollbackBatches(
    streamId: string,
    completedBatches: BatchAppendResult[]
  ): Promise<void> {
    // ⭐ FOCUS: Batch rollback for failure recovery
    for (const batch of completedBatches.reverse()) {
      try {
        const partitionStreamId = `${streamId}:${batch.partitionId}`;
        // Implementation would depend on specific rollback strategy
        this.logger.warn('Batch rollback required', {
          streamId: partitionStreamId,
          batchVersion: batch.newVersion,
        });
      } catch (error) {
        this.logger.error('Batch rollback failed', {
          streamId,
          partitionId: batch.partitionId,
          error: error.message,
        });
      }
    }
  }

  private triggerAsyncOptimizations(
    streamId: string,
    eventCount: number
  ): void {
    // ⭐ FOCUS: Background optimization triggers
    setImmediate(() => {
      this.performanceOptimizer.analyzeStreamPattern(streamId, eventCount);

      if (eventCount > 1000) {
        this.performanceOptimizer.considerPartitionSplit(streamId);
      }
    });
  }

  private triggerPredictivePrefetch(
    streamId: string,
    options: HighPerformanceReadOptions
  ): void {
    // ⭐ FOCUS: Predictive prefetching based on access patterns
    setImmediate(() => {
      const predictedStreams = this.performanceOptimizer.predictNextStreams(
        streamId,
        options
      );

      for (const predictedStream of predictedStreams) {
        this.prefetchStream(predictedStream);
      }
    });
  }

  private async prefetchStream(streamId: string): Promise<void> {
    try {
      // ⭐ FOCUS: Background prefetching
      const readResult = await this.readEvents(streamId, {
        pageSize: 100,
        prefetch: true,
      });

      if (readResult.isSuccess()) {
        this.logger.debug('Stream prefetched successfully', {
          streamId,
          eventCount: readResult.value.events.length,
        });
      }
    } catch (error) {
      this.logger.debug('Stream prefetch failed', {
        streamId,
        error: error.message,
      });
    }
  }

  private async warmupCache(): Promise<void> {
    try {
      this.logger.info('Starting cache warmup process');

      // ⭐ FOCUS: Strategic cache warmup
      const frequentStreams = await this.identifyFrequentStreams();
      const recentStreams = await this.identifyRecentStreams();
      const criticalStreams = await this.identifyCriticalStreams();

      const streamsToWarmup = [
        ...new Set([...frequentStreams, ...recentStreams, ...criticalStreams]),
      ];

      for (const streamId of streamsToWarmup) {
        await this.prefetchStream(streamId);
      }

      this.logger.info('Cache warmup completed', {
        streamsWarmed: streamsToWarmup.length,
      });
    } catch (error) {
      this.logger.warn('Cache warmup failed', { error: error.message });
    }
  }

  private async optimizePartitions(): Promise<void> {
    try {
      // ⭐ FOCUS: Partition optimization based on access patterns
      const partitionMetrics = await this.streamPartitioner.analyzePartitions();
      const optimizations =
        this.performanceOptimizer.suggestPartitionOptimizations(
          partitionMetrics
        );

      for (const optimization of optimizations) {
        await this.applyPartitionOptimization(optimization);
      }
    } catch (error) {
      this.logger.warn('Partition optimization failed', {
        error: error.message,
      });
    }
  }

  private async preloadFrequentStreams(): Promise<void> {
    try {
      // ⭐ FOCUS: Preload based on historical access patterns
      for (const strategy of this.config.preloadStrategies) {
        const streams = await this.identifyStreamsForStrategy(strategy);

        for (const streamId of streams) {
          await this.prefetchStream(streamId);
        }
      }
    } catch (error) {
      this.logger.warn('Stream preloading failed', { error: error.message });
    }
  }

  private startPerformanceMonitoring(): void {
    // ⭐ FOCUS: Continuous performance monitoring
    setInterval(() => {
      this.collectPerformanceMetrics();
      this.adjustPerformanceParameters();
      this.reportPerformanceStatus();
    }, 30000); // Every 30 seconds
  }

  private collectPerformanceMetrics(): void {
    const metrics = this.metricsCollector.getSnapshot();

    this.logger.debug('Performance metrics collected', {
      appendThroughput: metrics.averageAppendThroughput,
      readThroughput: metrics.averageReadThroughput,
      cacheHitRate: metrics.cacheHitRate,
      errorRate: metrics.errorRate,
    });
  }

  private adjustPerformanceParameters(): void {
    // ⭐ FOCUS: Dynamic performance tuning
    const metrics = this.metricsCollector.getSnapshot();

    if (metrics.cacheHitRate < 0.8) {
      // Increase cache size if hit rate is low
      this.cacheManager.expandCache(Math.floor(this.config.cacheSize * 1.2));
    }

    if (metrics.averageAppendLatency > 1000) {
      // Increase batch size if append latency is high
      this.config.batchSize = Math.min(this.config.batchSize * 1.1, 2000);
    }
  }

  private reportPerformanceStatus(): void {
    const status = this.getPerformanceStatus();

    if (status.overall !== 'optimal') {
      this.logger.warn('Performance degradation detected', status);
    }
  }

  getPerformanceStatus(): PerformanceStatus {
    const metrics = this.metricsCollector.getSnapshot();

    return {
      overall: this.determineOverallPerformance(metrics),
      appendThroughput: metrics.averageAppendThroughput,
      readThroughput: metrics.averageReadThroughput,
      cacheHitRate: metrics.cacheHitRate,
      errorRate: metrics.errorRate,
      concurrencyUtilization: this.concurrencyManager.getUtilization(),
      partitionEfficiency: this.streamPartitioner.getEfficiency(),
      recommendations: this.generatePerformanceRecommendations(metrics),
    };
  }

  private determineOverallPerformance(
    metrics: any
  ): 'optimal' | 'good' | 'degraded' | 'poor' {
    if (metrics.errorRate > 0.05) return 'poor';
    if (metrics.cacheHitRate < 0.6 || metrics.averageAppendLatency > 2000)
      return 'degraded';
    if (metrics.cacheHitRate < 0.8 || metrics.averageAppendLatency > 1000)
      return 'good';
    return 'optimal';
  }

  private generatePerformanceRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.cacheHitRate < 0.8) {
      recommendations.push(
        'Consider increasing cache size or adjusting cache strategies'
      );
    }

    if (metrics.averageAppendLatency > 1000) {
      recommendations.push(
        'Consider optimizing batch size or reducing serialization overhead'
      );
    }

    if (metrics.errorRate > 0.01) {
      recommendations.push(
        'Investigate error patterns and implement additional resilience measures'
      );
    }

    return recommendations;
  }

  // ⭐ FOCUS: Helper methods for stream identification
  private async identifyFrequentStreams(): Promise<string[]> {
    return this.metricsCollector.getFrequentStreams(10);
  }

  private async identifyRecentStreams(): Promise<string[]> {
    return this.metricsCollector.getRecentStreams(10);
  }

  private async identifyCriticalStreams(): Promise<string[]> {
    return this.metricsCollector.getCriticalStreams();
  }

  private async identifyStreamsForStrategy(
    strategy: string
  ): Promise<string[]> {
    switch (strategy) {
      case 'recent':
        return this.identifyRecentStreams();
      case 'frequent':
        return this.identifyFrequentStreams();
      case 'predictive':
        return this.performanceOptimizer.predictImportantStreams();
      default:
        return [];
    }
  }

  private async applyPartitionOptimization(optimization: any): Promise<void> {
    // Implementation would apply specific optimization strategies
    this.logger.debug('Applying partition optimization', optimization);
  }
}

// ⭐ FOCUS: High-performance serializer
export class HighPerformanceSerializer implements IEventSerializer {
  private readonly compressionThreshold = 1024;

  serialize(event: DomainEvent): string {
    try {
      // ⭐ FOCUS: Optimized serialization with selective compression
      const baseData = this.createOptimizedEventData(event);
      const serialized = JSON.stringify(baseData);

      if (serialized.length > this.compressionThreshold) {
        return this.compressIfBeneficial(serialized);
      }

      return serialized;
    } catch (error) {
      throw new Error(
        `High-performance serialization failed: ${error.message}`
      );
    }
  }

  deserialize(data: string): DomainEvent {
    try {
      // ⭐ FOCUS: Fast deserialization with decompression support
      const decompressedData = this.decompressIfNeeded(data);
      const parsed = JSON.parse(decompressedData);

      return this.reconstructOptimizedEvent(parsed);
    } catch (error) {
      throw new Error(
        `High-performance deserialization failed: ${error.message}`
      );
    }
  }

  private createOptimizedEventData(event: DomainEvent): any {
    // ⭐ FOCUS: Create space-efficient event representation
    return {
      id: event.eventId,
      type: event.eventType,
      agg: event.aggregateId.value,
      ver: event.version,
      ts: event.timestamp.getTime(), // Store as milliseconds for space efficiency
      data: this.optimizePayload(event),
      meta: event.metadata,
      corr: event.correlationId,
      caus: event.causationId,
    };
  }

  private optimizePayload(event: DomainEvent): any {
    // ⭐ FOCUS: Extract and optimize event payload
    const payload = { ...event };

    // Remove standard properties that are stored separately
    delete payload.eventId;
    delete payload.eventType;
    delete payload.aggregateId;
    delete payload.version;
    delete payload.timestamp;
    delete payload.metadata;
    delete payload.correlationId;
    delete payload.causationId;

    return payload;
  }

  private reconstructOptimizedEvent(data: any): DomainEvent {
    // ⭐ FOCUS: Reconstruct domain event from optimized format
    return {
      eventId: data.id,
      eventType: data.type,
      aggregateId: EntityId.fromString(data.agg),
      version: data.ver,
      timestamp: new Date(data.ts),
      metadata: data.meta,
      correlationId: data.corr,
      causationId: data.caus,
      ...data.data, // Spread the payload data
    } as DomainEvent;
  }

  private compressIfBeneficial(data: string): string {
    // Placeholder for actual compression
    const compressed = `lz4:${data}`;
    return compressed.length < data.length ? compressed : data;
  }

  private decompressIfNeeded(data: string): string {
    if (data.startsWith('lz4:')) {
      return data.substring(4); // Remove compression marker
    }
    return data;
  }
}

// ⭐ FOCUS: Advanced cache manager
export class AdvancedCacheManager implements CacheManager {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly accessPatterns = new Map<string, AccessPattern>();

  constructor(
    private maxSize: number,
    private defaultTTL: number
  ) {}

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.cache.delete(key);
      }
      return null;
    }

    // Update access pattern
    this.updateAccessPattern(key);

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // ⭐ FOCUS: Intelligent cache management with LRU and access patterns
    if (this.cache.size >= this.maxSize) {
      await this.evictLeastUseful();
    }

    const entry: CacheEntry = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      accessCount: 1,
      lastAccess: Date.now(),
    };

    this.cache.set(key, entry);
    this.initAccessPattern(key);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.accessPatterns.delete(key);
      }
    }
  }

  expandCache(newSize: number): void {
    this.maxSize = Math.max(newSize, this.maxSize);
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private updateAccessPattern(key: string): void {
    const pattern = this.accessPatterns.get(key);
    if (pattern) {
      pattern.accessCount++;
      pattern.lastAccess = Date.now();
    }
  }

  private initAccessPattern(key: string): void {
    this.accessPatterns.set(key, {
      accessCount: 1,
      lastAccess: Date.now(),
      created: Date.now(),
    });
  }

  private async evictLeastUseful(): Promise<void> {
    // ⭐ FOCUS: Smart eviction based on access patterns and value
    let leastUsefulKey: string | null = null;
    let lowestScore = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      const pattern = this.accessPatterns.get(key);
      if (!pattern) continue;

      // Calculate usefulness score
      const age = Date.now() - pattern.created;
      const timeSinceAccess = Date.now() - pattern.lastAccess;
      const score = (pattern.accessCount * 1000) / (age + timeSinceAccess);

      if (score < lowestScore) {
        lowestScore = score;
        leastUsefulKey = key;
      }
    }

    if (leastUsefulKey) {
      this.cache.delete(leastUsefulKey);
      this.accessPatterns.delete(leastUsefulKey);
    }
  }
}

// ⭐ FOCUS: Supporting interfaces and types
interface HighPerformanceReadOptions {
  eventTypes?: string[];
  fromTimestamp?: Date;
  toTimestamp?: Date;
  correlationId?: string;
  pageSize?: number;
  startIndex?: number;
  prefetch?: boolean;
  recent?: boolean;
}

interface AppendResult {
  operationId: string;
  streamId: string;
  eventsAppended: number;
  batchesProcessed: number;
  duration: number;
  throughput: number;
  newVersion: number;
}

interface ReadResult {
  operationId: string;
  streamId: string;
  events: DomainEvent[];
  source: 'cache' | 'store';
  duration: number;
  throughput?: number;
  hasMore: boolean;
  nextToken?: string;
  fromCache: boolean;
}

interface BatchAppendResult {
  partitionId: string;
  eventsAppended: number;
  compressed: boolean;
  newVersion: number;
}

interface PaginatedResult {
  events: DomainEvent[];
  hasMore: boolean;
  nextToken?: string;
}

interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

interface AccessPattern {
  accessCount: number;
  lastAccess: number;
  created: number;
}

interface PerformanceStatus {
  overall: 'optimal' | 'good' | 'degraded' | 'poor';
  appendThroughput: number;
  readThroughput: number;
  cacheHitRate: number;
  errorRate: number;
  concurrencyUtilization: number;
  partitionEfficiency: number;
  recommendations: string[];
}
```

## Usage Examples

```typescript
// Complete high-performance event store demonstration
import { HighPerformanceEventStore } from './high-performance-event-store';

async function demonstrateHighPerformanceEventStore() {
  const eventStore = new HighPerformanceEventStore();

  console.log('--- High-Performance Event Store Demo ---\n');

  // ⭐ FOCUS: 1. High-throughput event append
  console.log('1. High-Throughput Event Append:');

  const events = [];
  for (let i = 0; i < 10000; i++) {
    events.push(
      new HighVolumeEvent(EntityId.createUuid(), `event-${i}`, {
        index: i,
        timestamp: new Date(),
      })
    );
  }

  const appendStart = performance.now();
  const appendResult = await eventStore.appendEvents(
    'high-volume-stream',
    events
  );
  const appendDuration = performance.now() - appendStart;

  if (appendResult.isSuccess()) {
    const result = appendResult.value;
    console.log(
      `  Appended ${result.eventsAppended} events in ${Math.round(appendDuration)}ms`
    );
    console.log(`  Throughput: ${Math.round(result.throughput)} events/second`);
    console.log(`  Batches processed: ${result.batchesProcessed}`);
  }

  // ⭐ FOCUS: 2. Optimized read with caching
  console.log('\n2. Optimized Read Performance:');

  // First read (cache miss)
  const firstReadStart = performance.now();
  const firstRead = await eventStore.readEvents('high-volume-stream', {
    pageSize: 1000,
  });
  const firstReadDuration = performance.now() - firstReadStart;

  if (firstRead.isSuccess()) {
    console.log(
      `  First read: ${firstRead.value.events.length} events in ${Math.round(firstReadDuration)}ms (${firstRead.value.fromCache ? 'cache' : 'store'})`
    );
  }

  // Second read (cache hit)
  const secondReadStart = performance.now();
  const secondRead = await eventStore.readEvents('high-volume-stream', {
    pageSize: 1000,
  });
  const secondReadDuration = performance.now() - secondReadStart;

  if (secondRead.isSuccess()) {
    console.log(
      `  Second read: ${secondRead.value.events.length} events in ${Math.round(secondReadDuration)}ms (${secondRead.value.fromCache ? 'cache' : 'store'})`
    );
    console.log(
      `  Cache performance improvement: ${Math.round((firstReadDuration / secondReadDuration) * 100)}%`
    );
  }

  // ⭐ FOCUS: 3. Concurrent operations
  console.log('\n3. Concurrent Operations Test:');

  const concurrentReads = [];
  const concurrentWrites = [];

  // Create concurrent read operations
  for (let i = 0; i < 20; i++) {
    concurrentReads.push(
      eventStore.readEvents(`stream-${i}`, {
        eventTypes: ['HighVolumeEvent'],
        pageSize: 500,
      })
    );
  }

  // Create concurrent write operations
  for (let i = 0; i < 10; i++) {
    const batchEvents = [];
    for (let j = 0; j < 100; j++) {
      batchEvents.push(
        new HighVolumeEvent(
          EntityId.createUuid(),
          `concurrent-event-${i}-${j}`,
          { batchId: i, index: j }
        )
      );
    }

    concurrentWrites.push(
      eventStore.appendEvents(`concurrent-stream-${i}`, batchEvents)
    );
  }

  const [readResults, writeResults] = await Promise.all([
    Promise.allSettled(concurrentReads),
    Promise.allSettled(concurrentWrites),
  ]);

  const successfulReads = readResults.filter(
    r => r.status === 'fulfilled'
  ).length;
  const successfulWrites = writeResults.filter(
    r => r.status === 'fulfilled'
  ).length;

  console.log(`  Concurrent reads: ${successfulReads}/20 successful`);
  console.log(`  Concurrent writes: ${successfulWrites}/10 successful`);

  // ⭐ FOCUS: 4. Performance status monitoring
  console.log('\n4. Performance Status:');

  const performanceStatus = eventStore.getPerformanceStatus();

  console.log(`  Overall Performance: ${performanceStatus.overall}`);
  console.log(
    `  Append Throughput: ${Math.round(performanceStatus.appendThroughput)} events/sec`
  );
  console.log(
    `  Read Throughput: ${Math.round(performanceStatus.readThroughput)} events/sec`
  );
  console.log(
    `  Cache Hit Rate: ${(performanceStatus.cacheHitRate * 100).toFixed(1)}%`
  );
  console.log(
    `  Error Rate: ${(performanceStatus.errorRate * 100).toFixed(2)}%`
  );
  console.log(
    `  Concurrency Utilization: ${(performanceStatus.concurrencyUtilization * 100).toFixed(1)}%`
  );

  if (performanceStatus.recommendations.length > 0) {
    console.log('  Recommendations:');
    performanceStatus.recommendations.forEach(rec => {
      console.log(`    - ${rec}`);
    });
  }

  // ⭐ FOCUS: 5. Advanced filtering and search
  console.log('\n5. Advanced Filtering:');

  // Time-based filtering
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const timeFilterResult = await eventStore.readEvents('high-volume-stream', {
    fromTimestamp: oneHourAgo,
    eventTypes: ['HighVolumeEvent'],
    pageSize: 500,
  });

  if (timeFilterResult.isSuccess()) {
    console.log(
      `  Events from last hour: ${timeFilterResult.value.events.length}`
    );
    console.log(
      `  Query duration: ${Math.round(timeFilterResult.value.duration)}ms`
    );
  }

  // Correlation-based filtering
  const correlationId = 'batch-operation-123';
  const correlationEvents = [];

  for (let i = 0; i < 100; i++) {
    const event = new HighVolumeEvent(
      EntityId.createUuid(),
      `correlated-event-${i}`,
      { correlationTest: true }
    );
    event.correlationId = correlationId;
    correlationEvents.push(event);
  }

  await eventStore.appendEvents('correlation-stream', correlationEvents);

  const correlationResult = await eventStore.readEvents('correlation-stream', {
    correlationId,
    pageSize: 1000,
  });

  if (correlationResult.isSuccess()) {
    console.log(
      `  Correlated events found: ${correlationResult.value.events.length}`
    );
  }

  // ⭐ FOCUS: 6. Memory and resource utilization
  console.log('\n6. Resource Utilization:');
  console.log(
    `  Process memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
  );
  console.log(`  Process uptime: ${Math.round(process.uptime())}s`);

  // ⭐ FOCUS: 7. Performance benchmark summary
  console.log('\n7. Performance Benchmark Summary:');
  console.log(
    `  Total events processed: ${events.length + correlationEvents.length}`
  );
  console.log(
    `  Average append latency: ${Math.round(appendDuration / events.length)}ms per event`
  );
  console.log(
    `  Peak throughput achieved: ${Math.round(appendResult.isSuccess() ? appendResult.value.throughput : 0)} events/sec`
  );
  console.log(
    `  Cache efficiency: ${performanceStatus.cacheHitRate > 0.8 ? 'Excellent' : performanceStatus.cacheHitRate > 0.6 ? 'Good' : 'Needs optimization'}`
  );
}

// Sample high-volume event
class HighVolumeEvent extends DomainEvent {
  constructor(
    aggregateId: EntityId,
    public readonly eventName: string,
    public readonly eventData: any
  ) {
    super(aggregateId, 'HighVolumeEvent', 1);
  }
}

// Run the demonstration
demonstrateHighPerformanceEventStore().catch(console.error);
```

## Key Features

- **Intelligent Caching**: Multi-level caching with access pattern optimization
- **Stream Partitioning**: Automatic partitioning for large streams
- **Concurrent Processing**: Controlled concurrency with semaphores
- **Batch Operations**: Optimized batch processing for high throughput
- **Compression**: Dynamic compression for large events
- **Performance Monitoring**: Real-time performance metrics and tuning
- **Predictive Prefetching**: AI-driven cache warming strategies

## Performance Optimizations

1. **Serialization**: Optimized serialization with selective compression
2. **Memory Management**: Intelligent cache eviction and memory optimization
3. **I/O Efficiency**: Batch operations and parallel processing
4. **CPU Utilization**: Optimized algorithms and data structures
5. **Network Optimization**: Reduced payload sizes through compression
6. **Concurrency Control**: Optimal thread/promise management

## Advanced Features

- **Dynamic Tuning**: Self-adjusting performance parameters
- **Access Pattern Analysis**: Learning from usage patterns
- **Resource Monitoring**: Automatic resource utilization tracking
- **Bottleneck Detection**: Proactive performance issue identification
- **Scalability Planning**: Performance projection and capacity planning

## Performance Metrics

- **Throughput**: Events processed per second
- **Latency**: Average response times for operations
- **Cache Hit Rate**: Effectiveness of caching strategies
- **Error Rate**: System reliability metrics
- **Resource Utilization**: CPU, memory, and I/O efficiency
- **Concurrency**: Parallel operation effectiveness

## Common Pitfalls

- **Memory Leaks**: Monitor cache growth and implement proper eviction
- **CPU Saturation**: Balance processing load across available cores
- **I/O Bottlenecks**: Optimize disk and network operations
- **Cache Coherency**: Ensure cache invalidation strategies are correct
- **Resource Contention**: Prevent deadlocks in concurrent operations

## Related Examples

- [Distributed Event Sourcing](./example-1.md)
- [Event Store Clustering](./example-3.md)
- [Event Versioning and Migration](../intermediate/example-3.md)
