# Distributed Event Projections

**Version**: 1.0.0 **Package**: @vytches-ddd/projections **Complexity**:
advanced **Domain**: Event Sourcing **Patterns**: Distributed systems, consensus
algorithms, coordination, global orchestration **Dependencies**:
@vytches-ddd/projections, @vytches-ddd/events, @vytches-ddd/resilience,
@vytches-ddd/messaging

## Description

Enterprise-scale distributed projection orchestration across multiple regions
and availability zones with consensus algorithms, coordination protocols, and
global state management. This example demonstrates how to build fault-tolerant,
globally distributed projection systems that maintain consistency across
geographical boundaries while providing high availability and performance.

## Business Context

Global enterprises require distributed projection systems:

- Multi-region deployment with data sovereignty compliance
- Cross-datacenter coordination with network partition tolerance
- Global consistency with eventual consistency models
- Disaster recovery with automatic failover capabilities
- Regulatory compliance across different jurisdictions
- Performance optimization through regional data locality
- Scalability across multiple availability zones

This system enables globally distributed event sourcing with enterprise-grade
reliability and compliance.

## Code Example

```typescript
// distributed-projections.ts
import {
  ProjectionBase,
  DistributedProjectionCluster,
  ConsensusProtocol,
  GlobalProjectionOrchestrator,
  RegionalCoordinator,
  ProjectionReplicationManager,
  GlobalStateManager,
} from '@vytches-ddd/projections';
import { IDomainEvent, IEventStore } from '@vytches-ddd/events';
import { CircuitBreaker, RetryPolicy } from '@vytches-ddd/resilience';
import { MessageBus, OutboxPattern } from '@vytches-ddd/messaging';
import {
  DistributedProjectionConfig,
  RegionConfig,
  ConsensusResult,
  GlobalProjectionState,
  RegionalProjectionStatus,
  CoordinationProtocol,
  FailoverStrategy,
  ConsistencyLevel,
  PartitionTolerance,
  ClusterNode,
  ServiceResponse,
  ReplicationStatus,
  GlobalSyncStatus,
} from '../types';

// ✅ FOCUS: Distributed Projection Base Class
export abstract class DistributedProjectionBase<T> extends ProjectionBase<T> {
  protected distributedCluster: DistributedProjectionCluster;
  protected consensusProtocol: ConsensusProtocol;
  protected replicationManager: ProjectionReplicationManager;
  protected regionalCoordinators: Map<string, RegionalCoordinator> = new Map();
  protected globalStateManager: GlobalStateManager<T>;
  protected messageBus: MessageBus;
  protected circuitBreaker: CircuitBreaker;
  protected retryPolicy: RetryPolicy;

  constructor(
    projectionName: string,
    version: string,
    config: DistributedProjectionConfig
  ) {
    super(projectionName, version);

    this.setupDistributedCapabilities(config);
    this.initializeGlobalState(config);
    this.setupRegionalCoordination(config);
  }

  private setupDistributedCapabilities(
    config: DistributedProjectionConfig
  ): void {
    // Distributed cluster management
    this.distributedCluster = new DistributedProjectionCluster({
      clusterId: `${this.projectionName}-cluster`,
      regions: config.regions,
      replicationFactor: config.replicationFactor,
      consistencyLevel: config.consistencyLevel,
      partitionTolerance: config.partitionTolerance,
    });

    // Consensus protocol for global coordination
    this.consensusProtocol = new ConsensusProtocol({
      algorithm: config.consensusAlgorithm || 'raft', // 'raft' | 'pbft' | 'paxos'
      quorumSize: Math.floor(config.regions.length / 2) + 1,
      electionTimeout: config.electionTimeout || 5000,
      heartbeatInterval: config.heartbeatInterval || 1000,
      maxNetworkDelay: config.maxNetworkDelay || 2000,
    });

    // Replication management
    this.replicationManager = new ProjectionReplicationManager({
      projectionName: this.projectionName,
      replicationStrategy: config.replicationStrategy || 'async',
      conflictResolutionStrategy:
        config.conflictResolution || 'last-write-wins',
      enableVersionVector: true,
      enableCausalConsistency: config.enableCausalConsistency || false,
    });

    // Global state coordination
    this.globalStateManager = new GlobalStateManager<T>({
      projectionName: this.projectionName,
      distributedStorage: config.distributedStorage,
      consistencyLevel: config.consistencyLevel,
      enableSharding: config.enableSharding || true,
      shardingStrategy: config.shardingStrategy || 'hash',
    });

    // Message bus for inter-region communication
    this.messageBus = new MessageBus({
      protocol: 'distributed',
      encryption: config.enableEncryption || true,
      compression: config.enableCompression || true,
      reliableDelivery: true,
    });

    // Resilience patterns
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: config.failureThreshold || 5,
      timeout: config.circuitBreakerTimeout || 60000,
      monitoringWindow: config.monitoringWindow || 300000,
    });

    this.retryPolicy = new RetryPolicy({
      maxAttempts: config.maxRetryAttempts || 3,
      baseDelay: config.baseRetryDelay || 1000,
      maxDelay: config.maxRetryDelay || 30000,
      exponentialBackoff: true,
      jitterEnabled: true,
    });

    this.setupDistributedEventHandlers();
  }

  private setupDistributedEventHandlers(): void {
    // Consensus protocol events
    this.consensusProtocol.on(
      'leaderElected',
      (leaderId: string, term: number) => {
        this.handleLeaderElection(leaderId, term);
      }
    );

    this.consensusProtocol.on(
      'consensusReached',
      (proposal: any, result: ConsensusResult) => {
        this.handleConsensusReached(proposal, result);
      }
    );

    // Cluster events
    this.distributedCluster.on(
      'nodeJoined',
      (nodeId: string, region: string) => {
        this.handleNodeJoined(nodeId, region);
      }
    );

    this.distributedCluster.on('nodeLeft', (nodeId: string, region: string) => {
      this.handleNodeLeft(nodeId, region);
    });

    this.distributedCluster.on(
      'partitionDetected',
      (affectedRegions: string[]) => {
        this.handleNetworkPartition(affectedRegions);
      }
    );

    // Replication events
    this.replicationManager.on(
      'replicationCompleted',
      (targetRegion: string, status: ReplicationStatus) => {
        this.handleReplicationCompleted(targetRegion, status);
      }
    );

    this.replicationManager.on('conflictDetected', (conflict: any) => {
      this.handleReplicationConflict(conflict);
    });

    // Global state events
    this.globalStateManager.on(
      'globalSyncCompleted',
      (syncStatus: GlobalSyncStatus) => {
        this.handleGlobalSyncCompleted(syncStatus);
      }
    );
  }

  private initializeGlobalState(config: DistributedProjectionConfig): void {
    // Initialize distributed state structure
    this.setState({
      // Local region state
      localState: this.createInitialLocalState(),

      // Global distributed state
      globalState: {
        regions: new Map<string, any>(),
        globalMetrics: {
          totalEvents: 0,
          replicationLag: new Map<string, number>(),
          consensusMetrics: {
            proposalsAccepted: 0,
            proposalsRejected: 0,
            averageConsensusTime: 0,
          },
        },
        clusterStatus: {
          currentLeader: null,
          currentTerm: 0,
          healthyNodes: new Set<string>(),
          partitionedRegions: new Set<string>(),
        },
      },

      // Coordination metadata
      coordinationState: {
        lastGlobalSync: new Date(),
        pendingCoordination: new Map<string, any>(),
        coordinationSequence: 0,
        regionStates: new Map<string, RegionalProjectionStatus>(),
      },

      // Replication metadata
      replicationState: {
        vectorClock: new Map<string, number>(),
        pendingReplications: new Map<string, any[]>(),
        conflictResolutions: [],
        lastReplicationCheckpoint: new Map<string, Date>(),
      },
    });
  }

  private setupRegionalCoordination(config: DistributedProjectionConfig): void {
    for (const regionConfig of config.regions) {
      const coordinator = new RegionalCoordinator({
        regionId: regionConfig.regionId,
        projectionName: this.projectionName,
        localNodes: regionConfig.nodes,
        coordinationProtocol: regionConfig.coordinationProtocol || 'gossip',
        healthCheckInterval: regionConfig.healthCheckInterval || 30000,
      });

      this.regionalCoordinators.set(regionConfig.regionId, coordinator);
    }
  }

  protected abstract createInitialLocalState(): T;

  // Distributed event processing with consensus
  async handle(event: IDomainEvent): Promise<void> {
    const startTime = performance.now();

    try {
      // Check if we're the leader for this event type
      const shouldProcess = await this.shouldProcessEvent(event);

      if (!shouldProcess) {
        await this.forwardEventToLeader(event);
        return;
      }

      // Process with distributed coordination
      await this.processEventWithDistributedCoordination(event);

      // Track processing metrics
      this.updateProcessingMetrics(startTime);
    } catch (error) {
      await this.handleDistributedProcessingError(error as Error, event);
      throw error;
    }
  }

  private async shouldProcessEvent(event: IDomainEvent): Promise<boolean> {
    // Check leadership status
    const isLeader = this.consensusProtocol.isLeader();

    // Check event type assignments
    const eventTypeAssignment = await this.getEventTypeAssignment(
      event.eventType
    );

    // Check region responsibility
    const isResponsibleRegion = await this.isResponsibleForEvent(event);

    return isLeader && eventTypeAssignment && isResponsibleRegion;
  }

  private async processEventWithDistributedCoordination(
    event: IDomainEvent
  ): Promise<void> {
    // Create coordination proposal
    const proposal = {
      eventId: event.eventId,
      eventType: event.eventType,
      proposalId: this.generateProposalId(),
      proposedBy: this.distributedCluster.getNodeId(),
      timestamp: new Date(),
      payload: event.payload,
    };

    // Request consensus for processing
    const consensusResult = await this.consensusProtocol.propose(proposal);

    if (!consensusResult.accepted) {
      throw new Error(
        `Consensus rejected for event ${event.eventId}: ${consensusResult.reason}`
      );
    }

    // Process event locally
    await this.processEventLocally(event);

    // Replicate to other regions
    await this.replicateToRegions(event, consensusResult);

    // Update global state
    await this.updateGlobalState(event, consensusResult);
  }

  protected async processEventLocally(event: IDomainEvent): Promise<void> {
    // Circuit breaker protection
    if (this.circuitBreaker.isOpen()) {
      throw new Error('Circuit breaker is open - local processing unavailable');
    }

    try {
      // Process event with retry policy
      await this.retryPolicy.execute(async () => {
        await this.handleEventInternal(event);
      });

      this.circuitBreaker.recordSuccess();
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }

  protected abstract handleEventInternal(event: IDomainEvent): Promise<void>;

  private async replicateToRegions(
    event: IDomainEvent,
    consensusResult: ConsensusResult
  ): Promise<void> {
    const currentState = this.getState();
    const targetRegions = this.getTargetRegionsForReplication(event);

    const replicationTasks = targetRegions.map(async regionId => {
      try {
        const replicationPayload = {
          event,
          consensusResult,
          vectorClock: currentState.replicationState.vectorClock,
          replicationTimestamp: new Date(),
        };

        await this.replicationManager.replicateToRegion(
          regionId,
          replicationPayload
        );

        // Update replication checkpoint
        currentState.replicationState.lastReplicationCheckpoint.set(
          regionId,
          new Date()
        );

        console.log(
          `Successfully replicated event ${event.eventId} to region ${regionId}`
        );
      } catch (error) {
        console.error(
          `Failed to replicate event ${event.eventId} to region ${regionId}:`,
          error
        );

        // Add to pending replications for retry
        const pending =
          currentState.replicationState.pendingReplications.get(regionId) || [];
        pending.push({
          event,
          consensusResult,
          retryCount: 0,
          error: (error as Error).message,
        });
        currentState.replicationState.pendingReplications.set(
          regionId,
          pending
        );
      }
    });

    await Promise.allSettled(replicationTasks);
    this.setState(currentState);
  }

  private async updateGlobalState(
    event: IDomainEvent,
    consensusResult: ConsensusResult
  ): Promise<void> {
    const currentState = this.getState();

    // Update vector clock
    const nodeId = this.distributedCluster.getNodeId();
    const currentClock =
      currentState.replicationState.vectorClock.get(nodeId) || 0;
    currentState.replicationState.vectorClock.set(nodeId, currentClock + 1);

    // Update global metrics
    currentState.globalState.globalMetrics.totalEvents++;

    // Update consensus metrics
    currentState.globalState.globalMetrics.consensusMetrics.proposalsAccepted++;

    // Request global state synchronization
    await this.globalStateManager.requestGlobalSync({
      eventId: event.eventId,
      vectorClock: currentState.replicationState.vectorClock,
      coordinationSequence: currentState.coordinationState
        .coordinationSequence++,
    });

    this.setState(currentState);
  }

  // Event handlers for distributed coordination
  private async handleLeaderElection(
    leaderId: string,
    term: number
  ): Promise<void> {
    const currentState = this.getState();
    currentState.globalState.clusterStatus.currentLeader = leaderId;
    currentState.globalState.clusterStatus.currentTerm = term;

    this.setState(currentState);

    console.log(`New leader elected: ${leaderId} (term ${term})`);

    // If we became leader, initiate global coordination
    if (leaderId === this.distributedCluster.getNodeId()) {
      await this.initiateGlobalCoordination();
    }
  }

  private async handleConsensusReached(
    proposal: any,
    result: ConsensusResult
  ): Promise<void> {
    console.log(
      `Consensus reached for proposal ${proposal.proposalId}: ${result.accepted ? 'ACCEPTED' : 'REJECTED'}`
    );

    if (result.accepted && result.commitInfo) {
      // Apply committed changes
      await this.applyCommittedChanges(proposal, result.commitInfo);
    }
  }

  private async handleNodeJoined(
    nodeId: string,
    region: string
  ): Promise<void> {
    const currentState = this.getState();
    currentState.globalState.clusterStatus.healthyNodes.add(nodeId);

    // Update regional status
    const regionalStatus = currentState.coordinationState.regionStates.get(
      region
    ) || {
      regionId: region,
      healthyNodes: new Set<string>(),
      lastHeartbeat: new Date(),
      isPartitioned: false,
      coordinationLag: 0,
    };

    regionalStatus.healthyNodes.add(nodeId);
    regionalStatus.lastHeartbeat = new Date();
    currentState.coordinationState.regionStates.set(region, regionalStatus);

    this.setState(currentState);
    console.log(`Node ${nodeId} joined cluster in region ${region}`);
  }

  private async handleNodeLeft(nodeId: string, region: string): Promise<void> {
    const currentState = this.getState();
    currentState.globalState.clusterStatus.healthyNodes.delete(nodeId);

    // Update regional status
    const regionalStatus =
      currentState.coordinationState.regionStates.get(region);
    if (regionalStatus) {
      regionalStatus.healthyNodes.delete(nodeId);
      currentState.coordinationState.regionStates.set(region, regionalStatus);
    }

    this.setState(currentState);
    console.log(`Node ${nodeId} left cluster in region ${region}`);

    // Check if we need to trigger failover
    await this.checkFailoverNeeded(region);
  }

  private async handleNetworkPartition(
    affectedRegions: string[]
  ): Promise<void> {
    const currentState = this.getState();

    for (const regionId of affectedRegions) {
      currentState.globalState.clusterStatus.partitionedRegions.add(regionId);

      const regionalStatus =
        currentState.coordinationState.regionStates.get(regionId);
      if (regionalStatus) {
        regionalStatus.isPartitioned = true;
        currentState.coordinationState.regionStates.set(
          regionId,
          regionalStatus
        );
      }
    }

    this.setState(currentState);
    console.warn(
      `Network partition detected affecting regions: ${affectedRegions.join(', ')}`
    );

    // Switch to partition-tolerant mode
    await this.enablePartitionToleranceMode(affectedRegions);
  }

  private async handleReplicationCompleted(
    targetRegion: string,
    status: ReplicationStatus
  ): Promise<void> {
    const currentState = this.getState();

    // Update replication lag metrics
    currentState.globalState.globalMetrics.replicationLag.set(
      targetRegion,
      status.lagMs
    );

    // Remove from pending replications if successful
    if (status.success) {
      currentState.replicationState.pendingReplications.delete(targetRegion);
    }

    this.setState(currentState);
    console.log(
      `Replication completed to region ${targetRegion}: ${status.success ? 'SUCCESS' : 'FAILED'}`
    );
  }

  private async handleGlobalSyncCompleted(
    syncStatus: GlobalSyncStatus
  ): Promise<void> {
    const currentState = this.getState();
    currentState.coordinationState.lastGlobalSync = syncStatus.completedAt;

    // Update region states with sync results
    for (const [regionId, regionSyncStatus] of syncStatus.regionResults) {
      const regionalStatus =
        currentState.coordinationState.regionStates.get(regionId);
      if (regionalStatus) {
        regionalStatus.coordinationLag = regionSyncStatus.lagMs;
        currentState.coordinationState.regionStates.set(
          regionId,
          regionalStatus
        );
      }
    }

    this.setState(currentState);
    console.log(
      `Global sync completed: ${syncStatus.success ? 'SUCCESS' : 'FAILED'}`
    );
  }

  // Query methods for distributed state
  getGlobalProjectionState(): GlobalProjectionState {
    const state = this.getState();
    return state.globalState;
  }

  getRegionalStatuses(): Map<string, RegionalProjectionStatus> {
    return this.getState().coordinationState.regionStates;
  }

  getClusterHealth(): any {
    const state = this.getState();
    const totalRegions = this.regionalCoordinators.size;
    const healthyRegions = Array.from(
      state.coordinationState.regionStates.values()
    ).filter(status => !status.isPartitioned).length;

    return {
      overallHealth: healthyRegions / totalRegions,
      totalNodes: state.globalState.clusterStatus.healthyNodes.size,
      partitionedRegions:
        state.globalState.clusterStatus.partitionedRegions.size,
      currentLeader: state.globalState.clusterStatus.currentLeader,
      currentTerm: state.globalState.clusterStatus.currentTerm,
      averageReplicationLag: this.calculateAverageReplicationLag(),
      consensusMetrics: state.globalState.globalMetrics.consensusMetrics,
    };
  }

  getReplicationStatus(): any {
    const state = this.getState();
    return {
      vectorClock: Object.fromEntries(state.replicationState.vectorClock),
      pendingReplications: Object.fromEntries(
        state.replicationState.pendingReplications
      ),
      lastCheckpoints: Object.fromEntries(
        state.replicationState.lastReplicationCheckpoint
      ),
      conflictCount: state.replicationState.conflictResolutions.length,
    };
  }

  // Administrative operations
  async triggerGlobalSync(): Promise<ServiceResponse<GlobalSyncStatus>> {
    try {
      const syncStatus = await this.globalStateManager.performGlobalSync();

      return {
        success: true,
        data: syncStatus,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          duration: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GLOBAL_SYNC_FAILED',
          message: 'Failed to trigger global synchronization',
          details: { error: (error as Error).message },
        },
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          duration: 0,
        },
      };
    }
  }

  async initiateRegionalFailover(
    sourceRegion: string,
    targetRegion: string
  ): Promise<ServiceResponse<void>> {
    try {
      // Validate failover parameters
      if (
        !this.regionalCoordinators.has(sourceRegion) ||
        !this.regionalCoordinators.has(targetRegion)
      ) {
        throw new Error('Invalid source or target region for failover');
      }

      // Initiate consensus for failover
      const failoverProposal = {
        type: 'regional-failover',
        sourceRegion,
        targetRegion,
        initiatedBy: this.distributedCluster.getNodeId(),
        timestamp: new Date(),
      };

      const consensusResult =
        await this.consensusProtocol.propose(failoverProposal);

      if (!consensusResult.accepted) {
        throw new Error(
          `Failover consensus rejected: ${consensusResult.reason}`
        );
      }

      // Execute failover
      await this.executeRegionalFailover(sourceRegion, targetRegion);

      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          duration: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'FAILOVER_FAILED',
          message: 'Failed to initiate regional failover',
          details: {
            error: (error as Error).message,
            sourceRegion,
            targetRegion,
          },
        },
        metadata: {
          timestamp: new Date(),
          requestId: this.generateRequestId(),
          duration: 0,
        },
      };
    }
  }

  // Helper methods
  private async getEventTypeAssignment(eventType: string): Promise<boolean> {
    // Determine if this node is assigned to handle this event type
    // This could be based on consistent hashing or explicit assignment
    return true; // Simplified for example
  }

  private async isResponsibleForEvent(event: IDomainEvent): Promise<boolean> {
    // Determine regional responsibility based on event attributes
    // Could be based on aggregate ID, customer location, etc.
    return true; // Simplified for example
  }

  private generateProposalId(): string {
    return `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async forwardEventToLeader(event: IDomainEvent): Promise<void> {
    const currentState = this.getState();
    const leaderId = currentState.globalState.clusterStatus.currentLeader;

    if (!leaderId) {
      throw new Error('No leader available to forward event');
    }

    await this.messageBus.send(leaderId, {
      type: 'forward-event',
      event,
      forwardedBy: this.distributedCluster.getNodeId(),
    });
  }

  private getTargetRegionsForReplication(event: IDomainEvent): string[] {
    // Determine which regions should receive this replication
    // Based on replication strategy and compliance requirements
    return Array.from(this.regionalCoordinators.keys()).filter(
      regionId => regionId !== this.getCurrentRegionId()
    );
  }

  private getCurrentRegionId(): string {
    return this.distributedCluster.getCurrentRegionId();
  }

  private calculateAverageReplicationLag(): number {
    const state = this.getState();
    const lagValues = Array.from(
      state.globalState.globalMetrics.replicationLag.values()
    );
    return lagValues.length > 0
      ? lagValues.reduce((sum, lag) => sum + lag, 0) / lagValues.length
      : 0;
  }

  private updateProcessingMetrics(startTime: number): void {
    const processingTime = performance.now() - startTime;
    // Update processing time metrics
    console.log(
      `Distributed event processing completed in ${processingTime}ms`
    );
  }

  // Additional abstract and helper methods
  private async handleDistributedProcessingError(
    error: Error,
    event: IDomainEvent
  ): Promise<void> {
    console.error(
      `Distributed processing error for event ${event.eventId}:`,
      error
    );
    // Implement error handling logic
  }

  private async initiateGlobalCoordination(): Promise<void> {
    console.log('Initiating global coordination as new leader');
    // Implement global coordination initiation
  }

  private async applyCommittedChanges(
    proposal: any,
    commitInfo: any
  ): Promise<void> {
    console.log(
      `Applying committed changes for proposal ${proposal.proposalId}`
    );
    // Implement committed changes application
  }

  private async checkFailoverNeeded(region: string): Promise<void> {
    const regionalStatus =
      this.getState().coordinationState.regionStates.get(region);
    if (regionalStatus && regionalStatus.healthyNodes.size === 0) {
      console.warn(
        `All nodes failed in region ${region}, considering failover`
      );
      // Implement failover logic
    }
  }

  private async enablePartitionToleranceMode(
    affectedRegions: string[]
  ): Promise<void> {
    console.log(
      `Enabling partition tolerance mode for regions: ${affectedRegions.join(', ')}`
    );
    // Implement partition tolerance mode
  }

  private async executeRegionalFailover(
    sourceRegion: string,
    targetRegion: string
  ): Promise<void> {
    console.log(`Executing failover from ${sourceRegion} to ${targetRegion}`);
    // Implement actual failover logic
  }

  private async handleReplicationConflict(conflict: any): Promise<void> {
    console.warn('Handling replication conflict:', conflict);
    // Implement conflict resolution
  }
}

