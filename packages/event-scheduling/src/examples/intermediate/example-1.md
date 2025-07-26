# Distributed Event Scheduling - Multi-Node Coordination

**Version**: 1.0.0 **Package**: @vytches/ddd-event-scheduling **Complexity**:
intermediate **Domain**: Infrastructure **Patterns**: distributed-scheduling,
leader-election, partition-management, node-coordination

## Description

Intermediate implementation of distributed event scheduling across multiple
nodes with leader election, partition management, and automatic failover for
high availability scenarios.

## Business Context

E-commerce platform operating across multiple data centers needs to ensure
scheduled events (order processing, inventory updates, customer notifications)
are executed reliably even when individual nodes fail.

## Code Example

```typescript
// distributed-scheduling.ts
import {
  InMemorySchedulerAdapter,
  ScheduledEvent,
} from '@vytches/ddd-event-scheduling';
import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';
import {
  ClusterNode,
  SchedulingPartition,
  DistributedSchedulerConfig,
  GlobalSchedulingMetrics,
} from './types'; // From your app

// ⭐ FOCUS: Distributed scheduled event with partition awareness
export class DistributedScheduledEvent<T = any> extends ScheduledEvent<T> {
  public readonly partitionKey: string;
  public readonly replicationFactor: number;

  constructor(
    aggregateId: string,
    scheduleAt: Date,
    payload: T,
    partitionKey: string,
    replicationFactor: number = 2
  ) {
    super(aggregateId, scheduleAt, payload, {
      maxRetries: 3,
      backoff: 'exponential',
    });

    this.partitionKey = partitionKey;
    this.replicationFactor = replicationFactor;
  }

  // ✅ FOCUS: Calculate target partition
  getTargetPartition(totalPartitions: number): string {
    const hash = this.hashString(this.partitionKey);
    const partitionIndex = hash % totalPartitions;
    return `partition-${partitionIndex}`;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// ⭐ FOCUS: Leader election and node coordination
export class ClusterCoordinator {
  private nodes: Map<string, ClusterNode> = new Map();
  private partitions: Map<string, SchedulingPartition> = new Map();
  private currentLeader: string | null = null;
  private readonly logger = Logger.forContext('ClusterCoordinator');
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly nodeId: string,
    private readonly config: DistributedSchedulerConfig
  ) {
    this.initializePartitions();
  }

  async start(): Promise<void> {
    // Register this node
    this.registerNode();

    // Start heartbeat mechanism
    this.startHeartbeat();

    // Attempt leader election
    await this.attemptLeaderElection();

    this.logger.info('Cluster coordinator started', {
      nodeId: this.nodeId,
      totalPartitions: this.partitions.size,
      isLeader: this.isLeader(),
    });
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Deregister node
    this.nodes.delete(this.nodeId);

    this.logger.info('Cluster coordinator stopped', { nodeId: this.nodeId });
  }

  // ✅ FOCUS: Leader election logic
  async attemptLeaderElection(): Promise<boolean> {
    const healthyNodes = Array.from(this.nodes.values())
      .filter(node => node.isHealthy)
      .sort((a, b) => a.id.localeCompare(b.id)); // Deterministic ordering

    if (healthyNodes.length === 0) {
      return false;
    }

    const shouldBeLeader = healthyNodes[0].id === this.nodeId;

    if (shouldBeLeader && !this.isLeader()) {
      await this.becomeLeader();
      return true;
    } else if (!shouldBeLeader && this.isLeader()) {
      await this.stepDownAsLeader();
    }

    return this.isLeader();
  }

  // ✅ FOCUS: Partition assignment for events
  assignPartition(event: DistributedScheduledEvent): string {
    const targetPartition = event.getTargetPartition(this.partitions.size);
    const partition = this.partitions.get(targetPartition);

    if (!partition || !this.isNodeHealthy(partition.assignedNode)) {
      // Reassign to healthy node
      const healthyNodes = this.getHealthyNodes();
      if (healthyNodes.length > 0) {
        const newNode =
          healthyNodes[Math.floor(Math.random() * healthyNodes.length)];
        if (partition) {
          partition.assignedNode = newNode.id;
          this.logger.info('Partition reassigned', {
            partition: targetPartition,
            newNode: newNode.id,
            reason: 'unhealthy_node',
          });
        }
      }
    }

    return targetPartition;
  }

  isLeader(): boolean {
    return this.currentLeader === this.nodeId;
  }

  getHealthyNodes(): ClusterNode[] {
    return Array.from(this.nodes.values()).filter(node => node.isHealthy);
  }

  getClusterMetrics(): GlobalSchedulingMetrics {
    const healthyNodes = this.getHealthyNodes();
    const totalPartitions = this.partitions.size;

    return {
      totalNodes: this.nodes.size,
      healthyNodes: healthyNodes.length,
      totalPartitions,
      leaderNode: this.currentLeader || 'none',
      eventThroughput: this.calculateThroughput(),
      averageLatency: this.calculateAverageLatency(),
      replicationLag: this.calculateReplicationLag(),
    };
  }

  private registerNode(): void {
    const node: ClusterNode = {
      id: this.nodeId,
      address: `node-${this.nodeId}`,
      isLeader: false,
      isHealthy: true,
      lastHeartbeat: new Date(),
      assignedPartitions: [],
    };

    this.nodes.set(this.nodeId, node);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
      await this.checkNodeHealth();
    }, 5000); // Every 5 seconds
  }

  private async sendHeartbeat(): Promise<void> {
    const node = this.nodes.get(this.nodeId);
    if (node) {
      node.lastHeartbeat = new Date();
      node.isHealthy = true;
    }

    // Simulate heartbeat to other nodes
    this.logger.debug('Heartbeat sent', { nodeId: this.nodeId });
  }

  private async checkNodeHealth(): Promise<void> {
    const now = new Date();
    const healthTimeout = 15000; // 15 seconds

    for (const [nodeId, node] of this.nodes) {
      const timeSinceHeartbeat = now.getTime() - node.lastHeartbeat.getTime();
      const wasHealthy = node.isHealthy;

      node.isHealthy = timeSinceHeartbeat <= healthTimeout;

      if (wasHealthy && !node.isHealthy) {
        this.logger.warn('Node marked unhealthy', {
          nodeId,
          timeSinceHeartbeat,
        });

        // Trigger leader election if leader became unhealthy
        if (node.isLeader) {
          await this.attemptLeaderElection();
        }
      }
    }
  }

  private async becomeLeader(): Promise<void> {
    this.currentLeader = this.nodeId;
    const node = this.nodes.get(this.nodeId);
    if (node) {
      node.isLeader = true;
    }

    // Rebalance partitions
    await this.rebalancePartitions();

    this.logger.info('Node became leader', { nodeId: this.nodeId });
  }

  private async stepDownAsLeader(): Promise<void> {
    const node = this.nodes.get(this.nodeId);
    if (node) {
      node.isLeader = false;
    }

    this.currentLeader = null;

    this.logger.info('Node stepped down as leader', { nodeId: this.nodeId });
  }

  private initializePartitions(): void {
    const partitionCount = this.config.partitionCount || 16;

    for (let i = 0; i < partitionCount; i++) {
      const partition: SchedulingPartition = {
        id: `partition-${i}`,
        assignedNode: this.nodeId, // Initially assign to self
        eventCount: 0,
        healthStatus: 'healthy',
      };

      this.partitions.set(partition.id, partition);
    }
  }

  private async rebalancePartitions(): Promise<void> {
    if (!this.isLeader()) return;

    const healthyNodes = this.getHealthyNodes();
    const partitions = Array.from(this.partitions.values());

    if (healthyNodes.length === 0) return;

    // Distribute partitions evenly among healthy nodes
    const partitionsPerNode = Math.floor(
      partitions.length / healthyNodes.length
    );
    let nodeIndex = 0;

    for (let i = 0; i < partitions.length; i++) {
      const partition = partitions[i];
      const targetNode = healthyNodes[nodeIndex];

      if (partition.assignedNode !== targetNode.id) {
        partition.assignedNode = targetNode.id;

        this.logger.info('Partition rebalanced', {
          partition: partition.id,
          newNode: targetNode.id,
        });
      }

      if (
        (i + 1) % partitionsPerNode === 0 &&
        nodeIndex < healthyNodes.length - 1
      ) {
        nodeIndex++;
      }
    }
  }

  private isNodeHealthy(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    return node ? node.isHealthy : false;
  }

  private calculateThroughput(): number {
    // Simulate throughput calculation
    return Array.from(this.partitions.values()).reduce(
      (total, partition) => total + partition.eventCount,
      0
    );
  }

  private calculateAverageLatency(): number {
    // Simulate latency calculation
    return 50; // 50ms average
  }

  private calculateReplicationLag(): number {
    // Simulate replication lag calculation
    return 10; // 10ms lag
  }
}

// ⭐ FOCUS: Distributed scheduler service
export class DistributedSchedulerService {
  private schedulers: Map<string, InMemorySchedulerAdapter> = new Map();
  private coordinator: ClusterCoordinator;
  private readonly logger = Logger.forContext('DistributedSchedulerService');

  constructor(nodeId: string, config: DistributedSchedulerConfig) {
    this.coordinator = new ClusterCoordinator(nodeId, config);
    this.initializeSchedulers();
  }

  async start(): Promise<void> {
    await this.coordinator.start();

    // Start schedulers for assigned partitions
    for (const [partitionId, scheduler] of this.schedulers) {
      await scheduler.start();
      this.logger.info('Scheduler started for partition', { partitionId });
    }
  }

  async stop(): Promise<void> {
    // Stop all schedulers
    for (const [partitionId, scheduler] of this.schedulers) {
      await scheduler.stop();
      this.logger.info('Scheduler stopped for partition', { partitionId });
    }

    await this.coordinator.stop();
  }

  // ✅ FOCUS: Schedule distributed event
  async scheduleDistributedEvent<T>(
    event: DistributedScheduledEvent<T>
  ): Promise<Result<string, Error>> {
    try {
      // Assign to appropriate partition
      const partitionId = this.coordinator.assignPartition(event);
      const scheduler = this.schedulers.get(partitionId);

      if (!scheduler) {
        return Result.fail(
          new Error(`No scheduler found for partition: ${partitionId}`)
        );
      }

      // Schedule the event
      const jobId = await scheduler.schedule(event);

      this.logger.info('Distributed event scheduled', {
        jobId,
        partitionId,
        eventType: event.constructor.name,
        partitionKey: event.partitionKey,
        scheduledAt: event.scheduleAt,
      });

      return Result.ok(jobId);
    } catch (error) {
      return Result.fail(
        new Error(`Failed to schedule distributed event: ${error.message}`)
      );
    }
  }

  // ✅ FOCUS: Schedule order processing event
  async scheduleOrderProcessing(
    orderId: string,
    orderData: any,
    delayMinutes: number = 0
  ): Promise<Result<string, Error>> {
    const scheduleAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    const event = new DistributedScheduledEvent(
      orderId,
      scheduleAt,
      orderData,
      `customer-${orderData.customerId}`, // Partition by customer
      2 // Replication factor
    );

    return await this.scheduleDistributedEvent(event);
  }

  // ✅ FOCUS: Schedule inventory update
  async scheduleInventoryUpdate(
    productId: string,
    updateData: any,
    delayMinutes: number = 5
  ): Promise<Result<string, Error>> {
    const scheduleAt = new Date(Date.now() + delayMinutes * 60 * 1000);

    const event = new DistributedScheduledEvent(
      productId,
      scheduleAt,
      updateData,
      `product-${productId}`, // Partition by product
      3 // Higher replication for inventory
    );

    return await this.scheduleDistributedEvent(event);
  }

  // ✅ FOCUS: Get cluster status
  getClusterStatus(): ClusterStatus {
    const metrics = this.coordinator.getClusterMetrics();
    const healthyNodes = this.coordinator.getHealthyNodes();

    return {
      isHealthy: metrics.healthyNodes > 0,
      totalNodes: metrics.totalNodes,
      healthyNodes: metrics.healthyNodes,
      currentLeader: metrics.leaderNode,
      partitionCount: metrics.totalPartitions,
      nodes: healthyNodes.map(node => ({
        id: node.id,
        isLeader: node.isLeader,
        isHealthy: node.isHealthy,
        assignedPartitions: node.assignedPartitions.length,
      })),
    };
  }

  // ✅ FOCUS: Get distributed metrics
  async getDistributedMetrics(): Promise<DistributedMetrics> {
    const clusterMetrics = this.coordinator.getClusterMetrics();
    const schedulerStats = await this.getAggregatedSchedulerStats();

    return {
      cluster: clusterMetrics,
      scheduling: schedulerStats,
      partitions: Array.from(this.schedulers.keys()).map(partitionId => ({
        id: partitionId,
        isHealthy: true,
        eventCount: 0, // Would be populated from actual scheduler stats
        avgLatency: 25,
      })),
      timestamp: new Date(),
    };
  }

  private initializeSchedulers(): void {
    // Initialize schedulers for each potential partition
    // In real implementation, this would be based on assigned partitions
    for (let i = 0; i < 16; i++) {
      const partitionId = `partition-${i}`;
      const scheduler = new InMemorySchedulerAdapter({
        defaultMaxRetries: 3,
        defaultTimeout: 30000,
        enableLogging: true,
      });

      this.schedulers.set(partitionId, scheduler);
    }
  }

  private async getAggregatedSchedulerStats(): Promise<AggregatedSchedulerStats> {
    let totalScheduled = 0;
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalRunning = 0;

    for (const [partitionId, scheduler] of this.schedulers) {
      try {
        const stats = await scheduler.getStats();
        totalScheduled += stats.scheduled + stats.pending;
        totalCompleted += stats.completed;
        totalFailed += stats.failed;
        totalRunning += stats.running;
      } catch (error) {
        this.logger.warn('Failed to get stats for partition', {
          partitionId,
          error: error.message,
        });
      }
    }

    return {
      totalScheduled,
      totalCompleted,
      totalFailed,
      totalRunning,
      successRate:
        totalCompleted + totalFailed > 0
          ? totalCompleted / (totalCompleted + totalFailed)
          : 0,
    };
  }
}

// ⭐ FOCUS: Event handlers for distributed events
export class DistributedEventHandlers {
  private readonly logger = Logger.forContext('DistributedEventHandlers');

  constructor(private schedulerService: DistributedSchedulerService) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Set up handlers for distributed events
    // This would integrate with the actual scheduler event system
    this.logger.info('Distributed event handlers initialized');
  }

  async handleOrderProcessing(event: DistributedScheduledEvent): Promise<void> {
    const orderData = event.payload;

    this.logger.info('Processing distributed order event', {
      orderId: event.aggregateId,
      partitionKey: event.partitionKey,
      customerId: orderData.customerId,
    });

    try {
      // Simulate order processing
      await this.processOrder(orderData);

      this.logger.info('Order processed successfully', {
        orderId: event.aggregateId,
      });
    } catch (error) {
      this.logger.error('Failed to process order', {
        orderId: event.aggregateId,
        error: error.message,
      });
      throw error;
    }
  }

  async handleInventoryUpdate(event: DistributedScheduledEvent): Promise<void> {
    const updateData = event.payload;

    this.logger.info('Processing inventory update event', {
      productId: event.aggregateId,
      partitionKey: event.partitionKey,
      operation: updateData.operation,
    });

    try {
      // Simulate inventory update
      await this.updateInventory(updateData);

      this.logger.info('Inventory updated successfully', {
        productId: event.aggregateId,
      });
    } catch (error) {
      this.logger.error('Failed to update inventory', {
        productId: event.aggregateId,
        error: error.message,
      });
      throw error;
    }
  }

  private async processOrder(orderData: any): Promise<void> {
    // Simulate order processing logic
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async updateInventory(updateData: any): Promise<void> {
    // Simulate inventory update logic
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

## Usage Example

```typescript
// usage-example.ts
import {
  DistributedSchedulerService,
  DistributedEventHandlers,
  DistributedScheduledEvent,
} from './distributed-scheduling';

