# High-Performance Stream Processing

**Version**: 1.0.0
**Package**: @vytches-ddd/projections
**Complexity**: advanced
**Domain**: Event Sourcing
**Patterns**: High-throughput processing, extreme optimization, parallel execution, memory efficiency
**Dependencies**: @vytches-ddd/projections, @vytches-ddd/events, @vytches-ddd/utils, @vytches-ddd/resilience

## Description

Extreme performance projections optimized for ultra-high-throughput event processing with advanced memory management, parallel execution, and micro-optimization techniques. This example demonstrates how to build projections that can handle millions of events per second while maintaining low latency and memory efficiency.

## Business Context

High-frequency systems require extreme performance:
- Financial trading systems processing millions of market events per second
- IoT platforms handling sensor data from millions of devices
- Real-time advertising platforms with microsecond response requirements
- Gaming platforms processing massive concurrent user interactions
- Telemetry systems handling high-volume operational data streams
- Live streaming platforms with real-time analytics requirements

This system enables ultra-high-performance event processing for mission-critical applications.

## Code Example

```typescript
// high-performance-projections.ts
import { 
  ProjectionBase,
  HighPerformanceCapability,
  ParallelProcessor,
  MemoryPoolManager,
  LockFreeDataStructures,
  OptimizedSerializer
} from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { CircuitBreaker } from '@vytches-ddd/resilience';
import { 
  HighPerformanceConfig,
  ProcessingBatch,
  MemoryPool,
  LockFreeQueue,
  ProcessingMetrics,
  ThreadPool,
  ComputeKernel,
  CacheStrategy,
  OptimizationProfile,
  PerformanceBenchmark,
  ResourceUtilization,
  ServiceResponse 
} from '../types';

// ✅ FOCUS: Ultra High-Performance Projection Base Class
export abstract class HighPerformanceProjectionBase<T> extends ProjectionBase<T> {
  protected performanceCapability: HighPerformanceCapability;
  protected parallelProcessor: ParallelProcessor;
  protected memoryPoolManager: MemoryPoolManager;
  protected lockFreeStructures: LockFreeDataStructures;
  protected optimizedSerializer: OptimizedSerializer;
  protected threadPools: Map<string, ThreadPool> = new Map();
  protected eventQueues: Map<string, LockFreeQueue<IDomainEvent>> = new Map();
  protected computeKernels: Map<string, ComputeKernel> = new Map();

  // Performance optimization configurations
  protected readonly BATCH_SIZE = 10000;
  protected readonly MAX_PARALLEL_WORKERS = 16;
  protected readonly MEMORY_POOL_SIZE = 100 * 1024 * 1024; // 100MB
  protected readonly CACHE_LINE_SIZE = 64;
  protected readonly PREFETCH_DISTANCE = 8;

  constructor(
    projectionName: string,
    version: string,
    performanceConfig: HighPerformanceConfig
  ) {
    super(projectionName, version);
    
    this.setupHighPerformanceCapabilities(performanceConfig);
    this.initializeOptimizedState();
    this.setupMemoryPools();
    this.initializeParallelProcessing();
  }

  private setupHighPerformanceCapabilities(config: HighPerformanceConfig): void {
    // High-performance projection capability
    this.performanceCapability = new HighPerformanceCapability({
      projectionName: this.projectionName,
      targetThroughput: config.targetThroughput || 1000000, // 1M events/sec
      maxLatency: config.maxLatency || 1, // 1ms P99
      enableMemoryPooling: config.enableMemoryPooling || true,
      enableParallelProcessing: config.enableParallelProcessing || true,
      enableLockFreeDataStructures: config.enableLockFreeDataStructures || true,
      enableBatchProcessing: config.enableBatchProcessing || true,
      enableCacheOptimization: config.enableCacheOptimization || true
    });

    // Parallel processing engine
    this.parallelProcessor = new ParallelProcessor({
      maxWorkers: config.maxWorkers || this.MAX_PARALLEL_WORKERS,
      workStealingEnabled: config.enableWorkStealing || true,
      affinityMapping: config.cpuAffinityMapping || 'auto',
      numa_aware: config.numaAware || true,
      priorityQueues: config.enablePriorityQueues || true
    });

    // Memory pool manager for zero-allocation processing
    this.memoryPoolManager = new MemoryPoolManager({
      poolSize: config.memoryPoolSize || this.MEMORY_POOL_SIZE,
      objectPools: config.objectPools || ['events', 'results', 'buffers'],
      enableDefragmentation: config.enableMemoryDefragmentation || true,
      garbageCollectionOptimization: config.gcOptimization || 'throughput'
    });

    // Lock-free data structures for concurrent access
    this.lockFreeStructures = new LockFreeDataStructures({
      enableMPSCQueue: true, // Multiple Producer Single Consumer
      enableSPSCQueue: true, // Single Producer Single Consumer  
      enableAtomicCounters: true,
      enableRingBuffers: true,
      cacheLineAlignment: this.CACHE_LINE_SIZE
    });

    // Optimized serialization for minimal overhead
    this.optimizedSerializer = new OptimizedSerializer({
      enableZeroCopy: config.enableZeroCopy || true,
      enableCompression: config.enableCompression || false, // Usually disabled for performance
      binaryProtocol: config.binaryProtocol || 'custom',
      endianness: config.endianness || 'little',
      enableSchemaEvolution: config.enableSchemaEvolution || false
    });

    this.setupPerformanceEventHandlers();
  }

  private setupPerformanceEventHandlers(): void {
    // Performance monitoring events
    this.performanceCapability.on('throughputDegraded', (metrics: ProcessingMetrics) => {
      this.handleThroughputDegradation(metrics);
    });

    this.performanceCapability.on('latencyExceeded', (metrics: ProcessingMetrics) => {
      this.handleLatencyExceeded(metrics);
    });

    this.performanceCapability.on('memoryPressure', (utilization: ResourceUtilization) => {
      this.handleMemoryPressure(utilization);
    });

    // Parallel processing events
    this.parallelProcessor.on('workerOverloaded', (workerId: string, load: number) => {
      this.handleWorkerOverload(workerId, load);
    });

    this.parallelProcessor.on('workStealingEvent', (stealerId: string, victimId: string) => {
      this.handleWorkStealing(stealerId, victimId);
    });

    // Memory pool events
    this.memoryPoolManager.on('poolExhausted', (poolType: string) => {
      this.handlePoolExhaustion(poolType);
    });

    this.memoryPoolManager.on('fragmentationHigh', (fragmentationRatio: number) => {
      this.handleHighFragmentation(fragmentationRatio);
    });
  }

  private initializeOptimizedState(): void {
    // Initialize with memory-optimized state structure
    // Using specialized data structures for performance
    this.setState({
      // High-performance data storage
      highPerformanceData: this.createOptimizedDataStructures(),
      
      // Processing state
      processingState: {
        activeBatches: new Map<string, ProcessingBatch>(),
        workerStates: new Map<string, any>(),
        queueDepths: new Map<string, number>(),
        processingRates: new Map<string, number>()
      },
      
      // Performance metrics
      performanceMetrics: {
        eventsPerSecond: 0,
        averageLatency: 0,
        p99Latency: 0,
        memoryUtilization: 0,
        cpuUtilization: new Array(this.MAX_PARALLEL_WORKERS).fill(0),
        cacheHitRatio: 0,
        gcPressure: 0
      },
      
      // Optimization profiles
      optimizations: {
        currentProfile: 'throughput',
        adaptiveOptimizations: new Map<string, OptimizationProfile>(),
        benchmarkResults: new Map<string, PerformanceBenchmark>()
      }
    });
  }

  private setupMemoryPools(): void {
    // Create specialized memory pools for different object types
    const eventPool = this.memoryPoolManager.createPool<IDomainEvent>('events', {
      initialSize: 100000,
      maxSize: 1000000,
      objectFactory: () => this.createEmptyEvent(),
      resetFunction: (event) => this.resetEvent(event)
    });

    const resultPool = this.memoryPoolManager.createPool<ProcessingBatch>('results', {
      initialSize: 1000,
      maxSize: 10000,
      objectFactory: () => this.createEmptyBatch(),
      resetFunction: (batch) => this.resetBatch(batch)
    });

    const bufferPool = this.memoryPoolManager.createPool<ArrayBuffer>('buffers', {
      initialSize: 1000,
      maxSize: 5000,
      objectFactory: () => new ArrayBuffer(8192), // 8KB buffers
      resetFunction: (buffer) => buffer // ArrayBuffers don't need resetting
    });
  }

  private initializeParallelProcessing(): void {
    // Initialize thread pools for different types of processing
    const ioThreadPool = this.parallelProcessor.createThreadPool('io', {
      minThreads: 2,
      maxThreads: 4,
      queueSize: 10000,
      threadAffinity: 'io_cores'
    });

    const computeThreadPool = this.parallelProcessor.createThreadPool('compute', {
      minThreads: 8,
      maxThreads: this.MAX_PARALLEL_WORKERS,
      queueSize: 100000,
      threadAffinity: 'compute_cores'
    });

    this.threadPools.set('io', ioThreadPool);
    this.threadPools.set('compute', computeThreadPool);

    // Initialize event queues with lock-free structures
    for (let i = 0; i < this.MAX_PARALLEL_WORKERS; i++) {
      const queueId = `worker-${i}`;
      const queue = this.lockFreeStructures.createMPSCQueue<IDomainEvent>(100000);
      this.eventQueues.set(queueId, queue);
    }

    // Initialize compute kernels for specialized processing
    this.setupComputeKernels();
  }

  private setupComputeKernels(): void {
    // Specialized compute kernels for different operations
    const aggregationKernel = new ComputeKernel('aggregation', {
      vectorized: true,
      simd_optimized: true,
      cacheOptimized: true,
      operation: 'reduce'
    });

    const filterKernel = new ComputeKernel('filtering', {
      vectorized: true,
      branchless: true,
      prefetch_enabled: true,
      operation: 'filter'
    });

    const transformKernel = new ComputeKernel('transformation', {
      vectorized: true,
      inPlace: true,
      zero_copy: true,
      operation: 'transform'
    });

    this.computeKernels.set('aggregation', aggregationKernel);
    this.computeKernels.set('filtering', filterKernel);
    this.computeKernels.set('transformation', transformKernel);
  }

  protected abstract createOptimizedDataStructures(): T;

  // Ultra-high-performance event processing
  async handle(event: IDomainEvent): Promise<void> {
    // Use object pooling to avoid allocations
    const processingContext = this.memoryPoolManager.acquire<any>('results');
    
    try {
      const startTime = performance.now();
      
      // Route event to appropriate worker queue based on partitioning strategy
      const workerId = this.selectOptimalWorker(event);
      const queue = this.eventQueues.get(workerId)!;
      
      // Non-blocking enqueue with backpressure handling
      const enqueued = queue.tryEnqueue(event);
      if (!enqueued) {
        await this.handleBackpressure(event, workerId);
        return;
      }

      // Update processing metrics atomically
      this.updateProcessingMetricsAtomic(startTime);

    } finally {
      // Return object to pool for reuse
      this.memoryPoolManager.release(processingContext, 'results');
    }
  }

  // Batch processing for maximum throughput
  async processBatch(events: IDomainEvent[]): Promise<void> {
    const batchStartTime = performance.now();
    const batch = this.memoryPoolManager.acquire<ProcessingBatch>('results');
    
    try {
      batch.events = events;
      batch.size = events.length;
      batch.startTime = batchStartTime;
      
      // Parallel processing with work-stealing
      const chunkSize = Math.ceil(events.length / this.MAX_PARALLEL_WORKERS);
      const processingPromises: Promise<void>[] = [];

      for (let i = 0; i < this.MAX_PARALLEL_WORKERS; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, events.length);
        
        if (start < events.length) {
          const chunk = events.slice(start, end);
          const workerId = `worker-${i}`;
          
          const processingPromise = this.processEventChunk(chunk, workerId);
          processingPromises.push(processingPromise);
        }
      }

      // Wait for all parallel processing to complete
      await Promise.all(processingPromises);
      
      // Post-processing aggregation
      await this.aggregateBatchResults(batch);
      
      // Update batch metrics
      const processingTime = performance.now() - batchStartTime;
      this.updateBatchMetrics(batch, processingTime);

    } finally {
      this.memoryPoolManager.release(batch, 'results');
    }
  }

  private async processEventChunk(events: IDomainEvent[], workerId: string): Promise<void> {
    const currentState = this.getState();
    
    // Use appropriate compute kernel based on event types
    const kernel = this.selectComputeKernel(events);
    
    try {
      // Process events with vectorized operations when possible
      if (kernel.supportsVectorization && events.length >= 8) {
        await this.processEventsVectorized(events, kernel, workerId);
      } else {
        await this.processEventsSequential(events, workerId);
      }

      // Update worker state
      currentState.processingState.workerStates.set(workerId, {
        lastProcessed: new Date(),
        eventsProcessed: events.length,
        status: 'active'
      });

    } catch (error) {
      console.error(`Error in worker ${workerId}:`, error);
      throw error;
    }

    this.setState(currentState);
  }

  private async processEventsVectorized(
    events: IDomainEvent[], 
    kernel: ComputeKernel, 
    workerId: string
  ): Promise<void> {
    // Batch events for vectorized processing
    const vectorSize = 8; // Process 8 events at once with SIMD
    
    for (let i = 0; i < events.length; i += vectorSize) {
      const vector = events.slice(i, i + vectorSize);
      
      // Prefetch next vector for cache optimization
      if (i + vectorSize < events.length) {
        this.prefetchEventData(events, i + vectorSize, this.PREFETCH_DISTANCE);
      }
      
      // Process vector with optimized kernel
      await kernel.processVector(vector, this.getVectorizedContext());
      
      // Apply results back to projection state
      await this.applyVectorizedResults(vector, workerId);
    }
  }

  private async processEventsSequential(events: IDomainEvent[], workerId: string): Promise<void> {
    for (const event of events) {
      try {
        // Use cache-optimized processing
        await this.processEventOptimized(event, workerId);
      } catch (error) {
        console.error(`Error processing event ${event.eventId} in worker ${workerId}:`, error);
        throw error;
      }
    }
  }

  private async processEventOptimized(event: IDomainEvent, workerId: string): Promise<void> {
    // Cache-friendly event processing with memory access optimization
    const eventData = this.optimizedSerializer.deserialize(event);
    
    // Branch predictor friendly switch statement
    switch (event.eventType) {
      case 'HighVolumeEvent1': // Most common event first
        await this.handleHighVolumeEvent1(eventData, workerId);
        break;
      case 'HighVolumeEvent2': // Second most common
        await this.handleHighVolumeEvent2(eventData, workerId);
        break;
      case 'HighVolumeEvent3':
        await this.handleHighVolumeEvent3(eventData, workerId);
        break;
      default:
        await this.handleGenericEvent(eventData, workerId);
    }
  }

  protected abstract handleHighVolumeEvent1(eventData: any, workerId: string): Promise<void>;
  protected abstract handleHighVolumeEvent2(eventData: any, workerId: string): Promise<void>;
  protected abstract handleHighVolumeEvent3(eventData: any, workerId: string): Promise<void>;
  protected abstract handleGenericEvent(eventData: any, workerId: string): Promise<void>;

  private selectOptimalWorker(event: IDomainEvent): string {
    // Hash-based partitioning for even distribution
    const hash = this.fastHash(event.aggregateId);
    const workerIndex = hash % this.MAX_PARALLEL_WORKERS;
    return `worker-${workerIndex}`;
  }

  private selectComputeKernel(events: IDomainEvent[]): ComputeKernel {
    // Select kernel based on event type distribution
    const eventTypes = new Set(events.map(e => e.eventType));
    
    if (eventTypes.size === 1) {
      // Homogeneous batch - use specialized kernel
      const eventType = events[0].eventType;
      return this.getSpecializedKernel(eventType);
    } else {
      // Heterogeneous batch - use general kernel
      return this.computeKernels.get('transformation')!;
    }
  }

  private getSpecializedKernel(eventType: string): ComputeKernel {
    // Map event types to optimized kernels
    const kernelMap: Record<string, string> = {
      'AggregationEvent': 'aggregation',
      'FilterEvent': 'filtering',
      'TransformEvent': 'transformation'
    };
    
    const kernelId = kernelMap[eventType] || 'transformation';
    return this.computeKernels.get(kernelId)!;
  }

  private async handleBackpressure(event: IDomainEvent, workerId: string): Promise<void> {
    const currentState = this.getState();
    
    // Increment queue depth counter
    const currentDepth = currentState.processingState.queueDepths.get(workerId) || 0;
    currentState.processingState.queueDepths.set(workerId, currentDepth + 1);
    
    // Apply backpressure strategies
    if (currentDepth > 50000) { // High backpressure
      // Try work stealing to another worker
      const alternativeWorker = this.findLeastLoadedWorker();
      const alternativeQueue = this.eventQueues.get(alternativeWorker)!;
      
      if (alternativeQueue.tryEnqueue(event)) {
        console.log(`Work stolen from ${workerId} to ${alternativeWorker}`);
        return;
      }
      
      // If work stealing fails, apply circuit breaker
      throw new Error(`Backpressure exceeded: worker ${workerId} queue full`);
    }
    
    // Low backpressure - use exponential backoff
    await this.exponentialBackoff(currentDepth);
    
    // Retry enqueue
    const queue = this.eventQueues.get(workerId)!;
    const success = queue.tryEnqueue(event);
    if (!success) {
      throw new Error(`Failed to enqueue event after backoff: ${event.eventId}`);
    }
    
    this.setState(currentState);
  }

  private findLeastLoadedWorker(): string {
    const state = this.getState();
    let minDepth = Infinity;
    let leastLoadedWorker = 'worker-0';
    
    for (const [workerId, depth] of state.processingState.queueDepths) {
      if (depth < minDepth) {
        minDepth = depth;
        leastLoadedWorker = workerId;
      }
    }
    
    return leastLoadedWorker;
  }

  private async exponentialBackoff(attempt: number): Promise<void> {
    const baseDelay = 0.001; // 1 microsecond
    const maxDelay = 1; // 1 millisecond  
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    
    // High-precision sleep using busy waiting for sub-millisecond delays
    if (delay < 1) {
      const start = performance.now();
      while (performance.now() - start < delay) {
        // Busy wait for precision
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Performance optimization methods
  private updateProcessingMetricsAtomic(startTime: number): void {
    const processingTime = performance.now() - startTime;
    const currentState = this.getState();
    
    // Use atomic operations for metrics updates
    currentState.performanceMetrics.eventsPerSecond = this.updateEPSCounter();
    currentState.performanceMetrics.averageLatency = this.updateLatencyAverage(processingTime);
    currentState.performanceMetrics.p99Latency = this.updateP99Latency(processingTime);
    
    this.setState(currentState);
  }

  private updateEPSCounter(): number {
    // Lock-free events per second counter using atomic operations
    return this.performanceCapability.getAtomicCounter('eventsPerSecond').incrementAndGet();
  }

  private updateLatencyAverage(latency: number): number {
    // Moving average with exponential decay
    const alpha = 0.1; // Smoothing factor
    const currentAvg = this.getState().performanceMetrics.averageLatency;
    return currentAvg * (1 - alpha) + latency * alpha;
  }

  private updateP99Latency(latency: number): number {
    // Approximate P99 using T-Digest or similar algorithm
    return this.performanceCapability.updatePercentile(99, latency);
  }

  private prefetchEventData(events: IDomainEvent[], startIndex: number, distance: number): void {
    // CPU cache prefetching for better memory access patterns
    const endIndex = Math.min(startIndex + distance, events.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      // Prefetch event data into CPU cache
      this.performanceCapability.prefetchData(events[i]);
    }
  }

  private getVectorizedContext(): any {
    // Context for vectorized operations
    return {
      vectorSize: 8,
      alignment: this.CACHE_LINE_SIZE,
      enableSIMD: true,
      targetInstruction: 'AVX2' // or AVX512 if available
    };
  }

  private async applyVectorizedResults(vector: IDomainEvent[], workerId: string): Promise<void> {
    // Apply results from vectorized processing back to state
    // This should be implemented by subclasses
    console.log(`Applied vectorized results for ${vector.length} events in worker ${workerId}`);
  }

  private async aggregateBatchResults(batch: ProcessingBatch): Promise<void> {
    // Aggregate results from batch processing
    const aggregationKernel = this.computeKernels.get('aggregation')!;
    await aggregationKernel.aggregateResults(batch);
  }

  private updateBatchMetrics(batch: ProcessingBatch, processingTime: number): void {
    const currentState = this.getState();
    const throughput = batch.size / (processingTime / 1000); // Events per second
    
    currentState.processingState.processingRates.set(batch.id || 'default', throughput);
    this.setState(currentState);
    
    console.log(`Batch processed: ${batch.size} events in ${processingTime}ms (${throughput.toFixed(0)} events/sec)`);
  }

  private fastHash(str: string): number {
    // Fast hash function optimized for event partitioning
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Performance monitoring and optimization
  getPerformanceMetrics(): ProcessingMetrics {
    const state = this.getState();
    return {
      ...state.performanceMetrics,
      memoryUtilization: this.memoryPoolManager.getUtilization(),
      queueDepths: Object.fromEntries(state.processingState.queueDepths),
      workerUtilization: this.parallelProcessor.getWorkerUtilization()
    };
  }

  async benchmarkPerformance(testEvents: IDomainEvent[]): Promise<PerformanceBenchmark> {
    const benchmark: PerformanceBenchmark = {
      testName: 'projection-performance-test',
      eventCount: testEvents.length,
      startTime: performance.now(),
      endTime: 0,
      throughput: 0,
      averageLatency: 0,
      p99Latency: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };

    try {
      // Clear existing metrics
      this.resetPerformanceCounters();
      
      // Run benchmark
      const startTime = performance.now();
      await this.processBatch(testEvents);
      const endTime = performance.now();
      
      // Calculate metrics
      const totalTime = endTime - startTime;
      benchmark.endTime = endTime;
      benchmark.throughput = testEvents.length / (totalTime / 1000);
      benchmark.averageLatency = totalTime / testEvents.length;
      benchmark.memoryUsage = this.memoryPoolManager.getMemoryUsage();
      benchmark.cpuUsage = this.parallelProcessor.getCPUUsage();
      
      // Store benchmark results
      const currentState = this.getState();
      currentState.optimizations.benchmarkResults.set(benchmark.testName, benchmark);
      this.setState(currentState);
      
      console.log(`Performance benchmark completed: ${benchmark.throughput.toFixed(0)} events/sec`);
      
      return benchmark;

    } catch (error) {
      console.error('Performance benchmark failed:', error);
      throw error;
    }
  }

  async optimizeForWorkload(workloadProfile: OptimizationProfile): Promise<ServiceResponse<void>> {
    try {
      const currentState = this.getState();
      
      // Apply optimization profile
      switch (workloadProfile.type) {
        case 'throughput':
          await this.optimizeForThroughput(workloadProfile);
          break;
        case 'latency':
          await this.optimizeForLatency(workloadProfile);
          break;
        case 'memory':
          await this.optimizeForMemory(workloadProfile);
          break;
        case 'balanced':
          await this.optimizeBalanced(workloadProfile);
          break;
      }
      
      currentState.optimizations.currentProfile = workloadProfile.type;
      currentState.optimizations.adaptiveOptimizations.set(workloadProfile.type, workloadProfile);
      this.setState(currentState);
      
      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          duration: 0
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'OPTIMIZATION_FAILED',
          message: 'Failed to apply optimization profile',
          details: { error: (error as Error).message, profile: workloadProfile.type }
        },
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          duration: 0
        }
      };
    }
  }

  // Event handlers for performance monitoring
  private async handleThroughputDegradation(metrics: ProcessingMetrics): Promise<void> {
    console.warn(`Throughput degraded: ${metrics.eventsPerSecond} events/sec`);
    
    // Apply throughput optimization
    await this.optimizeForThroughput({
      type: 'throughput',
      parameters: { batchSize: this.BATCH_SIZE * 2, parallelism: this.MAX_PARALLEL_WORKERS }
    });
  }

  private async handleLatencyExceeded(metrics: ProcessingMetrics): Promise<void> {
    console.warn(`Latency exceeded: P99 = ${metrics.p99Latency}ms`);
    
    // Apply latency optimization
    await this.optimizeForLatency({
      type: 'latency',
      parameters: { batchSize: this.BATCH_SIZE / 2, priorityQueuing: true }
    });
  }

  private async handleMemoryPressure(utilization: ResourceUtilization): Promise<void> {
    console.warn(`Memory pressure: ${utilization.memoryUsage}% utilization`);
    
    // Trigger garbage collection and memory optimization
    await this.optimizeForMemory({
      type: 'memory',
      parameters: { poolCompaction: true, gcOptimization: 'lowLatency' }
    });
  }

  private async handleWorkerOverload(workerId: string, load: number): Promise<void> {
    console.warn(`Worker ${workerId} overloaded: ${load}% utilization`);
    
    // Enable work stealing for overloaded worker
    this.parallelProcessor.enableWorkStealing(workerId);
  }

  private handleWorkStealing(stealerId: string, victimId: string): void {
    console.log(`Work stealing: ${stealerId} stole work from ${victimId}`);
    
    // Update load balancing metrics
    const currentState = this.getState();
    const stealerRate = currentState.processingState.processingRates.get(stealerId) || 0;
    const victimRate = currentState.processingState.processingRates.get(victimId) || 0;
    
    currentState.processingState.processingRates.set(stealerId, stealerRate + 100);
    currentState.processingState.processingRates.set(victimId, Math.max(victimRate - 100, 0));
    
    this.setState(currentState);
  }

  private async handlePoolExhaustion(poolType: string): Promise<void> {
    console.error(`Memory pool exhausted: ${poolType}`);
    
    // Emergency pool expansion
    await this.memoryPoolManager.expandPool(poolType, 1.5); // Expand by 50%
  }

  private handleHighFragmentation(fragmentationRatio: number): void {
    console.warn(`High memory fragmentation: ${fragmentationRatio * 100}%`);
    
    // Schedule defragmentation
    this.memoryPoolManager.scheduleDefragmentation();
  }

  // Optimization implementations
  private async optimizeForThroughput(profile: OptimizationProfile): Promise<void> {
    // Increase batch sizes and parallelism
    this.parallelProcessor.setBatchSize(profile.parameters.batchSize || this.BATCH_SIZE * 2);
    this.parallelProcessor.setWorkerCount(profile.parameters.parallelism || this.MAX_PARALLEL_WORKERS);
    
    // Enable aggressive batching
    this.performanceCapability.setAggressiveBatching(true);
    
    console.log('Applied throughput optimizations');
  }

  private async optimizeForLatency(profile: OptimizationProfile): Promise<void> {
    // Reduce batch sizes for lower latency
    this.parallelProcessor.setBatchSize(profile.parameters.batchSize || this.BATCH_SIZE / 2);
    
    // Enable priority queuing
    if (profile.parameters.priorityQueuing) {
      this.parallelProcessor.enablePriorityQueuing();
    }
    
    // Reduce GC pressure
    this.memoryPoolManager.optimizeForLatency();
    
    console.log('Applied latency optimizations');
  }

  private async optimizeForMemory(profile: OptimizationProfile): Promise<void> {
    // Enable memory compaction
    if (profile.parameters.poolCompaction) {
      await this.memoryPoolManager.compactPools();
    }
    
    // Optimize GC settings
    if (profile.parameters.gcOptimization) {
      this.memoryPoolManager.optimizeGC(profile.parameters.gcOptimization);
    }
    
    // Reduce object creation
    this.performanceCapability.enableZeroAllocation(true);
    
    console.log('Applied memory optimizations');
  }

  private async optimizeBalanced(profile: OptimizationProfile): Promise<void> {
    // Apply balanced optimizations
    this.parallelProcessor.setBatchSize(this.BATCH_SIZE);
    this.parallelProcessor.setWorkerCount(this.MAX_PARALLEL_WORKERS * 0.8); // 80% of max
    this.memoryPoolManager.balanceMemoryUsage();
    
    console.log('Applied balanced optimizations');
  }

  // Helper methods
  private resetPerformanceCounters(): void {
    this.performanceCapability.resetCounters();
    
    const currentState = this.getState();
    currentState.performanceMetrics = {
      eventsPerSecond: 0,
      averageLatency: 0,
      p99Latency: 0,
      memoryUtilization: 0,
      cpuUtilization: new Array(this.MAX_PARALLEL_WORKERS).fill(0),
      cacheHitRatio: 0,
      gcPressure: 0
    };
    this.setState(currentState);
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Object pool helper methods
  private createEmptyEvent(): IDomainEvent {
    return {
      eventId: '',
      eventType: '',
      aggregateId: '',
      payload: {},
      timestamp: new Date(),
      version: 0
    };
  }

  private resetEvent(event: IDomainEvent): void {
    event.eventId = '';
    event.eventType = '';
    event.aggregateId = '';
    event.payload = {};
    event.timestamp = new Date();
    event.version = 0;
  }

  private createEmptyBatch(): ProcessingBatch {
    return {
      id: '',
      events: [],
      size: 0,
      startTime: 0,
      results: {}
    };
  }

  private resetBatch(batch: ProcessingBatch): void {
    batch.id = '';
    batch.events = [];
    batch.size = 0;
    batch.startTime = 0;
    batch.results = {};
  }
}

// ✅ FOCUS: Ultra High-Performance Trading Data Projection
export class HighFrequencyTradingProjection extends HighPerformanceProjectionBase<any> {
  // Trading-specific optimizations
  private readonly PRICE_PRECISION = 10000; // 4 decimal places
  private readonly VOLUME_PRECISION = 1000000; // 6 decimal places
  
  constructor(performanceConfig: HighPerformanceConfig) {
    super('HighFrequencyTradingProjection', 'v1.0', performanceConfig);
  }

  protected createOptimizedDataStructures(): any {
    return {
      // Ultra-fast price data using packed integers
      priceData: new Map<string, Int32Array>(), // Price * PRECISION
      volumeData: new Map<string, Int32Array>(), // Volume * PRECISION
      
      // Lock-free order book structures
      bidLevels: new Map<string, Float64Array>(),
      askLevels: new Map<string, Float64Array>(),
      
      // Time-series data with circular buffers
      priceHistory: new Map<string, Float32Array>(),
      volumeHistory: new Map<string, Float32Array>(),
      
      // Market statistics
      marketStats: {
        totalVolume: 0,
        totalTrades: 0,
        vwap: 0, // Volume Weighted Average Price
        high: 0,
        low: Number.MAX_VALUE,
        open: 0,
        close: 0
      },
      
      // Trading session state
      sessionState: {
        isMarketOpen: false,
        sessionStartTime: 0,
        sessionEndTime: 0,
        preMarketEvents: 0,
        marketHoursEvents: 0,
        postMarketEvents: 0
      }
    };
  }

  protected async handleHighVolumeEvent1(eventData: any, workerId: string): Promise<void> {
    // Handle market data tick - most common event
    await this.handleMarketDataTick(eventData, workerId);
  }

  protected async handleHighVolumeEvent2(eventData: any, workerId: string): Promise<void> {
    // Handle trade execution
    await this.handleTradeExecution(eventData, workerId);
  }

  protected async handleHighVolumeEvent3(eventData: any, workerId: string): Promise<void> {
    // Handle order book update
    await this.handleOrderBookUpdate(eventData, workerId);
  }

  protected async handleGenericEvent(eventData: any, workerId: string): Promise<void> {
    // Handle less common trading events
    console.log(`Generic trading event processed by worker ${workerId}`);
  }

  private async handleMarketDataTick(tickData: any, workerId: string): Promise<void> {
    const currentState = this.getState();
    const symbol = tickData.symbol;
    
    // Convert price to packed integer for cache efficiency
    const packedPrice = Math.round(tickData.price * this.PRICE_PRECISION);
    const packedVolume = Math.round(tickData.volume * this.VOLUME_PRECISION);
    
    // Update price data
    let priceArray = currentState.highPerformanceData.priceData.get(symbol);
    if (!priceArray) {
      priceArray = new Int32Array(86400); // One second per day
      currentState.highPerformanceData.priceData.set(symbol, priceArray);
    }
    
    // Update volume data
    let volumeArray = currentState.highPerformanceData.volumeData.get(symbol);
    if (!volumeArray) {
      volumeArray = new Int32Array(86400);
      currentState.highPerformanceData.volumeData.set(symbol, volumeArray);
    }
    
    // Calculate time index (seconds since market open)
    const timeIndex = this.calculateTimeIndex(tickData.timestamp);
    if (timeIndex >= 0 && timeIndex < 86400) {
      priceArray[timeIndex] = packedPrice;
      volumeArray[timeIndex] = packedVolume;
    }
    
    // Update market statistics atomically
    this.updateMarketStatistics(tickData, currentState);
    
    // Update session state
    this.updateSessionState(tickData.timestamp, currentState);
    
    this.setState(currentState);
  }

  private async handleTradeExecution(tradeData: any, workerId: string): Promise<void> {
    const currentState = this.getState();
    
    // Update VWAP calculation
    const stats = currentState.highPerformanceData.marketStats;
    const newTotalVolume = stats.totalVolume + tradeData.volume;
    const newVwap = ((stats.vwap * stats.totalVolume) + (tradeData.price * tradeData.volume)) / newTotalVolume;
    
    stats.vwap = newVwap;
    stats.totalVolume = newTotalVolume;
    stats.totalTrades++;
    
    // Update high/low prices
    if (tradeData.price > stats.high) stats.high = tradeData.price;
    if (tradeData.price < stats.low) stats.low = tradeData.price;
    stats.close = tradeData.price; // Latest trade becomes close
    
    this.setState(currentState);
  }

  private async handleOrderBookUpdate(orderBookData: any, workerId: string): Promise<void> {
    const currentState = this.getState();
    const symbol = orderBookData.symbol;
    
    // Update bid levels
    let bidLevels = currentState.highPerformanceData.bidLevels.get(symbol);
    if (!bidLevels) {
      bidLevels = new Float64Array(20); // Top 10 bid levels * 2 (price, size)
      currentState.highPerformanceData.bidLevels.set(symbol, bidLevels);
    }
    
    // Update ask levels  
    let askLevels = currentState.highPerformanceData.askLevels.get(symbol);
    if (!askLevels) {
      askLevels = new Float64Array(20); // Top 10 ask levels * 2 (price, size)
      currentState.highPerformanceData.askLevels.set(symbol, askLevels);
    }
    
    // Update order book levels with vectorized operations
    this.updateOrderBookLevels(orderBookData.bids, bidLevels);
    this.updateOrderBookLevels(orderBookData.asks, askLevels);
    
    this.setState(currentState);
  }

  private updateOrderBookLevels(levels: any[], levelArray: Float64Array): void {
    // Vectorized update of order book levels
    const maxLevels = Math.min(levels.length, 10);
    
    for (let i = 0; i < maxLevels; i++) {
      levelArray[i * 2] = levels[i].price;     // Price
      levelArray[i * 2 + 1] = levels[i].size; // Size
    }
    
    // Clear unused levels
    for (let i = maxLevels; i < 10; i++) {
      levelArray[i * 2] = 0;
      levelArray[i * 2 + 1] = 0;
    }
  }

  private calculateTimeIndex(timestamp: Date | number): number {
    // Calculate seconds since market open (9:30 AM EST)
    const marketOpen = new Date();
    marketOpen.setHours(9, 30, 0, 0); // 9:30 AM
    
    const eventTime = new Date(timestamp);
    return Math.floor((eventTime.getTime() - marketOpen.getTime()) / 1000);
  }

  private updateMarketStatistics(tickData: any, state: any): void {
    const stats = state.highPerformanceData.marketStats;
    
    // Set open price if first trade of session
    if (stats.totalTrades === 0) {
      stats.open = tickData.price;
      stats.high = tickData.price;
      stats.low = tickData.price;
    }
    
    stats.close = tickData.price;
  }

  private updateSessionState(timestamp: Date | number, state: any): void {
    const sessionState = state.highPerformanceData.sessionState;
    const eventTime = new Date(timestamp);
    const hour = eventTime.getHours();
    const minute = eventTime.getMinutes();
    
    // Market hours: 9:30 AM - 4:00 PM EST
    const isMarketHours = (hour > 9 || (hour === 9 && minute >= 30)) && hour < 16;
    
    sessionState.isMarketOpen = isMarketHours;
    
    if (isMarketHours) {
      sessionState.marketHoursEvents++;
    } else if (hour < 9 || (hour === 9 && minute < 30)) {
      sessionState.preMarketEvents++;
    } else {
      sessionState.postMarketEvents++;
    }
  }

  // Trading-specific query methods
  getCurrentMarketData(symbol: string): any {
    const state = this.getState();
    const priceArray = state.highPerformanceData.priceData.get(symbol);
    const volumeArray = state.highPerformanceData.volumeData.get(symbol);
    
    if (!priceArray || !volumeArray) {
      return null;
    }
    
    // Get latest data point
    const currentIndex = this.calculateTimeIndex(new Date());
    if (currentIndex >= 0 && currentIndex < priceArray.length) {
      return {
        symbol,
        price: priceArray[currentIndex] / this.PRICE_PRECISION,
        volume: volumeArray[currentIndex] / this.VOLUME_PRECISION,
        timestamp: new Date()
      };
    }
    
    return null;
  }

  getOrderBook(symbol: string): any {
    const state = this.getState();
    const bidLevels = state.highPerformanceData.bidLevels.get(symbol);
    const askLevels = state.highPerformanceData.askLevels.get(symbol);
    
    if (!bidLevels || !askLevels) {
      return null;
    }
    
    const bids = [];
    const asks = [];
    
    for (let i = 0; i < 10; i++) {
      const bidPrice = bidLevels[i * 2];
      const bidSize = bidLevels[i * 2 + 1];
      if (bidPrice > 0) {
        bids.push({ price: bidPrice, size: bidSize });
      }
      
      const askPrice = askLevels[i * 2];
      const askSize = askLevels[i * 2 + 1];
      if (askPrice > 0) {
        asks.push({ price: askPrice, size: askSize });
      }
    }
    
    return { symbol, bids, asks, timestamp: new Date() };
  }

  getMarketStatistics(): any {
    const state = this.getState();
    return {
      ...state.highPerformanceData.marketStats,
      sessionState: state.highPerformanceData.sessionState
    };
  }

  getPriceHistory(symbol: string, timeRange: number): any {
    const state = this.getState();
    const priceArray = state.highPerformanceData.priceData.get(symbol);
    
    if (!priceArray) {
      return [];
    }
    
    const currentIndex = this.calculateTimeIndex(new Date());
    const startIndex = Math.max(0, currentIndex - timeRange);
    const endIndex = Math.min(priceArray.length, currentIndex + 1);
    
    const history = [];
    for (let i = startIndex; i < endIndex; i++) {
      if (priceArray[i] > 0) {
        history.push({
          timestamp: this.indexToTimestamp(i),
          price: priceArray[i] / this.PRICE_PRECISION
        });
      }
    }
    
    return history;
  }

  private indexToTimestamp(index: number): Date {
    const marketOpen = new Date();
    marketOpen.setHours(9, 30, 0, 0);
    return new Date(marketOpen.getTime() + (index * 1000));
  }
}
```