// ✅ FOCUS: Global Order Processing Projection
export class GlobalOrderProcessingProjection extends DistributedProjectionBase<any> {
  constructor(config: DistributedProjectionConfig) {
    super('GlobalOrderProcessingProjection', 'v1.0', config);
  }

  protected createInitialLocalState(): any {
    return {
      orders: new Map<string, any>(),
      ordersByRegion: new Map<string, Map<string, any>>(),
      regionalMetrics: new Map<string, any>(),
      complianceTracking: new Map<string, any>(),
      crossRegionAnalytics: {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        regionalDistribution: new Map<string, number>(),
      },
    };
  }

  protected async handleEventInternal(event: IDomainEvent): Promise<void> {
    const currentState = this.getState();

    switch (event.eventType) {
      case 'OrderPlaced':
        await this.handleGlobalOrderPlaced(event, currentState);
        break;
      case 'OrderShipped':
        await this.handleGlobalOrderShipped(event, currentState);
        break;
      case 'OrderCompleted':
        await this.handleGlobalOrderCompleted(event, currentState);
        break;
      case 'OrderCancelled':
        await this.handleGlobalOrderCancelled(event, currentState);
        break;
      default:
        console.log(
          `Unhandled event type in global projection: ${event.eventType}`
        );
    }

    this.setState(currentState);
  }

