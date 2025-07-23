# Intermediate Implementation Guide

**Version**: 1.0.0
**Package**: @vytches-ddd/projections
**Complexity**: intermediate
**Domain**: Event Sourcing
**Patterns**: Advanced implementation strategies, production patterns, optimization techniques
**Dependencies**: @vytches-ddd/projections, @vytches-ddd/events, @vytches-ddd/utils

## Description

Comprehensive implementation guide for intermediate projection patterns including rebuilding systems, stream processing, multi-tenancy, performance optimization, and production deployment strategies. This guide provides practical implementation approaches for enterprise-grade projection systems.

## Business Context

Production projection systems require advanced implementation patterns:
- High-performance event processing with minimal latency
- Scalable architectures supporting millions of events
- Multi-tenant isolation and resource management
- Advanced error handling and recovery mechanisms
- Production monitoring and observability
- Deployment strategies for zero-downtime updates

This guide bridges the gap between basic projection concepts and enterprise production requirements.

## Implementation Architecture

```typescript
// advanced-projection-architecture.ts
import { 
  ProjectionBase,
  ProjectionEngine,
  ProjectionCluster,
  ProjectionSharding,
  ProjectionMetrics,
  ProjectionHealthCheck
} from '@vytches-ddd/projections';
import { IDomainEvent, IEventStore } from '@vytches-ddd/events';
import { Result } from '@vytches-ddd/utils';
import { 
  ProjectionConfig,
  ShardingStrategy,
  ClusterConfig,
  HealthCheckConfig,
  PerformanceMetrics,
  ServiceResponse 
} from '../types';

// ✅ FOCUS: Enterprise Projection Architecture
export class EnterpriseProjectionSystem {
  private projectionCluster: ProjectionCluster;
  private shardingStrategy: ProjectionSharding;
  private metricsCollector: ProjectionMetrics;
  private healthChecker: ProjectionHealthCheck;
  private config: ProjectionConfig;

  constructor(config: ProjectionConfig) {
    this.config = config;
    this.setupArchitecture();
  }

  private setupArchitecture(): void {
    // Cluster setup for horizontal scaling
    this.projectionCluster = new ProjectionCluster({
      nodeCount: this.config.cluster.nodeCount,
      leaderElection: this.config.cluster.enableLeaderElection,
      loadBalancing: this.config.cluster.loadBalancingStrategy,
      failoverTimeout: this.config.cluster.failoverTimeout
    });

    // Sharding strategy for data distribution
    this.shardingStrategy = new ProjectionSharding({
      strategy: this.config.sharding.strategy, // 'hash' | 'range' | 'tenant'
      shardCount: this.config.sharding.shardCount,
      replicationFactor: this.config.sharding.replicationFactor,
      consistencyLevel: this.config.sharding.consistencyLevel
    });

    // Metrics collection for monitoring
    this.metricsCollector = new ProjectionMetrics({
      enableRealTimeMetrics: true,
      metricsInterval: this.config.monitoring.metricsInterval,
      retentionPeriod: this.config.monitoring.retentionPeriod,
      exporters: this.config.monitoring.exporters
    });

    // Health checking for operational awareness
    this.healthChecker = new ProjectionHealthCheck({
      checkInterval: this.config.health.checkInterval,
      healthThresholds: this.config.health.thresholds,
      alerting: this.config.health.alerting
    });
  }

  async initialize(): Promise<ServiceResponse<void>> {
    try {
      console.log('Initializing enterprise projection system...');

      // Initialize cluster
      await this.projectionCluster.initialize();
      
      // Setup sharding
      await this.shardingStrategy.initialize();
      
      // Start metrics collection
      await this.metricsCollector.start();
      
      // Start health monitoring
      await this.healthChecker.start();

      console.log('Enterprise projection system initialized successfully');
      
      return { success: true, metadata: { timestamp: new Date(), requestId: 'init', duration: 0 } };
      
    } catch (error) {
      return {
        success: false,
        error: { code: 'INITIALIZATION_FAILED', message: (error as Error).message },
        metadata: { timestamp: new Date(), requestId: 'init', duration: 0 }
      };
    }
  }

  async deployProjection(
    projection: ProjectionBase<any>,
    deploymentStrategy: 'blue-green' | 'rolling' | 'canary' = 'rolling'
  ): Promise<ServiceResponse<void>> {
    try {
      console.log(`Deploying projection ${projection.projectionName} using ${deploymentStrategy} strategy`);

      switch (deploymentStrategy) {
        case 'blue-green':
          return await this.blueGreenDeployment(projection);
        case 'rolling':
          return await this.rollingDeployment(projection);
        case 'canary':
          return await this.canaryDeployment(projection);
        default:
          throw new Error(`Unknown deployment strategy: ${deploymentStrategy}`);
      }
      
    } catch (error) {
      return {
        success: false,
        error: { code: 'DEPLOYMENT_FAILED', message: (error as Error).message },
        metadata: { timestamp: new Date(), requestId: 'deploy', duration: 0 }
      };
    }
  }

  private async blueGreenDeployment(projection: ProjectionBase<any>): Promise<ServiceResponse<void>> {
    // 1. Deploy to green environment
    const greenCluster = await this.projectionCluster.createEnvironment('green');
    await greenCluster.deployProjection(projection);
    
    // 2. Warm up green environment with recent events
    await this.warmupEnvironment(greenCluster, projection);
    
    // 3. Health check green environment
    const healthCheck = await this.healthChecker.checkEnvironment('green');
    if (!healthCheck.healthy) {
      throw new Error('Green environment health check failed');
    }
    
    // 4. Switch traffic to green
    await this.projectionCluster.switchTraffic('blue', 'green');
    
    // 5. Verify traffic switch
    await this.verifyTrafficSwitch('green');
    
    // 6. Cleanup blue environment
    await this.projectionCluster.cleanupEnvironment('blue');

    return { success: true, metadata: { timestamp: new Date(), requestId: 'blue-green', duration: 0 } };
  }

  private async rollingDeployment(projection: ProjectionBase<any>): Promise<ServiceResponse<void>> {
    const nodes = await this.projectionCluster.getNodes();
    const batchSize = Math.ceil(nodes.length / 3); // Deploy to 1/3 at a time
    
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      
      // Deploy to batch
      await Promise.all(batch.map(node => node.deployProjection(projection)));
      
      // Health check batch
      for (const node of batch) {
        const health = await this.healthChecker.checkNode(node.id);
        if (!health.healthy) {
          throw new Error(`Node ${node.id} failed health check during rolling deployment`);
        }
      }
      
      // Wait before next batch
      await new Promise(resolve => setTimeout(resolve, this.config.deployment.rollingDelay));
    }

    return { success: true, metadata: { timestamp: new Date(), requestId: 'rolling', duration: 0 } };
  }

  private async canaryDeployment(projection: ProjectionBase<any>): Promise<ServiceResponse<void>> {
    // 1. Deploy to canary nodes (5% of traffic)
    const canaryNodes = await this.projectionCluster.getCanaryNodes();
    await Promise.all(canaryNodes.map(node => node.deployProjection(projection)));
    
    // 2. Route 5% traffic to canary
    await this.projectionCluster.setTrafficSplit({ canary: 0.05, production: 0.95 });
    
    // 3. Monitor canary for specified duration
    const canaryResults = await this.monitorCanary(this.config.deployment.canaryDuration);
    
    // 4. Validate canary metrics
    if (canaryResults.errorRate > this.config.deployment.canaryErrorThreshold) {
      await this.rollbackCanary();
      throw new Error('Canary deployment failed due to high error rate');
    }
    
    // 5. Gradually increase canary traffic
    const trafficSteps = [0.1, 0.25, 0.5, 0.75, 1.0];
    for (const trafficPercent of trafficSteps) {
      await this.projectionCluster.setTrafficSplit({ canary: trafficPercent, production: 1 - trafficPercent });
      await this.waitAndValidate(this.config.deployment.canaryStepDuration);
    }
    
    // 6. Complete deployment
    await this.projectionCluster.promoteCanaryToProduction();

    return { success: true, metadata: { timestamp: new Date(), requestId: 'canary', duration: 0 } };
  }

  // Performance optimization helpers
  private async warmupEnvironment(cluster: any, projection: ProjectionBase<any>): Promise<void> {
    const warmupEventCount = this.config.deployment.warmupEventCount || 10000;
    const recentEvents = await this.getRecentEvents(warmupEventCount);
    
    console.log(`Warming up environment with ${recentEvents.length} recent events`);
    
    for (const event of recentEvents) {
      if (projection.canHandle(event.eventType)) {
        await projection.handle(event);
      }
    }
  }

  private async getRecentEvents(count: number): Promise<IDomainEvent[]> {
    // In production, this would query the event store for recent events
    return []; // Simplified for example
  }

  private async verifyTrafficSwitch(environment: string): Promise<void> {
    const verification = await this.projectionCluster.verifyTrafficSplit();
    if (verification.activeEnvironment !== environment) {
      throw new Error(`Traffic switch verification failed: expected ${environment}, got ${verification.activeEnvironment}`);
    }
  }

  private async monitorCanary(duration: number): Promise<{ errorRate: number; latency: number }> {
    return new Promise(resolve => {
      const startTime = Date.now();
      let errorCount = 0;
      let requestCount = 0;
      let totalLatency = 0;

      const monitor = setInterval(() => {
        const metrics = this.metricsCollector.getCanaryMetrics();
        errorCount += metrics.errors;
        requestCount += metrics.requests;
        totalLatency += metrics.latency;

        if (Date.now() - startTime >= duration) {
          clearInterval(monitor);
          resolve({
            errorRate: requestCount > 0 ? errorCount / requestCount : 0,
            latency: requestCount > 0 ? totalLatency / requestCount : 0
          });
        }
      }, 1000);
    });
  }

  private async rollbackCanary(): Promise<void> {
    await this.projectionCluster.setTrafficSplit({ canary: 0, production: 1.0 });
    console.log('Canary deployment rolled back');
  }

  private async waitAndValidate(duration: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, duration));
    
    const health = await this.healthChecker.checkCanary();
    if (!health.healthy) {
      await this.rollbackCanary();
      throw new Error('Canary health check failed during traffic increase');
    }
  }

  // Monitoring and observability
  getPerformanceMetrics(): PerformanceMetrics {
    return this.metricsCollector.getAggregatedMetrics();
  }

  async generateHealthReport(): Promise<any> {
    return await this.healthChecker.generateComprehensiveReport();
  }

  // Shutdown procedures
  async shutdown(): Promise<ServiceResponse<void>> {
    try {
      console.log('Shutting down enterprise projection system...');

      await this.healthChecker.stop();
      await this.metricsCollector.stop();
      await this.shardingStrategy.shutdown();
      await this.projectionCluster.shutdown();

      console.log('Enterprise projection system shutdown complete');
      
      return { success: true, metadata: { timestamp: new Date(), requestId: 'shutdown', duration: 0 } };
      
    } catch (error) {
      return {
        success: false,
        error: { code: 'SHUTDOWN_FAILED', message: (error as Error).message },
        metadata: { timestamp: new Date(), requestId: 'shutdown', duration: 0 }
      };
    }
  }
}
```