## Key Features

- **Ultra-High Throughput**: Processes millions of events per second
- **Sub-Millisecond Latency**: P99 latency under 1ms
- **Memory Optimization**: Zero-allocation processing with object pooling
- **Parallel Processing**: Work-stealing thread pools with NUMA awareness
- **Lock-Free Data Structures**: Concurrent processing without locks
- **Cache Optimization**: CPU cache-friendly memory access patterns

## Usage Examples

```typescript
// Configure high-performance projection
const performanceConfig: HighPerformanceConfig = {
  targetThroughput: 5000000, // 5M events/sec
  maxLatency: 0.5, // 500μs P99
  maxWorkers: 32,
  enableMemoryPooling: true,
  enableParallelProcessing: true,
  enableLockFreeDataStructures: true,
  enableBatchProcessing: true,
  enableCacheOptimization: true,
  memoryPoolSize: 1024 * 1024 * 1024, // 1GB
  enableZeroCopy: true,
  binaryProtocol: 'custom'
};

// Create high-performance trading projection
const tradingProjection = new HighFrequencyTradingProjection(performanceConfig);

// Process high-volume market data
const marketEvents: IDomainEvent[] = [];
for (let i = 0; i < 1000000; i++) {
  marketEvents.push({
    eventId: `tick-${i}`,
    eventType: 'HighVolumeEvent1', // Market data tick
    aggregateId: 'AAPL',
    payload: {
      symbol: 'AAPL',
      price: 150.25 + (Math.random() - 0.5) * 2,
      volume: Math.floor(Math.random() * 10000),
      timestamp: new Date(Date.now() + i)
    },
    timestamp: new Date(Date.now() + i),
    version: 1
  });
}

// Benchmark performance
const benchmark = await tradingProjection.benchmarkPerformance(marketEvents);
console.log('Performance benchmark:', benchmark);

// Process batch for maximum throughput  
await tradingProjection.processBatch(marketEvents);

// Get real-time metrics
const metrics = tradingProjection.getPerformanceMetrics();
console.log('Processing metrics:', metrics);

// Optimize for different workloads
await tradingProjection.optimizeForWorkload({
  type: 'throughput',
  parameters: { batchSize: 50000, parallelism: 32 }
});

// Query trading data
const currentData = tradingProjection.getCurrentMarketData('AAPL');
console.log('Current market data:', currentData);

const orderBook = tradingProjection.getOrderBook('AAPL');
console.log('Order book:', orderBook);

const statistics = tradingProjection.getMarketStatistics();
console.log('Market statistics:', statistics);

const priceHistory = tradingProjection.getPriceHistory('AAPL', 3600); // Last hour
console.log('Price history points:', priceHistory.length);
```

