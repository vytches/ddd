# Projection with Capabilities

**Version**: 1.0.0
**Package**: @vytches-ddd/projections
**Complexity**: basic
**Domain**: Event Sourcing
**Patterns**: Projection capabilities, checkpoints, circuit breakers
**Dependencies**: @vytches-ddd/projections, @vytches-ddd/events, @vytches-ddd/resilience

## Description

Event projection enhanced with capabilities for checkpoint management, circuit breaker protection, and resilience. This example demonstrates how to add production-ready features to projections including automatic checkpointing, error recovery, and failure protection.

## Business Context

Production projections need reliability features:
- Checkpoint management for resuming from failures
- Circuit breaker protection against cascading failures
- Dead letter queues for handling problematic events
- Performance monitoring and health checks
- Automatic recovery from transient errors

These capabilities ensure projections can handle real-world production scenarios with high availability and data consistency guarantees.

## Code Example

```typescript
// enhanced-projection-with-capabilities.ts
import { 
  ProjectionBase, 
  CheckpointCapability,
  CircuitBreakerCapability,
  DeadLetterCapability,
  ProjectionEngine
} from '@vytches-ddd/projections';
import { IDomainEvent } from '@vytches-ddd/events';
import { 
  OrderData,
  OrderItem,
  ProjectionCheckpoint,
  ProjectionCapability,
  ProjectionError,
  ProjectionPerformanceMetrics 
} from '../types';

// ✅ FOCUS: Enhanced projection with capabilities
export class OrderSummaryProjection extends ProjectionBase<any> {
  private checkpointCapability: CheckpointCapability;
  private circuitBreakerCapability: CircuitBreakerCapability;
  private deadLetterCapability: DeadLetterCapability;
  private performanceMetrics: ProjectionPerformanceMetrics;

  constructor() {
    super('OrderSummaryProjection', 'v1.0');
    
    // Initialize projection state
    this.setState({
      orders: new Map<string, OrderData>(),
      dailySummaries: new Map<string, any>(),
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      lastProcessedEvent: null,
      lastUpdated: new Date(),
    });

    // Initialize capabilities
    this.setupCapabilities();
    
    // Initialize performance metrics
    this.performanceMetrics = {
      eventsPerSecond: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      latency: { p50: 0, p95: 0, p99: 0 },
      errorRate: 0,
    };
  }

  private setupCapabilities(): void {
    // Checkpoint capability - saves progress every 100 events or 5 minutes
    this.checkpointCapability = new CheckpointCapability({
      projectionName: this.projectionName,
      checkpointInterval: 100, // events
      timeInterval: 5 * 60 * 1000, // 5 minutes in ms
      storage: 'memory', // In production, use persistent storage
    });

    // Circuit breaker - protects against cascading failures
    this.circuitBreakerCapability = new CircuitBreakerCapability({
      projectionName: this.projectionName,
      failureThreshold: 5, // failures before opening
      recoveryTimeout: 30000, // 30 seconds
      monitoringWindow: 60000, // 1 minute window
    });

    // Dead letter capability - handles problematic events
    this.deadLetterCapability = new DeadLetterCapability({
      projectionName: this.projectionName,
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      deadLetterStorage: 'memory',
    });

    // Wire up capability event handlers
    this.setupCapabilityEventHandlers();
  }

  private setupCapabilityEventHandlers(): void {
    // Checkpoint events
    this.checkpointCapability.on('checkpointCreated', (checkpoint: ProjectionCheckpoint) => {
      console.log(`Checkpoint created for ${this.projectionName} at position ${checkpoint.position}`);
    });

    // Circuit breaker events
    this.circuitBreakerCapability.on('circuitOpened', () => {
      console.warn(`Circuit breaker opened for ${this.projectionName}`);
    });

    this.circuitBreakerCapability.on('circuitClosed', () => {
      console.info(`Circuit breaker closed for ${this.projectionName}`);
    });

    // Dead letter events
    this.deadLetterCapability.on('eventSentToDeadLetter', (eventId: string, error: Error) => {
      console.error(`Event ${eventId} sent to dead letter queue:`, error.message);
    });
  }

  async handle(event: IDomainEvent): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Check circuit breaker status
      if (this.circuitBreakerCapability.isOpen()) {
        throw new Error('Circuit breaker is open - projection unavailable');
      }

      // Process event with retry capability
      await this.deadLetterCapability.processWithRetry(event, async () => {
        await this.processEventInternal(event);
      });

      // Record successful processing
      this.circuitBreakerCapability.recordSuccess();
      
      // Update checkpoint
      await this.checkpointCapability.updatePosition(
        event.aggregateId, 
        this.getCurrentEventPosition(event)
      );

      // Update performance metrics
      this.updatePerformanceMetrics(startTime, true);

    } catch (error) {
      console.error(`Error processing event ${event.eventId}:`, error);
      
      // Record failure for circuit breaker
      this.circuitBreakerCapability.recordFailure();
      
      // Update performance metrics
      this.updatePerformanceMetrics(startTime, false);
      
      throw error;
    }
  }

  private async processEventInternal(event: IDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'OrderPlaced':
        await this.handleOrderPlaced(event);
        break;
      case 'OrderConfirmed':
        await this.handleOrderConfirmed(event);
        break;
      case 'OrderShipped':
        await this.handleOrderShipped(event);
        break;
      case 'OrderDelivered':
        await this.handleOrderDelivered(event);
        break;
      case 'OrderCancelled':
        await this.handleOrderCancelled(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.eventType}`);
    }

    // Update last processed event
    const currentState = this.getState();
    currentState.lastProcessedEvent = {
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: new Date(event.timestamp),
    };
    currentState.lastUpdated = new Date();
    
    this.setState(currentState);
  }

  private async handleOrderPlaced(event: IDomainEvent): Promise<void> {
    const orderData = event.payload;
    const currentState = this.getState();
    
    // Create order record
    const order: OrderData = {
      id: orderData.orderId,
      customerId: orderData.customerId,
      items: orderData.items || [],
      total: orderData.total || 0,
      status: 'pending',
      createdAt: new Date(event.timestamp),
      shippingAddress: orderData.shippingAddress,
    };

    // Store order
    currentState.orders.set(order.id, order);
    
    // Update daily summary
    const orderDate = order.createdAt.toISOString().split('T')[0];
    const dailySummary = currentState.dailySummaries.get(orderDate) || {
      date: orderDate,
      orderCount: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      orders: [],
    };
    
    dailySummary.orderCount += 1;
    dailySummary.totalRevenue += order.total;
    dailySummary.averageOrderValue = dailySummary.totalRevenue / dailySummary.orderCount;
    dailySummary.orders.push(order.id);
    
    currentState.dailySummaries.set(orderDate, dailySummary);
    
    // Update global statistics
    this.recalculateGlobalStatistics(currentState);
    
    this.setState(currentState);
    
    console.log(`Order placed: ${order.id} - $${order.total}`);
  }

  private async handleOrderConfirmed(event: IDomainEvent): Promise<void> {
    const confirmData = event.payload;
    const currentState = this.getState();
    
    const order = currentState.orders.get(confirmData.orderId);
    if (!order) {
      console.warn(`Order ${confirmData.orderId} not found for confirmation`);
      return;
    }

    // Update order status
    const confirmedOrder: OrderData = {
      ...order,
      status: 'confirmed',
    };

    currentState.orders.set(confirmedOrder.id, confirmedOrder);
    this.setState(currentState);
    
    console.log(`Order confirmed: ${confirmedOrder.id}`);
  }

  private async handleOrderShipped(event: IDomainEvent): Promise<void> {
    const shipData = event.payload;
    const currentState = this.getState();
    
    const order = currentState.orders.get(shipData.orderId);
    if (!order) {
      console.warn(`Order ${shipData.orderId} not found for shipping`);
      return;
    }

    // Update order status with shipping info
    const shippedOrder: OrderData = {
      ...order,
      status: 'shipped',
    };

    currentState.orders.set(shippedOrder.id, shippedOrder);
    this.setState(currentState);
    
    console.log(`Order shipped: ${shippedOrder.id}`);
  }

  private async handleOrderDelivered(event: IDomainEvent): Promise<void> {
    const deliveryData = event.payload;
    const currentState = this.getState();
    
    const order = currentState.orders.get(deliveryData.orderId);
    if (!order) {
      console.warn(`Order ${deliveryData.orderId} not found for delivery`);
      return;
    }

    // Update order status
    const deliveredOrder: OrderData = {
      ...order,
      status: 'delivered',
    };

    currentState.orders.set(deliveredOrder.id, deliveredOrder);
    this.setState(currentState);
    
    console.log(`Order delivered: ${deliveredOrder.id}`);
  }

  private async handleOrderCancelled(event: IDomainEvent): Promise<void> {
    const cancelData = event.payload;
    const currentState = this.getState();
    
    const order = currentState.orders.get(cancelData.orderId);
    if (!order) {
      console.warn(`Order ${cancelData.orderId} not found for cancellation`);
      return;
    }

    // Update order status
    const cancelledOrder: OrderData = {
      ...order,
      status: 'cancelled',
    };

    currentState.orders.set(cancelledOrder.id, cancelledOrder);
    
    // Adjust daily summary (subtract cancelled order)
    const orderDate = order.createdAt.toISOString().split('T')[0];
    const dailySummary = currentState.dailySummaries.get(orderDate);
    
    if (dailySummary) {
      dailySummary.orderCount = Math.max(0, dailySummary.orderCount - 1);
      dailySummary.totalRevenue = Math.max(0, dailySummary.totalRevenue - order.total);
      dailySummary.averageOrderValue = dailySummary.orderCount > 0 
        ? dailySummary.totalRevenue / dailySummary.orderCount 
        : 0;
      
      // Remove order from daily list
      dailySummary.orders = dailySummary.orders.filter(id => id !== order.id);
      
      currentState.dailySummaries.set(orderDate, dailySummary);
    }
    
    // Recalculate global statistics
    this.recalculateGlobalStatistics(currentState);
    
    this.setState(currentState);
    
    console.log(`Order cancelled: ${cancelledOrder.id}`);
  }

  private recalculateGlobalStatistics(state: any): void {
    const activeOrders = Array.from(state.orders.values())
      .filter(order => order.status !== 'cancelled');
    
    state.totalOrders = activeOrders.length;
    state.totalRevenue = activeOrders.reduce((sum, order) => sum + order.total, 0);
    state.averageOrderValue = state.totalOrders > 0 ? state.totalRevenue / state.totalOrders : 0;
  }

  // Query methods
  getOrderById(orderId: string): OrderData | undefined {
    return this.getState().orders.get(orderId);
  }

  getDailySummary(date: string): any {
    return this.getState().dailySummaries.get(date);
  }

  getOrdersByStatus(status: string): OrderData[] {
    return Array.from(this.getState().orders.values())
      .filter(order => order.status === status);
  }

  getRevenueByDateRange(startDate: string, endDate: string): number {
    let totalRevenue = 0;
    
    for (const [date, summary] of this.getState().dailySummaries) {
      if (date >= startDate && date <= endDate) {
        totalRevenue += summary.totalRevenue;
      }
    }
    
    return totalRevenue;
  }

  // Capability management methods
  async createCheckpoint(): Promise<ProjectionCheckpoint> {
    return await this.checkpointCapability.createCheckpoint();
  }

  async loadFromCheckpoint(): Promise<boolean> {
    const checkpoint = await this.checkpointCapability.getLatestCheckpoint();
    if (!checkpoint) {
      return false;
    }

    console.log(`Loading ${this.projectionName} from checkpoint at position ${checkpoint.position}`);
    // In a real implementation, this would restore state from the checkpoint
    return true;
  }

  getCapabilityStatus(): Record<string, any> {
    return {
      checkpoint: {
        lastCheckpoint: this.checkpointCapability.getLastCheckpointTime(),
        eventsSinceLastCheckpoint: this.checkpointCapability.getEventsSinceLastCheckpoint(),
      },
      circuitBreaker: {
        state: this.circuitBreakerCapability.getState(), // 'closed', 'open', 'half-open'
        failureCount: this.circuitBreakerCapability.getFailureCount(),
        lastFailure: this.circuitBreakerCapability.getLastFailureTime(),
      },
      deadLetter: {
        queueSize: this.deadLetterCapability.getQueueSize(),
        totalRetries: this.deadLetterCapability.getTotalRetries(),
        successfulRetries: this.deadLetterCapability.getSuccessfulRetries(),
      },
    };
  }

  getPerformanceMetrics(): ProjectionPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  // Health check method
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    // Check circuit breaker
    if (this.circuitBreakerCapability.isOpen()) {
      issues.push('Circuit breaker is open');
    }
    
    // Check dead letter queue size
    const deadLetterSize = this.deadLetterCapability.getQueueSize();
    if (deadLetterSize > 10) {
      issues.push(`High number of dead letter events: ${deadLetterSize}`);
    }
    
    // Check error rate
    if (this.performanceMetrics.errorRate > 0.05) { // 5%
      issues.push(`High error rate: ${(this.performanceMetrics.errorRate * 100).toFixed(2)}%`);
    }
    
    // Check if projection is significantly behind
    const lastCheckpoint = await this.checkpointCapability.getLatestCheckpoint();
    if (lastCheckpoint) {
      const timeSinceLastCheckpoint = Date.now() - lastCheckpoint.processedAt.getTime();
      if (timeSinceLastCheckpoint > 5 * 60 * 1000) { // 5 minutes
        issues.push('Projection may be lagging behind event stream');
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  private getCurrentEventPosition(event: IDomainEvent): number {
    // In a real implementation, this would return the actual stream position
    return parseInt(event.eventId) || Date.now();
  }

  private updatePerformanceMetrics(startTime: number, success: boolean): void {
    const processingTime = performance.now() - startTime;
    
    // Update latency metrics (simplified)
    this.performanceMetrics.latency.p50 = 
      (this.performanceMetrics.latency.p50 * 0.9) + (processingTime * 0.1);
    
    // Update error rate (simplified)
    const currentErrorRate = success ? 0 : 1;
    this.performanceMetrics.errorRate = 
      (this.performanceMetrics.errorRate * 0.95) + (currentErrorRate * 0.05);
  }

  // Capability cleanup
  async dispose(): Promise<void> {
    await this.checkpointCapability.dispose();
    await this.circuitBreakerCapability.dispose();
    await this.deadLetterCapability.dispose();
    
    console.log(`${this.projectionName} capabilities disposed`);
  }
}

// Projection with capabilities runner
export class ProjectionWithCapabilitiesRunner {
  private projection: OrderSummaryProjection;
  private isRunning = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.projection = new OrderSummaryProjection();
  }

  async start(): Promise<void> {
    // Try to load from checkpoint
    const loaded = await this.projection.loadFromCheckpoint();
    if (loaded) {
      console.log('Projection loaded from checkpoint');
    } else {
      console.log('Starting projection from beginning');
    }
    
    this.isRunning = true;
    
    // Start health check monitoring
    this.startHealthChecks();
    
    console.log('Projection with capabilities started');
  }

  async processEvent(event: IDomainEvent): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Projection runner is not running');
    }
    
    await this.projection.handle(event);
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.projection.healthCheck();
      
      if (!health.healthy) {
        console.warn('Projection health issues detected:', health.issues);
      }
      
      // Log capability status
      const capabilities = this.projection.getCapabilityStatus();
      console.log('Capability status:', capabilities);
      
    }, 60000); // Every minute
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Create final checkpoint
    await this.projection.createCheckpoint();
    
    // Dispose capabilities
    await this.projection.dispose();
    
    console.log('Projection with capabilities stopped');
  }

  getProjection(): OrderSummaryProjection {
    return this.projection;
  }
}
```

## Key Features

- **Checkpoint Capability**: Automatic progress saving for failure recovery
- **Circuit Breaker**: Protection against cascading failures
- **Dead Letter Queue**: Handling of problematic events with retry logic
- **Performance Monitoring**: Real-time metrics and health checking
- **State Management**: Comprehensive order and revenue tracking
- **Query Interface**: Multiple query methods for different access patterns

## Usage Examples

```typescript
// Create and start projection with capabilities
const runner = new ProjectionWithCapabilitiesRunner();
await runner.start();