## Implementation Strategies

### **1. Performance Optimization**

#### **Event Processing Pipeline**
```typescript
// High-performance event processing
class OptimizedProjectionProcessor {
  private eventBuffer: CircularBuffer<IDomainEvent>;
  private batchProcessor: BatchProcessor;
  private parallelWorkers: WorkerPool;

  constructor(config: ProcessorConfig) {
    this.eventBuffer = new CircularBuffer(config.bufferSize);
    this.batchProcessor = new BatchProcessor(config.batchSize);
    this.parallelWorkers = new WorkerPool(config.workerCount);
  }

  async processEvent(event: IDomainEvent): Promise<void> {
    // Add to buffer for batch processing
    this.eventBuffer.add(event);
    
    if (this.eventBuffer.size >= this.batchProcessor.batchSize) {
      const batch = this.eventBuffer.drain();
      await this.batchProcessor.processBatch(batch);
    }
  }

  private async processBatch(events: IDomainEvent[]): Promise<void> {
    // Distribute work across parallel workers
    const chunks = this.chunkEvents(events, this.parallelWorkers.size);
    
    const promises = chunks.map((chunk, index) => 
      this.parallelWorkers.assignWork(index, chunk)
    );
    
    await Promise.all(promises);
  }
}
```

#### **Memory Management**
```typescript
// Memory-efficient projection state management
class MemoryEfficientProjection extends ProjectionBase<any> {
  private stateCache: LRUCache<string, any>;
  private compressionEnabled: boolean;
  private gcThreshold: number;

  constructor(config: MemoryConfig) {
    super('MemoryEfficientProjection', '1.0');
    
    this.stateCache = new LRUCache({
      max: config.maxCacheSize,
      ttl: config.cacheTTL
    });
    
    this.compressionEnabled = config.enableCompression;
    this.gcThreshold = config.gcThreshold;
  }

  protected setState(state: any): void {
    // Compress state if enabled
    const stateToStore = this.compressionEnabled 
      ? this.compressState(state)
      : state;

    // Store in cache with memory monitoring
    this.stateCache.set('current', stateToStore);
    
    // Trigger garbage collection if needed
    if (this.shouldTriggerGC()) {
      this.performGarbageCollection();
    }
  }

  private compressState(state: any): any {
    // Implement state compression (e.g., using zlib)
    return state; // Simplified
  }

  private shouldTriggerGC(): boolean {
    const memoryUsage = process.memoryUsage();
    return memoryUsage.heapUsed > this.gcThreshold;
  }

  private performGarbageCollection(): void {
    // Clean up old cache entries
    this.stateCache.purgeStale();
    
    // Force garbage collection (be careful in production)
    if (global.gc) {
      global.gc();
    }
  }
}
```