async function demonstrateDistributedScheduling() {
  // Initialize distributed scheduler with cluster configuration
  const config = {
    nodes: ['node-1', 'node-2', 'node-3'],
    partitionCount: 16,
    replicationFactor: 2,
    leaderElectionTimeout: 10000,
  };

  const scheduler = new DistributedSchedulerService('node-1', config);
  const handlers = new DistributedEventHandlers(scheduler);

  await scheduler.start();

  try {
    // Schedule order processing events across different customers
    const orderResults = await Promise.all([
      scheduler.scheduleOrderProcessing(
        'ORDER-001',
        {
          customerId: 'CUSTOMER-A',
          amount: 199.99,
          items: ['product-1', 'product-2'],
        },
        5
      ), // 5 minutes delay

      scheduler.scheduleOrderProcessing(
        'ORDER-002',
        {
          customerId: 'CUSTOMER-B',
          amount: 299.99,
          items: ['product-3'],
        },
        10
      ), // 10 minutes delay

      scheduler.scheduleOrderProcessing(
        'ORDER-003',
        {
          customerId: 'CUSTOMER-A', // Same partition as ORDER-001
          amount: 99.99,
          items: ['product-4'],
        },
        15
      ), // 15 minutes delay
    ]);

    console.log('Order processing events scheduled:', orderResults);

    // Schedule inventory updates for different products
    const inventoryResults = await Promise.all([
      scheduler.scheduleInventoryUpdate(
        'PRODUCT-1',
        {
          operation: 'reserve',
          quantity: 10,
          reason: 'order-fulfillment',
        },
        2
      ), // 2 minutes delay

      scheduler.scheduleInventoryUpdate(
        'PRODUCT-2',
        {
          operation: 'release',
          quantity: 5,
          reason: 'order-cancellation',
        },
        7
      ), // 7 minutes delay
    ]);

    console.log('Inventory update events scheduled:', inventoryResults);

    // Monitor cluster status
    const monitorCluster = async () => {
      const clusterStatus = scheduler.getClusterStatus();
      console.log('🔗 Cluster Status:', clusterStatus);

      const distributedMetrics = await scheduler.getDistributedMetrics();
      console.log('📊 Distributed Metrics:', distributedMetrics);
    };

    // Monitor every 15 seconds
    const monitorInterval = setInterval(monitorCluster, 15000);

    // Initial monitoring
    await monitorCluster();

    // Run for 2 minutes to observe distributed coordination
    await new Promise(resolve => setTimeout(resolve, 120000));

    clearInterval(monitorInterval);

    // Final status check
    await monitorCluster();
  } finally {
    await scheduler.stop();
  }
}