  private async handleGlobalOrderPlaced(
    event: IDomainEvent,
    state: any
  ): Promise<void> {
    const orderData = event.payload;
    const region = this.determineOrderRegion(orderData);

    // Store order in global state
    state.localState.orders.set(orderData.orderId, {
      ...orderData,
      region,
      placedAt: new Date(event.timestamp),
      status: 'placed',
      globalSequence: this.getNextGlobalSequence(),
    });

    // Update regional tracking
    if (!state.localState.ordersByRegion.has(region)) {
      state.localState.ordersByRegion.set(region, new Map());
    }
    state.localState.ordersByRegion
      .get(region)!
      .set(orderData.orderId, orderData);

    // Update regional metrics
    this.updateRegionalMetrics(region, orderData, state);

    // Update cross-region analytics
    this.updateCrossRegionAnalytics(orderData, state);

    // Track compliance for region
    await this.trackRegionalCompliance(orderData, region, state);

    console.log(
      `Global order placed: ${orderData.orderId} in region ${region}`
    );
  }

  private async handleGlobalOrderShipped(
    event: IDomainEvent,
    state: any
  ): Promise<void> {
    const shipmentData = event.payload;
    const order = state.localState.orders.get(shipmentData.orderId);

    if (!order) {
      console.warn(
        `Order ${shipmentData.orderId} not found for shipping update`
      );
      return;
    }

    // Update order status
    order.status = 'shipped';
    order.shippedAt = new Date(event.timestamp);
    order.shippingInfo = shipmentData.shippingInfo;

    state.localState.orders.set(shipmentData.orderId, order);

    // Update regional tracking
    const regionMap = state.localState.ordersByRegion.get(order.region);
    if (regionMap) {
      regionMap.set(shipmentData.orderId, order);
    }

    console.log(
      `Global order shipped: ${shipmentData.orderId} in region ${order.region}`
    );
  }