### **2. Scaling Patterns**

#### **Horizontal Scaling with Sharding**
```typescript
// Projection sharding for horizontal scaling
class ShardedProjection extends ProjectionBase<any> {
  private shardingStrategy: ShardingStrategy;
  private shardId: string;
  private replicationNodes: Set<string>;

  constructor(shardId: string, shardingStrategy: ShardingStrategy) {
    super(`ShardedProjection_${shardId}`, '1.0');
    this.shardId = shardId;
    this.shardingStrategy = shardingStrategy;
    this.replicationNodes = new Set();
  }

  async handle(event: IDomainEvent): Promise<void> {
    // Check if this shard should process the event
    const targetShard = this.shardingStrategy.getShardForEvent(event);
    
    if (targetShard !== this.shardId) {
      // Forward to correct shard
      await this.forwardToShard(event, targetShard);
      return;
    }

    // Process event normally
    await super.handle(event);
    
    // Replicate to backup shards if configured
    if (this.replicationNodes.size > 0) {
      await this.replicateToBackups(event);
    }
  }

  private async forwardToShard(event: IDomainEvent, targetShard: string): Promise<void> {
    const targetNode = this.shardingStrategy.getNodeForShard(targetShard);
    await targetNode.processEvent(event);
  }

  private async replicateToBackups(event: IDomainEvent): Promise<void> {
    const replicationPromises = Array.from(this.replicationNodes).map(nodeId => {
      const node = this.shardingStrategy.getNode(nodeId);
      return node.processEvent(event);
    });
    
    // Don't wait for replication to complete
    Promise.all(replicationPromises).catch(error => {
      console.error('Replication error:', error);
    });
  }
}
```

