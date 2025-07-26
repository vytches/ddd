# Projection Rebuilding System

**Version**: 1.0.0 **Package**: @vytches/ddd-projections **Complexity**:
intermediate **Domain**: Event Sourcing **Patterns**: Projection rebuilding,
snapshots, optimization **Dependencies**: @vytches/ddd-projections,
@vytches/ddd-events, @vytches/ddd-event-store

## Description

Advanced projection rebuilding system with snapshot optimization and incremental
reconstruction. This example demonstrates how to implement projection rebuilding
mechanisms that can efficiently reconstruct read models from event streams,
including snapshot-based optimizations and incremental updates for minimal
downtime.

## Business Context

Production systems require projection rebuilding capabilities:

- Schema migrations requiring projection reconstruction
- Data corruption recovery from known good states
- Performance optimization through snapshot-based rebuilding
- Version upgrades with backward compatibility
- A/B testing with different projection implementations
- Disaster recovery and business continuity

This system enables zero-downtime rebuilding with minimal impact on read
operations.

## Code Example

```typescript
// projection-rebuilding-system.ts
import {
  ProjectionBase,
  ProjectionEngine,
  ProjectionSnapshot,
  ProjectionRebuilder,
  SnapshotCapability,
  CheckpointCapability,
} from '@vytches/ddd-projections';
import { IDomainEvent, IEventStore } from '@vytches/ddd-events';
import {
  UserData,
  OrderData,
  ProductData,
  ProjectionSnapshot as SnapshotType,
  ProjectionRebuilderConfig,
  SnapshotMetadata,
  RebuildProgress,
  ServiceResponse,
} from '../types';

// Enhanced User Profile Projection with Snapshot Support
export class RebuildableUserProjection extends ProjectionBase<any> {
  private snapshotCapability: SnapshotCapability;
  private checkpointCapability: CheckpointCapability;
  private snapshotVersion: number = 1;

  constructor() {
    super('RebuildableUserProjection', 'v2.0');

    // Initialize state with versioning info
    this.setState({
      users: new Map<string, UserData>(),
      usersByRole: new Map<string, Set<string>>(),
      usersByRegistrationDate: new Map<string, Set<string>>(),
      totalUsers: 0,
      activeUsers: 0,
      userGrowthStats: {
        dailyRegistrations: new Map<string, number>(),
        monthlyGrowth: new Map<string, number>(),
      },
      lastUpdated: new Date(),
      version: this.snapshotVersion,
    });

    this.setupCapabilities();
  }

  private setupCapabilities(): void {
    // Enhanced snapshot capability with compression
    this.snapshotCapability = new SnapshotCapability({
      projectionName: this.projectionName,
      snapshotInterval: 10000, // Every 10k events
      timeInterval: 60 * 60 * 1000, // Every hour
      compressionEnabled: true,
      maxSnapshots: 10, // Keep last 10 snapshots
      storage: 'persistent', // Use persistent storage
    });

    // Checkpoint capability for progress tracking
    this.checkpointCapability = new CheckpointCapability({
      projectionName: this.projectionName,
      checkpointInterval: 1000,
      timeInterval: 5 * 60 * 1000, // 5 minutes
      storage: 'persistent',
    });

    this.setupCapabilityEventHandlers();
  }

  private setupCapabilityEventHandlers(): void {
    this.snapshotCapability.on('snapshotCreated', (snapshot: SnapshotType) => {
      console.log(
        `Snapshot created for ${this.projectionName} at position ${snapshot.position}`
      );
    });

    this.snapshotCapability.on('snapshotRestored', (snapshot: SnapshotType) => {
      console.log(
        `Snapshot restored for ${this.projectionName} from position ${snapshot.position}`
      );
    });
  }

  async handle(event: IDomainEvent): Promise<void> {
    const startTime = performance.now();

    try {
      await this.processEventInternal(event);

      // Update checkpoint
      await this.checkpointCapability.updatePosition(
        event.aggregateId,
        this.getCurrentEventPosition(event)
      );

      // Check if snapshot should be created
      await this.snapshotCapability.considerSnapshot(
        this.getCurrentEventPosition(event),
        this.getState()
      );
    } catch (error) {
      console.error(`Error processing event ${event.eventId}:`, error);
      throw error;
    }
  }

  private async processEventInternal(event: IDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'UserRegistered':
        await this.handleUserRegistered(event);
        break;
      case 'UserProfileUpdated':
        await this.handleUserProfileUpdated(event);
        break;
      case 'UserRoleChanged':
        await this.handleUserRoleChanged(event);
        break;
      case 'UserDeactivated':
        await this.handleUserDeactivated(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.eventType}`);
    }

    // Update projection metadata
    const currentState = this.getState();
    currentState.lastUpdated = new Date();
    this.setState(currentState);
  }

  private async handleUserRegistered(event: IDomainEvent): Promise<void> {
    const userData = event.payload;
    const currentState = this.getState();

    const user: UserData = {
      id: userData.userId,
      email: userData.email,
      name: userData.name,
      role: userData.role || 'user',
      createdAt: new Date(event.timestamp),
      preferences: userData.preferences || {},
    };

    // Add to main user map
    currentState.users.set(user.id, user);

    // Update role-based index
    const roleUsers = currentState.usersByRole.get(user.role) || new Set();
    roleUsers.add(user.id);
    currentState.usersByRole.set(user.role, roleUsers);

    // Update date-based index
    const registrationDate = user.createdAt.toISOString().split('T')[0];
    const dateUsers =
      currentState.usersByRegistrationDate.get(registrationDate) || new Set();
    dateUsers.add(user.id);
    currentState.usersByRegistrationDate.set(registrationDate, dateUsers);

    // Update growth statistics
    const dailyCount =
      currentState.userGrowthStats.dailyRegistrations.get(registrationDate) ||
      0;
    currentState.userGrowthStats.dailyRegistrations.set(
      registrationDate,
      dailyCount + 1
    );

    // Update totals
    currentState.totalUsers = currentState.users.size;
    currentState.activeUsers = Array.from(currentState.users.values()).filter(
      u => u.role !== 'deactivated'
    ).length;

    this.setState(currentState);
    console.log(`User registered: ${user.name} (${user.id})`);
  }

  private async handleUserRoleChanged(event: IDomainEvent): Promise<void> {
    const roleData = event.payload;
    const currentState = this.getState();
    const user = currentState.users.get(roleData.userId);

    if (!user) {
      console.warn(`User ${roleData.userId} not found for role change`);
      return;
    }

    const oldRole = user.role;
    const newRole = roleData.newRole;

    // Update user
    const updatedUser: UserData = {
      ...user,
      role: newRole,
    };

    currentState.users.set(updatedUser.id, updatedUser);

    // Update role indexes
    const oldRoleUsers = currentState.usersByRole.get(oldRole);
    if (oldRoleUsers) {
      oldRoleUsers.delete(user.id);
      if (oldRoleUsers.size === 0) {
        currentState.usersByRole.delete(oldRole);
      } else {
        currentState.usersByRole.set(oldRole, oldRoleUsers);
      }
    }

    const newRoleUsers = currentState.usersByRole.get(newRole) || new Set();
    newRoleUsers.add(user.id);
    currentState.usersByRole.set(newRole, newRoleUsers);

    // Update active users count
    currentState.activeUsers = Array.from(currentState.users.values()).filter(
      u => u.role !== 'deactivated'
    ).length;

    this.setState(currentState);
    console.log(
      `User role changed: ${user.name} from ${oldRole} to ${newRole}`
    );
  }

  // Enhanced query methods with optimized indexes
  getUserById(userId: string): UserData | undefined {
    return this.getState().users.get(userId);
  }

  getUsersByRole(role: string): UserData[] {
    const userIds = this.getState().usersByRole.get(role) || new Set();
    return Array.from(userIds)
      .map(id => this.getState().users.get(id))
      .filter(Boolean) as UserData[];
  }

  getUsersByDateRange(startDate: string, endDate: string): UserData[] {
    const users: UserData[] = [];

    for (const [date, userIds] of this.getState().usersByRegistrationDate) {
      if (date >= startDate && date <= endDate) {
        for (const userId of userIds) {
          const user = this.getState().users.get(userId);
          if (user) {
            users.push(user);
          }
        }
      }
    }

    return users;
  }

  getGrowthStatistics(): any {
    const state = this.getState();
    const last30Days = Array.from(
      state.userGrowthStats.dailyRegistrations.entries()
    ).filter(([date]) => {
      const registrationDate = new Date(date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return registrationDate >= thirtyDaysAgo;
    });

    const totalLast30Days = last30Days.reduce(
      (sum, [, count]) => sum + count,
      0
    );
    const averagePerDay = totalLast30Days / Math.max(last30Days.length, 1);

    return {
      totalUsers: state.totalUsers,
      activeUsers: state.activeUsers,
      last30DaysRegistrations: totalLast30Days,
      averageRegistrationsPerDay: Math.round(averagePerDay * 100) / 100,
      growthTrend: this.calculateGrowthTrend(),
    };
  }

  // Snapshot management methods
  async createSnapshot(): Promise<SnapshotType> {
    const snapshot = await this.snapshotCapability.createSnapshot(
      this.getState()
    );
    console.log(`Manual snapshot created for ${this.projectionName}`);
    return snapshot;
  }

  async restoreFromSnapshot(snapshotId?: string): Promise<boolean> {
    const snapshot = snapshotId
      ? await this.snapshotCapability.getSnapshot(snapshotId)
      : await this.snapshotCapability.getLatestSnapshot();

    if (!snapshot) {
      return false;
    }

    this.setState(snapshot.data);
    console.log(
      `Restored ${this.projectionName} from snapshot at position ${snapshot.position}`
    );
    return true;
  }

  getSnapshotInfo(): SnapshotMetadata[] {
    return this.snapshotCapability.getSnapshotHistory();
  }

  private calculateGrowthTrend(): 'increasing' | 'stable' | 'decreasing' {
    const state = this.getState();
    const last7Days = Array.from(
      state.userGrowthStats.dailyRegistrations.entries()
    )
      .filter(([date]) => {
        const registrationDate = new Date(date);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return registrationDate >= sevenDaysAgo;
      })
      .sort(([a], [b]) => a.localeCompare(b));

    if (last7Days.length < 3) return 'stable';

    const firstHalf = last7Days.slice(0, Math.floor(last7Days.length / 2));
    const secondHalf = last7Days.slice(Math.floor(last7Days.length / 2));

    const firstHalfAvg =
      firstHalf.reduce((sum, [, count]) => sum + count, 0) / firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, [, count]) => sum + count, 0) / secondHalf.length;

    if (secondHalfAvg > firstHalfAvg * 1.1) return 'increasing';
    if (secondHalfAvg < firstHalfAvg * 0.9) return 'decreasing';
    return 'stable';
  }

  private getCurrentEventPosition(event: IDomainEvent): number {
    return parseInt(event.eventId) || Date.now();
  }

  // Additional handlers...
  private async handleUserProfileUpdated(event: IDomainEvent): Promise<void> {
    const updateData = event.payload;
    const currentState = this.getState();
    const existingUser = currentState.users.get(updateData.userId);

    if (!existingUser) {
      console.warn(`User ${updateData.userId} not found for profile update`);
      return;
    }

    const updatedUser: UserData = {
      ...existingUser,
      name: updateData.name || existingUser.name,
      email: updateData.email || existingUser.email,
      preferences: {
        ...existingUser.preferences,
        ...(updateData.preferences || {}),
      },
    };

    currentState.users.set(updatedUser.id, updatedUser);
    this.setState(currentState);
    console.log(`User profile updated: ${updatedUser.name}`);
  }

  private async handleUserDeactivated(event: IDomainEvent): Promise<void> {
    const deactivationData = event.payload;
    const currentState = this.getState();
    const existingUser = currentState.users.get(deactivationData.userId);

    if (!existingUser) {
      console.warn(
        `User ${deactivationData.userId} not found for deactivation`
      );
      return;
    }

    await this.handleUserRoleChanged({
      ...event,
      payload: {
        userId: deactivationData.userId,
        newRole: 'deactivated',
        reason: deactivationData.reason,
      },
    });
  }
}