  private determineOrderRegion(orderData: any): string {
    // Determine region based on shipping address, customer location, etc.
    const country =
      orderData.shippingAddress?.country || orderData.billingAddress?.country;

    const regionMapping: Record<string, string> = {
      US: 'us-east-1',
      CA: 'us-east-1',
      GB: 'eu-west-1',
      FR: 'eu-west-1',
      DE: 'eu-west-1',
      JP: 'ap-northeast-1',
      AU: 'ap-southeast-2',
    };

    return regionMapping[country] || 'us-east-1';
  }

  private getNextGlobalSequence(): number {
    // Generate globally unique sequence number
    return Date.now();
  }

  private updateRegionalMetrics(
    region: string,
    orderData: any,
    state: any
  ): void {
    const metrics = state.localState.regionalMetrics.get(region) || {
      orderCount: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      lastUpdated: new Date(),
    };

    metrics.orderCount++;
    metrics.totalRevenue += orderData.total || 0;
    metrics.averageOrderValue = metrics.totalRevenue / metrics.orderCount;
    metrics.lastUpdated = new Date();

    state.localState.regionalMetrics.set(region, metrics);
  }

  private updateCrossRegionAnalytics(orderData: any, state: any): void {
    const analytics = state.localState.crossRegionAnalytics;

    analytics.totalOrders++;
    analytics.totalRevenue += orderData.total || 0;
    analytics.averageOrderValue =
      analytics.totalRevenue / analytics.totalOrders;

    const region = this.determineOrderRegion(orderData);
    const regionalCount = analytics.regionalDistribution.get(region) || 0;
    analytics.regionalDistribution.set(region, regionalCount + 1);
  }