#### **Load Balancing Strategies**
```typescript
// Intelligent load balancing for projections
class LoadBalancedProjectionCluster {
  private nodes: ProjectionNode[];
  private loadBalancer: LoadBalancer;
  private healthMonitor: HealthMonitor;

  constructor(nodes: ProjectionNode[]) {
    this.nodes = nodes;
    this.loadBalancer = new LoadBalancer({
      strategy: 'weighted-round-robin',
      healthCheckInterval: 30000
    });
    this.healthMonitor = new HealthMonitor();
  }

  async processEvent(event: IDomainEvent): Promise<void> {
    // Get the best node for processing
    const selectedNode = await this.selectOptimalNode(event);
    
    if (!selectedNode) {
      throw new Error('No healthy nodes available for processing');
    }

    try {
      await selectedNode.processEvent(event);
      this.loadBalancer.recordSuccess(selectedNode.id);
    } catch (error) {
      this.loadBalancer.recordFailure(selectedNode.id);
      
      // Try backup node
      const backupNode = await this.selectBackupNode(selectedNode.id);
      if (backupNode) {
        await backupNode.processEvent(event);
      } else {
        throw error;
      }
    }
  }

  private async selectOptimalNode(event: IDomainEvent): Promise<ProjectionNode | null> {
    // Filter healthy nodes
    const healthyNodes = this.nodes.filter(node => 
      this.healthMonitor.isHealthy(node.id)
    );

    if (healthyNodes.length === 0) {
      return null;
    }

    // Apply load balancing strategy
    return this.loadBalancer.selectNode(healthyNodes, event);
  }

  private async selectBackupNode(excludeNodeId: string): Promise<ProjectionNode | null> {
    const availableNodes = this.nodes.filter(node => 
      node.id !== excludeNodeId && this.healthMonitor.isHealthy(node.id)
    );

    return availableNodes.length > 0 ? availableNodes[0] : null;
  }
}
```