// ✅ FOCUS: Projection Rebuilder Implementation
export class ProjectionRebuilder {
  private eventStore: IEventStore;
  private config: ProjectionRebuilderConfig;
  private isRebuilding = false;
  private rebuildProgress: RebuildProgress;

  constructor(eventStore: IEventStore, config: ProjectionRebuilderConfig) {
    this.eventStore = eventStore;
    this.config = config;
    this.rebuildProgress = {
      totalEvents: 0,
      processedEvents: 0,
      startTime: new Date(),
      estimatedCompletion: null,
      currentPhase: 'preparing',
    };
  }

  async rebuildProjection(
    projection: ProjectionBase<any>,
    options: {
      fromSnapshot?: string;
      fromPosition?: number;
      toPosition?: number;
      batchSize?: number;
      useTemporaryProjection?: boolean;
    } = {}
  ): Promise<ServiceResponse<void>> {
    if (this.isRebuilding) {
      return {
        success: false,
        error: {
          code: 'REBUILD_IN_PROGRESS',
          message: 'Projection rebuild is already in progress',
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'rebuild-' + Date.now(),
          duration: 0,
        },
      };
    }

    this.isRebuilding = true;
    this.rebuildProgress.startTime = new Date();
    this.rebuildProgress.currentPhase = 'preparing';

    try {
      console.log(`Starting rebuild of ${projection.projectionName}`);

      // Phase 1: Prepare for rebuild
      const startPosition = await this.determineStartPosition(
        projection,
        options
      );
      const endPosition =
        options.toPosition || (await this.getLatestEventPosition());
      const estimatedEvents = endPosition - startPosition;

      this.rebuildProgress.totalEvents = estimatedEvents;
      this.rebuildProgress.processedEvents = 0;
      this.rebuildProgress.currentPhase = 'rebuilding';

      // Phase 2: Create temporary projection if requested
      let targetProjection = projection;
      if (options.useTemporaryProjection) {
        targetProjection = this.createTemporaryProjection(projection);
        console.log('Created temporary projection for zero-downtime rebuild');
      }

      // Phase 3: Restore from snapshot if available
      if (options.fromSnapshot) {
        await this.restoreFromSnapshot(targetProjection, options.fromSnapshot);
        console.log(`Restored from snapshot: ${options.fromSnapshot}`);
      } else {
        // Reset projection state for full rebuild
        if (
          'reset' in targetProjection &&
          typeof targetProjection.reset === 'function'
        ) {
          targetProjection.reset();
        }
      }

      // Phase 4: Process events in batches
      await this.processEventStream(
        targetProjection,
        startPosition,
        endPosition,
        options.batchSize || this.config.defaultBatchSize || 1000
      );

      // Phase 5: Swap projections if using temporary
      if (options.useTemporaryProjection && targetProjection !== projection) {
        await this.swapProjections(projection, targetProjection);
        console.log('Swapped temporary projection with main projection');
      }

      // Phase 6: Create final snapshot
      if (
        'createSnapshot' in targetProjection &&
        typeof targetProjection.createSnapshot === 'function'
      ) {
        await targetProjection.createSnapshot();
        console.log('Created post-rebuild snapshot');
      }

      this.rebuildProgress.currentPhase = 'completed';
      console.log(
        `Rebuild of ${projection.projectionName} completed successfully`
      );

      return {
        success: true,
        metadata: {
          timestamp: new Date(),
          requestId: 'rebuild-' + Date.now(),
          duration: Date.now() - this.rebuildProgress.startTime.getTime(),
        },
      };
    } catch (error) {
      this.rebuildProgress.currentPhase = 'failed';
      console.error(`Rebuild failed for ${projection.projectionName}:`, error);

      return {
        success: false,
        error: {
          code: 'REBUILD_FAILED',
          message: 'Projection rebuild failed',
          details: { error: (error as Error).message },
        },
        metadata: {
          timestamp: new Date(),
          requestId: 'rebuild-' + Date.now(),
          duration: Date.now() - this.rebuildProgress.startTime.getTime(),
        },
      };
    } finally {
      this.isRebuilding = false;
    }
  }