  private async trackRegionalCompliance(
    orderData: any,
    region: string,
    state: any
  ): Promise<void> {
    const compliance = state.localState.complianceTracking.get(region) || {
      dataResidencyCompliant: true,
      encryptionRequired: true,
      auditTrailMaintained: true,
      regulatoryRequirements: [],
    };

    // Add region-specific compliance checks
    switch (region) {
      case 'eu-west-1':
        compliance.regulatoryRequirements.push('GDPR');
        break;
      case 'us-east-1':
        compliance.regulatoryRequirements.push('SOX', 'CCPA');
        break;
      case 'ap-northeast-1':
        compliance.regulatoryRequirements.push('APPI');
        break;
    }

    state.localState.complianceTracking.set(region, compliance);
  }

  // Query methods for global insights
  getGlobalOrderStatistics(): any {
    const state = this.getState();
    return {
      totalOrders: state.localState.crossRegionAnalytics.totalOrders,
      totalRevenue: state.localState.crossRegionAnalytics.totalRevenue,
      averageOrderValue:
        state.localState.crossRegionAnalytics.averageOrderValue,
      regionalDistribution: Object.fromEntries(
        state.localState.crossRegionAnalytics.regionalDistribution
      ),
      regionalMetrics: Object.fromEntries(state.localState.regionalMetrics),
    };
  }