### **3. Error Handling and Resilience**

#### **Advanced Error Recovery**
```typescript
// Comprehensive error handling for projections
class ResilientProjection extends ProjectionBase<any> {
  private errorRecoveryStrategy: ErrorRecoveryStrategy;
  private circuitBreaker: CircuitBreaker;
  private deadLetterQueue: DeadLetterQueue;
  private retryPolicy: RetryPolicy;

  constructor() {
    super('ResilientProjection', '1.0');
    this.setupResilienceCapabilities();
  }

  private setupResilienceCapabilities(): void {
    this.errorRecoveryStrategy = new ErrorRecoveryStrategy({
      maxRetries: 3,
      backoffMultiplier: 2,
      jitterEnabled: true
    });

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      timeout: 60000,
      monitoringWindow: 300000
    });

    this.deadLetterQueue = new DeadLetterQueue({
      maxRetentionTime: 24 * 60 * 60 * 1000, // 24 hours
      processingSchedule: '0 */6 * * *' // Every 6 hours
    });

    this.retryPolicy = new RetryPolicy({
      maxAttempts: 5,
      baseDelay: 1000,
      maxDelay: 60000,
      exponentialBackoff: true
    });
  }

  async handle(event: IDomainEvent): Promise<void> {
    if (this.circuitBreaker.isOpen()) {
      await this.deadLetterQueue.enqueue(event, 'Circuit breaker open');
      return;
    }

    try {
      await this.retryPolicy.execute(async () => {
        await this.processEventWithErrorHandling(event);
      });

      this.circuitBreaker.recordSuccess();

    } catch (error) {
      this.circuitBreaker.recordFailure();
      
      const recoveryStrategy = this.errorRecoveryStrategy.getStrategy(error);
      
      switch (recoveryStrategy.action) {
        case 'retry':
          await this.scheduleRetry(event, recoveryStrategy.delay);
          break;
        case 'dead-letter':
          await this.deadLetterQueue.enqueue(event, (error as Error).message);
          break;
        case 'skip':
          console.warn(`Skipping event ${event.eventId} due to error:`, error);
          break;
        case 'fail':
          throw error;
      }
    }
  }

  private async processEventWithErrorHandling(event: IDomainEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.processEventInternal(event);
      
      const processingTime = Date.now() - startTime;
      this.recordProcessingMetrics(event, processingTime, true);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.recordProcessingMetrics(event, processingTime, false);
      
      // Enhance error with context
      const enhancedError = this.enhanceError(error as Error, event);
      throw enhancedError;
    }
  }

  private enhanceError(error: Error, event: IDomainEvent): Error {
    const enhancedError = new Error(error.message);
    enhancedError.stack = error.stack;
    
    // Add projection context
    Object.assign(enhancedError, {
      projectionName: this.projectionName,
      projectionVersion: this.version,
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      timestamp: new Date().toISOString()
    });
    
    return enhancedError;
  }

  private async scheduleRetry(event: IDomainEvent, delay: number): Promise<void> {
    setTimeout(async () => {
      try {
        await this.handle(event);
      } catch (retryError) {
        console.error('Retry failed for event:', event.eventId, retryError);
      }
    }, delay);
  }

  private recordProcessingMetrics(event: IDomainEvent, processingTime: number, success: boolean): void {
    // Record metrics for monitoring
    this.metricsCollector.recordEventProcessing({
      projectionName: this.projectionName,
      eventType: event.eventType,
      processingTime,
      success,
      timestamp: new Date()
    });
  }
}
```

## Production Deployment Checklist

### **Pre-Deployment**
- [ ] **Performance Testing**: Load test with production-like data volumes
- [ ] **Resource Planning**: Calculate memory and CPU requirements
- [ ] **Monitoring Setup**: Configure metrics collection and alerting
- [ ] **Backup Strategy**: Implement state backup and recovery procedures
- [ ] **Security Review**: Validate access controls and data protection