// Process order events
await runner.processEvent({
  eventId: '1001',
  eventType: 'OrderPlaced',
  aggregateId: 'order-1',
  payload: {
    orderId: 'order-1',
    customerId: 'customer-1',
    items: [
      { productId: 'product-1', name: 'Widget', quantity: 2, price: 25, total: 50 }
    ],
    total: 50,
    shippingAddress: {
      street: '123 Main St',
      city: 'City',
      state: 'State',
      zipCode: '12345',
      country: 'US'
    }
  },
  timestamp: new Date(),
  version: 1
});

await runner.processEvent({
  eventId: '1002',
  eventType: 'OrderConfirmed',
  aggregateId: 'order-1',
  payload: {
    orderId: 'order-1'
  },
  timestamp: new Date(),
  version: 2
});

// Query the projection
const projection = runner.getProjection();
const order = projection.getOrderById('order-1');
console.log('Order details:', order);

const todaysSummary = projection.getDailySummary(
  new Date().toISOString().split('T')[0]
);
console.log('Today\'s summary:', todaysSummary);

// Check health and capabilities
const health = await projection.healthCheck();
console.log('Health status:', health);

const capabilityStatus = projection.getCapabilityStatus();
console.log('Capability status:', capabilityStatus);

const metrics = projection.getPerformanceMetrics();
console.log('Performance metrics:', metrics);