demonstrateDistributedScheduling().catch(console.error);
```

## Key Features

- **Leader Election**: Automatic leader selection using deterministic ordering
- **Partition Management**: Event distribution across multiple partitions for
  scalability
- **Node Coordination**: Heartbeat mechanism for health monitoring and failover
- **Automatic Rebalancing**: Dynamic partition reassignment when nodes fail
- **Consistent Hashing**: Partition assignment based on configurable keys
- **Replication Factor**: Configurable event replication for fault tolerance
- **Health Monitoring**: Comprehensive cluster health tracking and metrics
- **Graceful Failover**: Automatic recovery from node failures

## Common Pitfalls

- **Split-Brain Scenarios**: Implement proper consensus mechanisms for leader
  election
- **Network Partitions**: Handle network splits gracefully with appropriate
  timeouts
- **Clock Synchronization**: Ensure all nodes have synchronized clocks for
  accurate scheduling
- **Partition Hot-Spotting**: Monitor partition load and implement rebalancing
  strategies
- **Resource Leaks**: Properly clean up resources when nodes leave the cluster

## Related Examples

- [Basic Event Scheduling](../basic/example-1.md) - Simple single-node
  scheduling
- [Priority Queuing](../basic/example-3.md) - Priority-based scheduling concepts
- [High Availability Scheduling](../advanced/example-2.md) - Enterprise
  clustering patterns
- [NestJS Distributed Integration](../frameworks/nestjs/advanced/example-1.md) -
  Framework integration