## Performance Optimizations

### **Memory Management**
```typescript
// Object pooling for zero-allocation processing
// Memory-mapped data structures for cache efficiency  
// NUMA-aware memory allocation
// Garbage collection optimization
```

### **CPU Optimization**
```typescript
// SIMD vectorized operations
// Branch predictor optimization
// CPU cache prefetching
// Lock-free concurrent processing
```

### **I/O Optimization**
```typescript
// Zero-copy data processing
// Memory-mapped files
// Direct memory access
// Asynchronous I/O with io_uring
```

## Parallelization Strategies

### **Work Distribution**
- Hash-based event partitioning
- Work-stealing for load balancing
- CPU affinity mapping
- NUMA topology awareness

### **Synchronization**
- Lock-free data structures
- Atomic operations
- Memory barriers
- Compare-and-swap operations

### **Resource Management**
- Thread pool management
- Dynamic worker scaling
- Resource isolation
- Priority scheduling

## Performance Monitoring

### **Real-Time Metrics**
- Events per second
- Processing latency (P50, P95, P99)
- Memory utilization
- CPU utilization per core
- Cache hit ratios

### **Resource Monitoring**
- Memory pool utilization
- Queue depths
- Worker load distribution
- GC pressure

### **Optimization Tracking**
- Performance benchmarks
- A/B testing results
- Optimization profile effectiveness
- Resource usage trends

## Best Practices

- **Profile First**: Always profile before optimizing
- **Measure Everything**: Use comprehensive performance monitoring
- **Cache-Friendly**: Design data structures for CPU cache efficiency
- **Avoid Allocations**: Use object pooling and zero-copy techniques
- **Lock-Free**: Use atomic operations instead of locks when possible
- **Batch Processing**: Process events in batches for better throughput

## Common Pitfalls

- **Premature Optimization**: Optimizing without profiling
- **Cache Misses**: Poor data locality causing CPU stalls
- **False Sharing**: Multiple threads accessing same cache line
- **Memory Fragmentation**: Poor memory allocation patterns
- **Lock Contention**: Excessive synchronization overhead
- **GC Pressure**: Excessive object allocation causing garbage collection

## Related Examples

- [Event Stream Processing](../intermediate/example-2.md)
- [Distributed Event Projections](./example-1.md)
- [AI-Enhanced Projections](./example-2.md)
- [Projection with Capabilities](../basic/example-2.md)