// Stop gracefully
await runner.stop();
```

## Capability Benefits

### **Checkpoint Management**
- Automatic progress saving prevents data loss on failures
- Configurable intervals balance performance vs. durability
- Fast recovery from known positions

### **Circuit Breaker Protection**
- Prevents cascade failures in projection chains
- Automatic recovery when conditions improve
- Failure threshold configuration

### **Dead Letter Handling**
- Retry logic for transient failures
- Isolation of problematic events
- Manual intervention capabilities

### **Performance Monitoring**
- Real-time metrics collection
- Health check automation
- Proactive issue detection

## Best Practices

- **Capability Configuration**: Tune intervals and thresholds for your workload
- **Monitoring**: Set up alerts based on health check results
- **Recovery Planning**: Test checkpoint recovery procedures
- **Error Handling**: Review dead letter events regularly
- **Performance Tuning**: Monitor metrics and adjust as needed

## Common Pitfalls

- **Over-Checkpointing**: Too frequent checkpoints impact performance
- **Circuit Breaker Sensitivity**: Too sensitive breakers cause unnecessary downtime
- **Dead Letter Accumulation**: Unmonitored dead letters indicate systemic issues
- **Resource Leaks**: Always dispose capabilities properly

## Related Examples

- [Simple Event Projection](./example-1.md)
- [Projection Engine Setup](./example-3.md)
- [Basic Implementation Guide](./implementation.md)