  getRegionalCompliance(): any {
    const state = this.getState();
    return Object.fromEntries(state.localState.complianceTracking);
  }

  getOrdersByRegion(region: string): any[] {
    const state = this.getState();
    const regionMap = state.localState.ordersByRegion.get(region);
    return regionMap ? Array.from(regionMap.values()) : [];
  }

  // Additional handler methods
  private async handleGlobalOrderCompleted(
    event: IDomainEvent,
    state: any
  ): Promise<void> {
    const completionData = event.payload;
    const order = state.localState.orders.get(completionData.orderId);

    if (!order) {
      console.warn(
        `Order ${completionData.orderId} not found for completion update`
      );
      return;
    }

    order.status = 'completed';
    order.completedAt = new Date(event.timestamp);
    state.localState.orders.set(completionData.orderId, order);

    console.log(
      `Global order completed: ${completionData.orderId} in region ${order.region}`
    );
  }

  private async handleGlobalOrderCancelled(
    event: IDomainEvent,
    state: any
  ): Promise<void> {
    const cancellationData = event.payload;
    const order = state.localState.orders.get(cancellationData.orderId);

    if (!order) {
      console.warn(
        `Order ${cancellationData.orderId} not found for cancellation update`
      );
      return;
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date(event.timestamp);
    order.cancellationReason = cancellationData.reason;
    state.localState.orders.set(cancellationData.orderId, order);

    console.log(
      `Global order cancelled: ${cancellationData.orderId} in region ${order.region}`
    );
  }
}

// Global Projection Orchestrator
export class GlobalProjectionOrchestrator {
  private distributedProjections: Map<string, DistributedProjectionBase<any>> =
    new Map();
  private globalEventBus: MessageBus;
  private coordinationProtocol: CoordinationProtocol;