  private async determineStartPosition(
    projection: ProjectionBase<any>,
    options: any
  ): Promise<number> {
    // Check for explicit start position
    if (options.fromPosition !== undefined) {
      return options.fromPosition;
    }

    // Check for snapshot-based start
    if (options.fromSnapshot) {
      const snapshot = await this.getSnapshotPosition(
        projection,
        options.fromSnapshot
      );
      if (snapshot) {
        return snapshot.position;
      }
    }

    // Default to beginning of stream
    return 0;
  }

  private async getLatestEventPosition(): Promise<number> {
    // In a real implementation, this would query the event store
    // for the latest event position
    return Date.now(); // Simplified for example
  }

  private async getSnapshotPosition(
    projection: ProjectionBase<any>,
    snapshotId: string
  ): Promise<{ position: number } | null> {
    // In a real implementation, this would retrieve snapshot metadata
    return { position: 0 }; // Simplified for example
  }

  private createTemporaryProjection(
    original: ProjectionBase<any>
  ): ProjectionBase<any> {
    // Create a copy of the projection with a temporary name
    const tempProjection = Object.create(Object.getPrototypeOf(original));
    Object.assign(tempProjection, original);
    tempProjection.projectionName = `${original.projectionName}_temp_${Date.now()}`;
    return tempProjection;
  }