### **Deployment**
- [ ] **Environment Preparation**: Setup production infrastructure
- [ ] **Configuration Management**: Validate all environment-specific configs
- [ ] **Health Checks**: Implement comprehensive health monitoring
- [ ] **Rollback Plan**: Prepare rollback procedures and test them
- [ ] **Documentation**: Update operational runbooks

### **Post-Deployment**
- [ ] **Monitoring Validation**: Confirm all metrics are being collected
- [ ] **Performance Validation**: Verify performance meets SLA requirements
- [ ] **Functional Testing**: Run end-to-end functionality tests
- [ ] **Alert Testing**: Test alert thresholds and notification channels
- [ ] **Team Training**: Train operations team on new system

## Configuration Examples

### **Development Configuration**
```typescript
const devConfig: ProjectionConfig = {
  cluster: {
    nodeCount: 1,
    enableLeaderElection: false,
    loadBalancingStrategy: 'round-robin',
    failoverTimeout: 30000
  },
  sharding: {
    strategy: 'none',
    shardCount: 1,
    replicationFactor: 1,
    consistencyLevel: 'eventual'
  },
  monitoring: {
    metricsInterval: 10000,
    retentionPeriod: 3600000, // 1 hour
    exporters: ['console']
  },
  health: {
    checkInterval: 30000,
    thresholds: { errorRate: 0.1, latency: 1000 },
    alerting: { enabled: false }
  }
};
```

### **Production Configuration**
```typescript
const prodConfig: ProjectionConfig = {
  cluster: {
    nodeCount: 5,
    enableLeaderElection: true,
    loadBalancingStrategy: 'weighted-round-robin',
    failoverTimeout: 10000
  },
  sharding: {
    strategy: 'hash',
    shardCount: 16,
    replicationFactor: 3,
    consistencyLevel: 'strong'
  },
  monitoring: {
    metricsInterval: 5000,
    retentionPeriod: 86400000, // 24 hours
    exporters: ['prometheus', 'datadog', 'cloudwatch']
  },
  health: {
    checkInterval: 15000,
    thresholds: { errorRate: 0.01, latency: 500 },
    alerting: { 
      enabled: true,
      channels: ['slack', 'pagerduty', 'email']
    }
  },
  deployment: {
    warmupEventCount: 100000,
    rollingDelay: 30000,
    canaryDuration: 600000, // 10 minutes
    canaryErrorThreshold: 0.005,
    canaryStepDuration: 300000 // 5 minutes
  }
};
```

## Best Practices Summary

### **Performance**
- Use event buffering and batch processing for high throughput
- Implement efficient state management with compression
- Monitor memory usage and implement garbage collection strategies
- Use connection pooling for external dependencies

### **Scalability**
- Design for horizontal scaling from the beginning
- Implement proper sharding strategies
- Use load balancing with health checks
- Plan for data growth and retention policies

### **Reliability**
- Implement comprehensive error handling
- Use circuit breakers for external dependencies
- Design idempotent event handlers
- Implement proper retry policies with exponential backoff

### **Operations**
- Implement comprehensive monitoring and alerting
- Use structured logging for debugging
- Implement health checks at multiple levels
- Plan for zero-downtime deployments

### **Security**
- Implement proper access controls
- Use encryption for sensitive data
- Audit all projection access
- Regular security reviews

## Common Anti-Patterns

### **Performance Anti-Patterns**
- Synchronous processing of all events
- No batching or buffering strategies
- Unbounded memory growth
- Blocking I/O operations

### **Scalability Anti-Patterns**
- Single point of failure
- No sharding strategy
- Hard-coded capacity limits
- No load balancing

### **Reliability Anti-Patterns**
- No error handling or retry logic
- Silent failures
- No health checks
- No backup/recovery procedures

### **Operations Anti-Patterns**
- No monitoring or alerting
- Poor logging practices
- No operational runbooks
- Manual deployment processes

## Related Examples

- [Projection Rebuilding System](./example-1.md)
- [Event Stream Processing](./example-2.md)  
- [Multi-Tenant Projections](./example-3.md)
- [Basic Implementation Guide](../basic/implementation.md)