  constructor(config: any) {
    this.globalEventBus = new MessageBus({
      protocol: 'global',
      encryption: true,
      compression: true,
    });

    this.coordinationProtocol = new CoordinationProtocol({
      algorithm: 'raft',
      regions: config.regions,
    });
  }

  registerDistributedProjection(
    projection: DistributedProjectionBase<any>
  ): void {
    this.distributedProjections.set(projection.projectionName, projection);
    console.log(
      `Registered distributed projection: ${projection.projectionName}`
    );
  }

  async processGlobalEvent(event: IDomainEvent): Promise<void> {
    const relevantProjections = Array.from(
      this.distributedProjections.values()
    ).filter(projection => projection.canHandle(event.eventType));

    const processingPromises = relevantProjections.map(projection =>
      projection.handle(event).catch(error => {
        console.error(
          `Error processing event in projection ${projection.projectionName}:`,
          error
        );
        return error;
      })
    );

    const results = await Promise.allSettled(processingPromises);

    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.warn(
        `${failures.length} projections failed to process event ${event.eventId}`
      );
    }
  }

  async getGlobalHealthStatus(): Promise<any> {
    const projectionHealths = await Promise.all(
      Array.from(this.distributedProjections.values()).map(
        async projection => ({
          projectionName: projection.projectionName,
          health: projection.getClusterHealth(),
        })
      )
    );

    return {
      overallHealth:
        projectionHealths.reduce((sum, p) => sum + p.health.overallHealth, 0) /
        projectionHealths.length,
      projectionHealths,
      totalProjections: this.distributedProjections.size,
      timestamp: new Date(),
    };
  }
}
```

## Key Features

- **Global Distribution**: Multi-region deployment with automatic coordination
- **Consensus Algorithms**: Raft/PBFT/Paxos for distributed decision making
- **Network Partition Tolerance**: Graceful degradation during network splits
- **Automatic Failover**: Regional failover with minimal data loss
- **Compliance Support**: Region-specific regulatory compliance tracking
- **Vector Clocks**: Causal consistency across distributed nodes

## Usage Examples

```typescript
// Configure distributed projection system
const distributedConfig: DistributedProjectionConfig = {
  regions: [
    {
      regionId: 'us-east-1',
      nodes: ['node1-us', 'node2-us', 'node3-us'],
      coordinationProtocol: 'gossip',
      healthCheckInterval: 30000,
    },
    {
      regionId: 'eu-west-1',
      nodes: ['node1-eu', 'node2-eu'],
      coordinationProtocol: 'gossip',
      healthCheckInterval: 30000,
    },
    {
      regionId: 'ap-northeast-1',
      nodes: ['node1-ap'],
      coordinationProtocol: 'gossip',
      healthCheckInterval: 30000,
    },
  ],
  replicationFactor: 2,
  consistencyLevel: 'strong',
  consensusAlgorithm: 'raft',
  replicationStrategy: 'async',
  conflictResolution: 'last-write-wins',
  enableEncryption: true,
  enableCompression: true,
};