  private async restoreFromSnapshot(
    projection: ProjectionBase<any>,
    snapshotId: string
  ): Promise<void> {
    if (
      'restoreFromSnapshot' in projection &&
      typeof projection.restoreFromSnapshot === 'function'
    ) {
      await projection.restoreFromSnapshot(snapshotId);
    }
  }

  private async processEventStream(
    projection: ProjectionBase<any>,
    startPosition: number,
    endPosition: number,
    batchSize: number
  ): Promise<void> {
    let currentPosition = startPosition;

    while (currentPosition < endPosition) {
      const batchEnd = Math.min(currentPosition + batchSize, endPosition);

      // Get batch of events from event store
      const events = await this.eventStore.getEvents({
        fromPosition: currentPosition,
        toPosition: batchEnd,
        limit: batchSize,
      });

      // Process batch
      for (const event of events) {
        try {
          if (projection.canHandle(event.eventType)) {
            await projection.handle(event);
          }

          this.rebuildProgress.processedEvents++;
          this.updateProgressEstimate();
        } catch (error) {
          console.error(
            `Error processing event ${event.eventId} during rebuild:`,
            error
          );
          if (this.config.stopOnError) {
            throw error;
          }
        }
      }

      currentPosition = batchEnd;

      // Progress logging
      if (this.rebuildProgress.processedEvents % 10000 === 0) {
        const progressPercent =
          (this.rebuildProgress.processedEvents /
            this.rebuildProgress.totalEvents) *
          100;
        console.log(
          `Rebuild progress: ${progressPercent.toFixed(1)}% (${this.rebuildProgress.processedEvents}/${this.rebuildProgress.totalEvents})`
        );
      }

      // Allow other operations to process
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  private async swapProjections(
    original: ProjectionBase<any>,
    temporary: ProjectionBase<any>
  ): Promise<void> {
    // In a real implementation, this would atomically swap the projections
    // This might involve updating registry entries, database connections, etc.
    const originalState = original.getState();
    const temporaryState = temporary.getState();

    original.setState(temporaryState);
    console.log(
      `Swapped state from temporary projection to ${original.projectionName}`
    );
  }

  private updateProgressEstimate(): void {
    const now = new Date();
    const elapsed = now.getTime() - this.rebuildProgress.startTime.getTime();
    const eventsPerMs = this.rebuildProgress.processedEvents / elapsed;
    const remainingEvents =
      this.rebuildProgress.totalEvents - this.rebuildProgress.processedEvents;
    const estimatedRemainingMs = remainingEvents / eventsPerMs;

    this.rebuildProgress.estimatedCompletion = new Date(
      now.getTime() + estimatedRemainingMs
    );
  }

  getRebuildProgress(): RebuildProgress {
    return { ...this.rebuildProgress };
  }

  isCurrentlyRebuilding(): boolean {
    return this.isRebuilding;
  }
}

// Projection Rebuilder Factory
export class ProjectionRebuilderFactory {
  static create(
    eventStore: IEventStore,
    config: Partial<ProjectionRebuilderConfig> = {}
  ): ProjectionRebuilder {
    const defaultConfig: ProjectionRebuilderConfig = {
      defaultBatchSize: 1000,
      stopOnError: false,
      enableProgressLogging: true,
      snapshotAfterRebuild: true,
      maxConcurrentRebuilds: 1,
    };

    return new ProjectionRebuilder(eventStore, { ...defaultConfig, ...config });
  }

  static async rebuildWithSnapshots(
    eventStore: IEventStore,
    projections: ProjectionBase<any>[],
    options: {
      useLatestSnapshots?: boolean;
      batchSize?: number;
      parallel?: boolean;
    } = {}
  ): Promise<ServiceResponse<void>[]> {
    const rebuilder = ProjectionRebuilderFactory.create(eventStore, {
      defaultBatchSize: options.batchSize || 1000,
    });

    const rebuildPromises = projections.map(projection =>
      rebuilder.rebuildProjection(projection, {
        fromSnapshot: options.useLatestSnapshots ? 'latest' : undefined,
        useTemporaryProjection: true,
        batchSize: options.batchSize,
      })
    );

    if (options.parallel) {
      return await Promise.all(rebuildPromises);
    } else {
      const results: ServiceResponse<void>[] = [];
      for (const rebuildPromise of rebuildPromises) {
        results.push(await rebuildPromise);
      }
      return results;
    }
  }
}
```

## Key Features

- **Snapshot-Based Rebuilding**: Efficient rebuilding from snapshots to minimize
  processing time
- **Zero-Downtime Rebuilds**: Temporary projection swapping for continuous
  availability
- **Batch Processing**: Configurable batch sizes for optimal performance
- **Progress Tracking**: Real-time rebuild progress monitoring and estimation
- **Error Handling**: Configurable error handling with stop-on-error options
- **Index Optimization**: Enhanced data structures for fast queries during
  rebuilds

## Usage Examples

```typescript
// Setup rebuilder with event store
const eventStore = new InMemoryEventStore(); // Your event store implementation
const rebuilder = ProjectionRebuilderFactory.create(eventStore, {
  defaultBatchSize: 5000,
  stopOnError: false,
  enableProgressLogging: true,
});

// Create projection
const userProjection = new RebuildableUserProjection();

// Rebuild from latest snapshot with zero downtime
const rebuildResult = await rebuilder.rebuildProjection(userProjection, {
  fromSnapshot: 'latest',
  useTemporaryProjection: true,
  batchSize: 1000,
});

if (rebuildResult.success) {
  console.log('Projection rebuilt successfully');

  // Check final state
  const stats = userProjection.getGrowthStatistics();
  console.log('Post-rebuild statistics:', stats);

  // Create new snapshot
  await userProjection.createSnapshot();
} else {
  console.error('Rebuild failed:', rebuildResult.error);
}

// Monitor rebuild progress
const progressMonitor = setInterval(() => {
  if (rebuilder.isCurrentlyRebuilding()) {
    const progress = rebuilder.getRebuildProgress();
    console.log(
      `Rebuild Progress: ${progress.currentPhase} - ${progress.processedEvents}/${progress.totalEvents}`
    );

    if (progress.estimatedCompletion) {
      console.log(
        `Estimated completion: ${progress.estimatedCompletion.toISOString()}`
      );
    }
  } else {
    clearInterval(progressMonitor);
  }
}, 5000);

// Batch rebuild multiple projections
const orderProjection = new OrderSummaryProjection();
const productProjection = new ProductCatalogProjection();

const batchResults = await ProjectionRebuilderFactory.rebuildWithSnapshots(
  eventStore,
  [userProjection, orderProjection, productProjection],
  {
    useLatestSnapshots: true,
    batchSize: 2000,
    parallel: false, // Rebuild sequentially to avoid resource contention
  }
);

// Check results
batchResults.forEach((result, index) => {
  const projectionName = [userProjection, orderProjection, productProjection][
    index
  ].projectionName;
  if (result.success) {
    console.log(`${projectionName}: Rebuild successful`);
  } else {
    console.error(`${projectionName}: Rebuild failed -`, result.error?.message);
  }
});
```

## Rebuilding Strategies

### **Full Rebuild**

Complete reconstruction from the beginning of the event stream.

```typescript
await rebuilder.rebuildProjection(projection, {
  fromPosition: 0,
  useTemporaryProjection: true,
});
```

### **Snapshot-Based Rebuild**

Start from the most recent snapshot for faster rebuilding.

```typescript
await rebuilder.rebuildProjection(projection, {
  fromSnapshot: 'latest',
  useTemporaryProjection: true,
});
```

### **Incremental Rebuild**

Rebuild only from a specific position forward.

```typescript
await rebuilder.rebuildProjection(projection, {
  fromPosition: lastKnownPosition,
  toPosition: currentPosition,
});
```

### **Schema Migration Rebuild**

Rebuild with a new projection version for schema changes.

```typescript
const newVersionProjection = new RebuildableUserProjectionV2();
await rebuilder.rebuildProjection(newVersionProjection, {
  fromSnapshot: 'latest',
  useTemporaryProjection: true,
});
```

## Performance Optimization

### **Batch Size Tuning**

- Small batches (100-1000): Better progress tracking, more checkpointing
- Large batches (5000-10000): Better throughput, less overhead
- Very large batches (50000+): Risk of memory issues, poor progress visibility

### **Memory Management**

```typescript
// Example of memory-conscious rebuilding
const rebuilder = ProjectionRebuilderFactory.create(eventStore, {
  defaultBatchSize: 1000, // Smaller batches for memory efficiency
  enableProgressLogging: true,
});

// Process with garbage collection hints
await rebuilder.rebuildProjection(projection, {
  batchSize: 1000,
  useTemporaryProjection: true,
});
```

### **Concurrent Rebuilds**

```typescript
// Rebuild multiple projections in parallel
const results = await ProjectionRebuilderFactory.rebuildWithSnapshots(
  eventStore,
  [proj1, proj2, proj3],
  {
    parallel: true,
    batchSize: 2000,
  }
);
```

## Best Practices

- **Snapshot Strategy**: Create snapshots regularly for faster rebuilds
- **Zero Downtime**: Always use temporary projections for production rebuilds
- **Progress Monitoring**: Implement progress tracking for long-running rebuilds
- **Error Handling**: Plan for partial failures and recovery scenarios
- **Resource Management**: Monitor memory and CPU usage during rebuilds
- **Testing**: Test rebuild procedures regularly in staging environments

## Common Pitfalls

- **Memory Leaks**: Large batch sizes can cause memory issues
- **Blocking Operations**: Synchronous rebuilds can block other operations
- **Snapshot Corruption**: Always validate snapshot integrity before use
- **Event Ordering**: Ensure events are processed in correct order during
  rebuild
- **Resource Contention**: Multiple concurrent rebuilds can overwhelm the system

## Related Examples

- [Simple Event Projection](../basic/example-1.md)
- [Projection with Capabilities](../basic/example-2.md)
- [Projection Engine Setup](../basic/example-3.md)
- [Basic Implementation Guide](../basic/implementation.md)