// Create distributed projection
const globalProjection = new GlobalOrderProcessingProjection(distributedConfig);

// Create orchestrator
const orchestrator = new GlobalProjectionOrchestrator({
  regions: distributedConfig.regions,
});

orchestrator.registerDistributedProjection(globalProjection);

// Process global events
await orchestrator.processGlobalEvent({
  eventId: '1001',
  eventType: 'OrderPlaced',
  aggregateId: 'order-1',
  payload: {
    orderId: 'order-1',
    customerId: 'customer-1',
    total: 299.99,
    items: [{ productId: 'product-1', quantity: 1, price: 299.99 }],
    shippingAddress: { country: 'US', state: 'NY' },
    billingAddress: { country: 'US', state: 'NY' },
  },
  timestamp: new Date(),
  version: 1,
});

// Monitor cluster health
const healthStatus = await orchestrator.getGlobalHealthStatus();
console.log('Global health status:', healthStatus);

// Get global order statistics
const globalStats = globalProjection.getGlobalOrderStatistics();
console.log('Global order statistics:', globalStats);

// Check regional compliance
const compliance = globalProjection.getRegionalCompliance();
console.log('Regional compliance status:', compliance);

// Get cluster health details
const clusterHealth = globalProjection.getClusterHealth();
console.log('Cluster health:', clusterHealth);

// Get replication status
const replicationStatus = globalProjection.getReplicationStatus();
console.log('Replication status:', replicationStatus);

// Trigger manual global sync
const syncResult = await globalProjection.triggerGlobalSync();
console.log('Global sync result:', syncResult);

// Initiate regional failover if needed
const failoverResult = await globalProjection.initiateRegionalFailover(
  'us-east-1',
  'us-west-2'
);
console.log('Failover result:', failoverResult);
```

## Distributed Patterns

### **Consensus Algorithms**

```typescript
// Raft consensus for leader election
// PBFT for Byzantine fault tolerance
// Paxos for strong consistency guarantees
```

### **Replication Strategies**

```typescript
// Synchronous - strong consistency, higher latency
// Asynchronous - eventual consistency, better performance
// Hybrid - configurable per operation type
```

### **Conflict Resolution**

```typescript
// Last-write-wins - simple, eventual consistency
// Vector clocks - causal consistency
// Custom resolution - business rule based
```

## Global Compliance

### **Data Sovereignty**

- Regional data residency enforcement
- Cross-border data transfer controls
- Regulatory compliance tracking

### **Encryption**

- Region-specific encryption keys
- Transport layer security
- At-rest encryption

### **Audit Requirements**

- Comprehensive audit trails
- Cross-region audit log synchronization
- Compliance reporting

## Scalability Features

### **Horizontal Scaling**

- Automatic node discovery and registration
- Dynamic load balancing across regions
- Elastic scaling based on demand

### **Performance Optimization**

- Regional data locality
- Intelligent routing
- Connection pooling

### **Resource Management**

- Per-region resource allocation
- Cross-region load balancing
- Capacity planning automation

## Best Practices

- **Design for Partitions**: Always assume network partitions will occur
- **Monitor Extensively**: Implement comprehensive monitoring across all regions
- **Test Failover**: Regularly test failover scenarios
- **Optimize Locally**: Process data close to where it originates
- **Plan for Compliance**: Design region-specific compliance from the start
- **Version Everything**: Use vector clocks for proper causal ordering

## Common Pitfalls

- **Split-Brain Scenarios**: Inadequate quorum configuration
- **Replication Lag**: Network latency causing consistency issues
- **Resource Exhaustion**: Poor capacity planning across regions
- **Compliance Violations**: Inadequate data sovereignty controls
- **Monitoring Blind Spots**: Insufficient visibility into distributed state

## Related Examples

- [Multi-Tenant Projections](../intermediate/example-3.md)
- [Event Stream Processing](../intermediate/example-2.md)
- [Projection Rebuilding System](../intermediate/example-1.md)
- [Projection with Capabilities](../basic/example-2.md)
